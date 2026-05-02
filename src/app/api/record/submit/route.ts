import { createServerSupabaseClient } from '@/lib/supabase-server'

const UPLOAD_ACCEPT_MIME = ['video/mp4', 'video/quicktime', 'video/webm']
const UPLOAD_MAX_BYTES = 100 * 1024 * 1024

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const campaignId = formData.get('campaignId') as string | null
  const email = (formData.get('email') as string | null)?.trim() || null
  const newsletter = formData.get('newsletter') === 'true'
  const mode = (formData.get('mode') as string | null) === 'upload' ? 'upload' : 'field'

  if (!campaignId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate campaign exists, is active, and has the requested mode enabled
  const { data: campaign, error: campErr } = await supabase
    .from('wmu_campaigns')
    .select('id, status, field_recorder_enabled, upload_enabled')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign || campaign.status !== 'active') {
    return Response.json(
      { error: 'Campaign is not available' },
      { status: 404 },
    )
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

  if (mode === 'upload') {
    return handleUploadMode({ supabase, formData, campaignId, email, newsletter })
  }

  // ── Field recorder (live record) flow ────────────────────────
  const promptIdsRaw = formData.get('promptIds') as string | null
  if (!promptIdsRaw) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let promptIds: string[]
  try {
    promptIds = JSON.parse(promptIdsRaw)
  } catch {
    return Response.json({ error: 'Invalid promptIds' }, { status: 400 })
  }

  // If email provided, check if a Shift user has this email
  let userId: string | null = null
  if (email) {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle()
    if (user) userId = user.id
  }

  // Create submission
  const { data: submission, error: subErr } = await supabase
    .from('wmu_submissions')
    .insert({
      campaign_id: campaignId,
      user_id: userId,
      invitation_id: null,
      status: 'started',
      recruit_source: 'field',
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

  // Upload clips and insert records
  for (let i = 0; i < promptIds.length; i++) {
    const promptId = promptIds[i]
    const isSkipped = formData.get(`clip_${promptId}_skipped`) === 'true'

    if (isSkipped) {
      // Insert skipped clip record
      const { error: clipErr } = await supabase.from('wmu_clips').insert({
        submission_id: submissionId,
        prompt_id: promptId,
        media_type: 'video',
        skipped: true,
      })
      if (clipErr) {
        console.error(`Skipped clip insert failed for prompt ${promptId}:`, clipErr)
      }
      continue
    }

    const clipBlob = formData.get(`clip_${promptId}`) as File | null
    const mimeType = (formData.get(`clip_${promptId}_mime`) as string) ?? 'video/webm'
    const duration = parseInt((formData.get(`clip_${promptId}_duration`) as string) ?? '0', 10)

    if (!clipBlob) continue

    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const storagePath = `${campaignId}/${submissionId}/${i}.${ext}`

    // Upload to Supabase Storage
    const arrayBuffer = await clipBlob.arrayBuffer()
    const { error: uploadErr } = await supabase.storage
      .from('wmu-clips')
      .upload(storagePath, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadErr) {
      console.error(`Clip upload failed for prompt ${promptId}:`, uploadErr)
      // Mark submission as abandoned and return error
      await supabase
        .from('wmu_submissions')
        .update({ status: 'abandoned' })
        .eq('id', submissionId)
      return Response.json(
        { error: `Failed to upload recording: ${uploadErr.message}` },
        { status: 500 },
      )
    }

    // Insert clip record
    const mediaType = mimeType.startsWith('audio/') ? 'audio' : 'video'
    const { error: clipErr } = await supabase.from('wmu_clips').insert({
      submission_id: submissionId,
      prompt_id: promptId,
      storage_url: storagePath,
      media_type: mediaType,
      mime_type: mimeType,
      duration_seconds: duration || null,
      skipped: false,
    })

    if (clipErr) {
      console.error(`Clip record insert failed for prompt ${promptId}:`, clipErr)
    }
  }

  // Mark submission as complete
  await supabase
    .from('wmu_submissions')
    .update({ status: 'complete' })
    .eq('id', submissionId)

  // If email + newsletter, upsert into contacts
  if (email && newsletter) {
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (existingContact) {
      await supabase
        .from('contacts')
        .update({ loops_subscribed: true })
        .eq('id', existingContact.id)
    } else {
      await supabase.from('contacts').insert({
        email,
        source: 'wmu_field_recorder',
        loops_subscribed: true,
      })
    }
  }

  return Response.json({ success: true, submissionId })
}

// ── Upload mode (pre-recorded video) ─────────────────────────

async function handleUploadMode({
  supabase,
  formData,
  campaignId,
  email,
  newsletter,
}: {
  supabase: ReturnType<typeof createServerSupabaseClient>
  formData: FormData
  campaignId: string
  email: string | null
  newsletter: boolean
}) {
  if (!email) {
    return Response.json(
      { error: 'Email is required to upload a pre-recorded video.' },
      { status: 400 },
    )
  }

  const promptId = formData.get('promptId') as string | null
  const file = formData.get('file') as File | null
  const mimeType = (formData.get('mimeType') as string | null) ?? file?.type ?? ''

  if (!promptId || !file) {
    return Response.json({ error: 'Missing video file or prompt id' }, { status: 400 })
  }

  if (!UPLOAD_ACCEPT_MIME.includes(mimeType)) {
    return Response.json(
      { error: 'Please upload an MP4, MOV, or WEBM video.' },
      { status: 400 },
    )
  }

  if (file.size > UPLOAD_MAX_BYTES) {
    return Response.json(
      { error: 'That video is over 100 MB. Try a shorter or lower-quality clip.' },
      { status: 413 },
    )
  }

  // Duplicate-email guard: one upload per email per campaign
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

  // Look up Shift user by email (no-op if none)
  let userId: string | null = null
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle()
  if (user) userId = user.id

  // Create submission
  const { data: submission, error: subErr } = await supabase
    .from('wmu_submissions')
    .insert({
      campaign_id: campaignId,
      user_id: userId,
      invitation_id: null,
      status: 'started',
      recruit_source: 'upload',
      field_submitter_email: email,
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (subErr || !submission) {
    console.error('Upload submission insert failed:', subErr)
    return Response.json(
      { error: `Failed to create submission: ${subErr?.message ?? 'Unknown error'}` },
      { status: 500 },
    )
  }

  const submissionId = submission.id

  const ext =
    mimeType === 'video/mp4'
      ? 'mp4'
      : mimeType === 'video/quicktime'
        ? 'mov'
        : 'webm'
  const storagePath = `${campaignId}/${submissionId}/upload.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await supabase.storage
    .from('wmu-clips')
    .upload(storagePath, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadErr) {
    console.error('Upload-mode storage upload failed:', uploadErr)
    await supabase
      .from('wmu_submissions')
      .update({ status: 'abandoned' })
      .eq('id', submissionId)
    return Response.json(
      { error: `Failed to upload your video: ${uploadErr.message}` },
      { status: 500 },
    )
  }

  // One clip row, attached to the first prompt
  const { error: clipErr } = await supabase.from('wmu_clips').insert({
    submission_id: submissionId,
    prompt_id: promptId,
    storage_url: storagePath,
    media_type: 'video',
    mime_type: mimeType,
    duration_seconds: null,
    skipped: false,
  })

  if (clipErr) {
    console.error('Upload-mode clip insert failed:', clipErr)
  }

  await supabase
    .from('wmu_submissions')
    .update({ status: 'complete' })
    .eq('id', submissionId)

  if (newsletter) {
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (existingContact) {
      await supabase
        .from('contacts')
        .update({ loops_subscribed: true })
        .eq('id', existingContact.id)
    } else {
      await supabase.from('contacts').insert({
        email,
        source: 'wmu_upload',
        loops_subscribed: true,
      })
    }
  }

  return Response.json({ success: true, submissionId })
}
