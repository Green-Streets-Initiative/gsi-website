import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Phase 3 of the field-recorder submission flow. See submit/route.ts for the
 * overall shape.
 *
 * The client has already uploaded each clip directly to Supabase Storage via
 * the signed URLs returned from /api/record/submit. This endpoint receives
 * the final clip metadata and:
 *   - Inserts wmu_clips rows (one per prompt, including skipped clips)
 *   - Marks the submission as `complete`
 *   - Always upserts the captured email into the CRM `contacts` table when
 *     one was provided. `loops_subscribed` reflects the newsletter checkbox;
 *     if the participant didn't opt into the newsletter the contact is still
 *     recorded so the campaign team can follow up about results without
 *     subscribing them to ongoing email.
 */

interface FinalizeClip {
  promptId: string
  path?: string | null
  mimeType?: string | null
  durationSeconds?: number | null
  skipped: boolean
}

interface FinalizeBody {
  submissionId?: string
  clips?: FinalizeClip[]
  email?: string | null
  newsletter?: boolean
  language?: string
  source?: 'wmu_field_recorder' | 'wmu_upload'
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()

  let body: FinalizeBody
  try {
    body = (await req.json()) as FinalizeBody
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const submissionId = body.submissionId
  const clips = Array.isArray(body.clips) ? body.clips : []
  const email = body.email?.trim() || null
  const newsletter = body.newsletter === true
  const source = body.source ?? 'wmu_field_recorder'

  if (!submissionId || clips.length === 0) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify the submission exists and is in the started state we expect
  const { data: submission, error: subErr } = await supabase
    .from('wmu_submissions')
    .select('id, status')
    .eq('id', submissionId)
    .single()

  if (subErr || !submission) {
    return Response.json({ error: 'Submission not found' }, { status: 404 })
  }

  if (submission.status === 'complete') {
    // Idempotent: caller is retrying after we already finalized
    return Response.json({ success: true, submissionId })
  }

  // Insert wmu_clips rows
  for (const c of clips) {
    if (c.skipped) {
      const { error: clipErr } = await supabase.from('wmu_clips').insert({
        submission_id: submissionId,
        prompt_id: c.promptId,
        media_type: 'video',
        skipped: true,
      })
      if (clipErr) {
        console.error(`Skipped clip insert failed for prompt ${c.promptId}:`, clipErr)
      }
      continue
    }

    if (!c.path || !c.mimeType) continue

    const mediaType = c.mimeType.startsWith('audio/') ? 'audio' : 'video'
    const { error: clipErr } = await supabase.from('wmu_clips').insert({
      submission_id: submissionId,
      prompt_id: c.promptId,
      storage_url: c.path,
      media_type: mediaType,
      mime_type: c.mimeType,
      duration_seconds: c.durationSeconds ?? null,
      skipped: false,
    })
    if (clipErr) {
      console.error(`Clip record insert failed for prompt ${c.promptId}:`, clipErr)
    }
  }

  // Mark submission complete
  await supabase
    .from('wmu_submissions')
    .update({ status: 'complete' })
    .eq('id', submissionId)

  // Always sync the captured email into contacts when one was provided.
  // The newsletter checkbox controls subscription state, not whether we
  // record the contact at all.
  if (email) {
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, loops_subscribed')
      .ilike('email', email)
      .maybeSingle()

    if (existingContact) {
      // Only upgrade subscription state — never silently unsubscribe an
      // existing contact who happened to leave the box unchecked here.
      if (newsletter && !existingContact.loops_subscribed) {
        await supabase
          .from('contacts')
          .update({ loops_subscribed: true })
          .eq('id', existingContact.id)
      }
    } else {
      await supabase.from('contacts').insert({
        email,
        source,
        loops_subscribed: newsletter,
      })
    }
  }

  return Response.json({ success: true, submissionId })
}
