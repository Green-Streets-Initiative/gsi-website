import { createServerSupabaseClient } from '@/lib/supabase-server'

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
  const promptIdsRaw = formData.get('promptIds') as string | null

  if (!campaignId || !promptIdsRaw) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let promptIds: string[]
  try {
    promptIds = JSON.parse(promptIdsRaw)
  } catch {
    return Response.json({ error: 'Invalid promptIds' }, { status: 400 })
  }

  // Validate campaign exists and is active
  const { data: campaign, error: campErr } = await supabase
    .from('wmu_campaigns')
    .select('id, status, field_recorder_enabled')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign || campaign.status !== 'active' || !campaign.field_recorder_enabled) {
    return Response.json(
      { error: 'Campaign is not available for field recording' },
      { status: 404 },
    )
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
