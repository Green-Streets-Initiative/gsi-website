import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The signed-in organizer behind a console API call, and a Supabase client
 * that acts as them, so every database function's own organizer check
 * applies exactly as it does in the browser. No service role here.
 */
export type OrganizerCaller =
  | { ok: true; userId: string; email: string | null; token: string; db: SupabaseClient }
  | { ok: false; res: Response }

export async function requireOrganizerCaller(request: Request): Promise<OrganizerCaller> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { ok: false, res: Response.json({ error: 'Not signed in' }, { status: 401 }) }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const auth = createClient(url, anon, { auth: { persistSession: false } })
  const { data: { user }, error } = await auth.auth.getUser(token)
  if (error || !user) return { ok: false, res: Response.json({ error: 'Not signed in' }, { status: 401 }) }
  const db = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  return { ok: true, userId: user.id, email: user.email ?? null, token, db }
}

export const SHIFT_FUNCTIONS = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1`
