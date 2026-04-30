import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: Request) {
  let body: { email?: string; website?: string }
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

  try {
    const supabase = createServerSupabaseClient()
    const { data: inserted, error } = await supabase
      .from('launch_waitlist')
      .upsert({ email, source: 'app_page' }, { onConflict: 'email', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error('Launch waitlist DB error:', error)
      return Response.json({ error: 'Database error' }, { status: 500 })
    }

    const isNewSignup = !!inserted && inserted.length > 0

    // CRM sync — runs on every submit so a re-submit can re-subscribe an
    // unsubscribed contact. Wrapped so a CRM hiccup never fails the request.
    let crmContactId: string | undefined
    try {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id, loops_subscribed')
        .ilike('email', email)
        .maybeSingle()

      if (existingContact?.id) {
        crmContactId = existingContact.id
        if (!existingContact.loops_subscribed) {
          await supabase
            .from('contacts')
            .update({ loops_subscribed: true })
            .eq('id', existingContact.id)
        }
      } else {
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            email,
            loops_subscribed: true,
            source: 'app_waitlist',
            classification_status: 'unclassified',
            notes: 'Joined Shift app launch waitlist',
          })
          .select('id')
          .single()
        crmContactId = newContact?.id
      }

      if (crmContactId && isNewSignup) {
        await supabase.from('interactions').insert({
          contact_id: crmContactId,
          type: 'note',
          direction: 'inbound',
          subject: 'Joined Shift app launch waitlist',
          body: 'Submitted email at gogreenstreets.org/app to be notified at launch.',
          occurred_at: new Date().toISOString(),
        })
      }
    } catch (crmError) {
      console.error('Launch waitlist CRM sync error:', crmError)
    }

    if (isNewSignup) {
      try {
        await resend.emails.send({
          from: 'Shift Website <noreply@gogreenstreets.org>',
          to: 'keith@gogreenstreets.org',
          subject: 'New Shift app waitlist signup',
          html: `<p><strong>Email:</strong> ${email}</p>
                 <p><strong>Source:</strong> app_page</p>
                 <hr/>
                 <p style="color:#888;font-size:12px">
                   Submitted via gogreenstreets.org/app<br/>
                   ${new Date().toISOString()}
                 </p>`,
        })
      } catch (emailError) {
        console.error('Launch waitlist email error:', emailError)
      }
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Launch waitlist unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
