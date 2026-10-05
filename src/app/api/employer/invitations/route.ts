import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type AdminCheck = { ok: true; email: string; token: string } | { ok: false; res: Response }

/** Signed-in admin or manager of `groupId` (or a GSI admin). Both routes
 *  email or show the company's invitation, so viewers are refused. Managers
 *  invite employees (migration 01081). */
async function requireGroupAdmin(request: Request, groupId: string | null | undefined): Promise<AdminCheck> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false, res: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token)
  if (authErr || !user?.email) return { ok: false, res: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!groupId || typeof groupId !== 'string') {
    return { ok: false, res: Response.json({ error: 'group_id required' }, { status: 400 }) }
  }
  const sb = createServerSupabaseClient()
  const [adminRes, gsiRes] = await Promise.all([
    sb.from('group_admins').select('role').eq('group_id', groupId).eq('email', user.email).maybeSingle(),
    sb.from('school_roles').select('role').eq('user_id', user.id).eq('role', 'gsi_admin').maybeSingle(),
  ])
  const role = adminRes.data?.role
  if (role !== 'admin' && role !== 'manager' && !gsiRes.data) {
    return { ok: false, res: Response.json({ error: 'Only admins and managers can send invitations' }, { status: 403 }) }
  }
  return { ok: true, email: user.email, token }
}

/**
 * The invitation and reminder exactly as employees get them, with this
 * company's name and code (the portal's "How this looks to them"). The
 * edge function builds them from the same templates it sends; nothing is
 * sent. GET /api/employer/invitations?group_id=<uuid>
 */
export async function GET(request: Request) {
  const groupId = new URL(request.url).searchParams.get('group_id')
  const check = await requireGroupAdmin(request, groupId)
  if (!check.ok) return check.res
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The admin's own sign-in: the function checks they admin this group.
        Authorization: `Bearer ${check.token}`,
      },
      body: JSON.stringify({ preview: { group_id: groupId, inviter_email: check.email } }),
    })
    const json = (await res.json().catch(() => null)) as { invite?: unknown; reminder?: unknown } | null
    if (!res.ok || !json?.invite || !json?.reminder) {
      return Response.json({ error: 'Preview unavailable' }, { status: 502 })
    }
    return Response.json({ invite: json.invite, reminder: json.reminder })
  } catch {
    return Response.json({ error: 'Preview unavailable' }, { status: 502 })
  }
}

/**
 * "Send now" for employee invitations (Keith 2026-09-30). The rows are
 * already in employer_invitations (add_employer_invitations); the
 * employer-invites edge function sends everything pending on an hourly
 * cron. This route asks it to run for one group right away so the button
 * acts now. If that call fails, the cron still picks the rows up, so the
 * caller gets {queued: true} rather than an error.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { group_id?: string } | null
  const groupId = body?.group_id
  const check = await requireGroupAdmin(request, groupId)
  if (!check.ok) return check.res

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The admin's own sign-in: the function checks they admin this group.
        Authorization: `Bearer ${check.token}`,
      },
      body: JSON.stringify({ group_id: groupId }),
    })
    if (!res.ok) {
      return Response.json({ queued: true })
    }
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return Response.json(json ?? { queued: true })
  } catch {
    return Response.json({ queued: true })
  }
}
