import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Phase 1 of the field-recorder submission flow.
 *
 * Vercel's serverless functions cap request bodies at 4.5 MB, which is
 * smaller than a typical phone-shot video. So we split the submission flow:
 *
 *   1. POST /api/record/submit   (this route)
 *      Receives metadata (campaign id, mode, email, prompt list / mime types).
 *      Creates the wmu_submissions row, generates short-lived signed upload
 *      URLs (one per non-skipped clip), and returns them. No file blobs cross
 *      this endpoint.
 *
 *   2. Client uploads each clip directly to Supabase Storage using the signed
 *      URLs. This bypasses Vercel entirely — the file goes straight to
 *      storage and can be the bucket's full 100 MB cap.
 *
 *   3. POST /api/record/finalize
 *      Inserts the wmu_clips rows, marks the submission complete, and syncs
 *      the captured email to the CRM contacts table.
 */

const UPLOAD_ACCEPT_MIME = ['video/mp4', 'video/quicktime', 'video/webm']
const RECORD_ACCEPT_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/webm',
  'audio/wav',
]

interface SubmitClipManifest {
  promptId: string
  mimeType?: string
  skipped: boolean
}

interface SubmitBody {
  campaignId?: string
  mode?: 'field' | 'upload'
  email?: string | null
  newsletter?: boolean
  language?: string
  clips?: SubmitClipManifest[]
}

function extFromMime(mime: string): string {
  if (mime === 'video/mp4' || mime === 'audio/mp4') return 'mp4'
  if (mime === 'video/quicktime') return 'mov'
  if (mime === 'audio/mpeg') return 'mp3'
  if (mime === 'audio/wav') return 'wav'
  // webm covers both video/webm and audio/webm
  return 'webm'
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()

  let body: SubmitBody
  try {
    body = (await req.json()) as SubmitBody
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const campaignId = body.campaignId
  const email = body.email?.trim() || null
  const mode: 'field' | 'upload' = body.mode === 'upload' ? 'upload' : 'field'
  const clips = Array.isArray(body.clips) ? body.clips : []

  if (!campaignId || clips.length === 0) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate campaign exists, is active, and has the requested mode enabled
  const { data: campaign, error: campErr } = await supabase
    .from('wmu_campaigns')
    .select('id, status, field_recorder_enabled, upload_enabled')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign || campaign.status !== 'active') {
    return Response.json({ error: 'Campaign is not available' }, { status: 404 })
  }

  if (mode === 'upload' && !campaign.upload_enabled) {
    return Response.json(
      { error: 'This campaign is not accepting pre-recorded uploads' },
      { status: 404 },
    )
  }

  if (mode === 'field' && !campaign.field_recorder_enabled) {
    return Response.json(
      { error: 'Campaign is not available for field recording' },
      { status: 404 },
    )
  }

  // Mode-specific validation
  const acceptedMime = mode === 'upload' ? UPLOAD_ACCEPT_MIME : RECORD_ACCEPT_MIME

  if (mode === 'upload') {
    if (clips.length !== 1 || clips[0].skipped) {
      return Response.json({ error: 'Upload mode expects exactly one video file.' }, { status: 400 })
    }
    const m = clips[0].mimeType ?? ''
    if (!acceptedMime.includes(m)) {
      return Response.json(
        { error: 'Please upload an MP4, MOV, or WEBM video.' },
        { status: 400 },
      )
    }

    // Duplicate-email guard — only meaningful when an email is provided.
    // Without an email we can't tell who submitted; that's a known tradeoff
    // of keeping the email field optional.
    if (email) {
      const { data: existing } = await supabase
        .from('wmu_submissions')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('recruit_source', 'upload')
        .ilike('field_submitter_email', email)
        .limit(1)
        .maybeSingle()

      if (existing) {
        return Response.json(
          { error: "Looks like you've already submitted to this campaign — thank you." },
          { status: 409 },
        )
      }
    }
  } else {
    // Record mode: validate every non-skipped clip has an accepted MIME type
    for (const c of clips) {
      if (c.skipped) continue
      if (!c.mimeType || !acceptedMime.includes(c.mimeType)) {
        return Response.json(
          { error: 'A recorded clip is in an unsupported format.' },
          { status: 400 },
        )
      }
    }
  }

  // Look up Shift user by email (no-op if none)
  let userId: string | null = null
  if (email) {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle()
    if (user) userId = user.id
  }

  // Create the submission row
  const { data: submission, error: subErr } = await supabase
    .from('wmu_submissions')
    .insert({
      campaign_id: campaignId,
      user_id: userId,
      invitation_id: null,
      status: 'started',
      recruit_source: mode === 'upload' ? 'upload' : 'field',
      field_submitter_email: email,
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (subErr || !submission) {
    console.error('Submission insert failed:', subErr)
    return Response.json(
      { error: `Failed to create submission: ${subErr?.message ?? 'Unknown error'}` },
      { status: 500 },
    )
  }

  const submissionId = submission.id

  // Generate signed upload URLs for every non-skipped clip
  const uploads: Array<{ promptId: string; path: string; token: string }> = []
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i]
    if (c.skipped) continue
    const ext = extFromMime(c.mimeType ?? '')
    const fileName = mode === 'upload' ? `upload.${ext}` : `${i}.${ext}`
    const path = `${campaignId}/${submissionId}/${fileName}`

    const { data: signed, error: signErr } = await supabase.storage
      .from('wmu-clips')
      .createSignedUploadUrl(path)

    if (signErr || !signed) {
      console.error('createSignedUploadUrl failed:', signErr)
      await supabase
        .from('wmu_submissions')
        .update({ status: 'abandoned' })
        .eq('id', submissionId)
      return Response.json(
        { error: `Could not prepare upload: ${signErr?.message ?? 'Unknown error'}` },
        { status: 500 },
      )
    }

    uploads.push({ promptId: c.promptId, path: signed.path, token: signed.token })
  }

  return Response.json({ submissionId, uploads })
}
