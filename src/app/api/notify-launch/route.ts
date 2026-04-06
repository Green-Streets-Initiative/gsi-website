import { createServerSupabaseClient } from '@/lib/supabase-server'

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
    const { error } = await supabase
      .from('launch_waitlist')
      .upsert({ email, source: 'app_page' }, { onConflict: 'email' })

    if (error) {
      console.error('Launch waitlist DB error:', error)
      return Response.json({ error: 'Database error' }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Launch waitlist unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
