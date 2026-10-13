import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export type PortalCaller = { ok: true; email: string; userId: string; token: string; role: 'admin' | 'manager' | 'viewer' | 'gsi' } | { ok: false; res: Response }

/**
 * The signed-in portal user and their role on `groupId`: an admin, manager
 * or viewer on the company's team, or a GSI admin. With `manage`, viewers
 * are refused. API routes use this before reading anything with the
 * service role.
 */
export async function requirePortalCaller(request: Request, groupId: string | null | undefined, opts: { manage?: boolean } = {}): Promise<PortalCaller> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false, res: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user }, error } = await authClient.auth.getUser(token)
  if (error || !user?.email) return { ok: false, res: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!groupId || !/^[0-9a-f-]{36}$/i.test(groupId)) {
    return { ok: false, res: Response.json({ error: 'group_id required' }, { status: 400 }) }
  }
  const sb = createServerSupabaseClient()
  const [adminRes, gsiRes] = await Promise.all([
    sb.from('group_admins').select('role').eq('group_id', groupId).ilike('email', user.email).maybeSingle(),
    sb.from('school_roles').select('role').eq('user_id', user.id).eq('role', 'gsi_admin').maybeSingle(),
  ])
  const raw = adminRes.data?.role as string | undefined
  let role: 'admin' | 'manager' | 'viewer' | 'gsi' | null = null
  if (gsiRes.data) role = 'gsi'
  else if (raw === 'admin' || raw === 'manager') role = raw
  else if (raw) role = 'viewer'
  if (!role) return { ok: false, res: Response.json({ error: 'Not on this workplace' }, { status: 403 }) }
  if (opts.manage && role === 'viewer') {
    return { ok: false, res: Response.json({ error: 'Only admins and managers can do that' }, { status: 403 }) }
  }
  return { ok: true, email: user.email, userId: user.id, token, role }
}
