import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  let body: { email?: string; firstName?: string; website?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Honeypot check
  if (body.website) {
    return Response.json({ ok: true })
  }

  const email = body.email?.trim()
  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const firstName = body.firstName?.trim() || null

  try {
    const supabase = createServerSupabaseClient()

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, first_name, loops_subscribed')
      .ilike('email', email)
      .maybeSingle()

    let contactId: string | undefined
    let isNewSignup = false

    if (existingContact?.id) {
      contactId = existingContact.id
      const updates: { loops_subscribed?: boolean; first_name?: string } = {}
      if (!existingContact.loops_subscribed) {
        updates.loops_subscribed = true
      }
      if (!existingContact.first_name && firstName) {
        updates.first_name = firstName
      }
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update(updates)
          .eq('id', existingContact.id)
        if (updateError) {
          console.error('Newsletter subscribe update error:', updateError)
        }
      }
    } else {
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          email,
          first_name: firstName,
          loops_subscribed: true,
          source: 'newsletter_footer',
          classification_status: 'unclassified',
          notes: 'Subscribed via website footer newsletter form',
        })
        .select('id')
        .single()
      if (insertError) {
        console.error('Newsletter subscribe insert error:', insertError)
        return Response.json({ error: 'Database error' }, { status: 500 })
      }
      contactId = newContact?.id
      isNewSignup = true
    }

    if (contactId && isNewSignup) {
      try {
        await supabase.from('interactions').insert({
          contact_id: contactId,
          type: 'note',
          direction: 'inbound',
          subject: 'Subscribed to newsletter',
          body: 'Submitted email at gogreenstreets.org footer newsletter form.',
          occurred_at: new Date().toISOString(),
        })
      } catch (interactionError) {
        console.error('Newsletter subscribe interaction error:', interactionError)
      }
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Newsletter subscribe unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
