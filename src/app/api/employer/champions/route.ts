import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type AdminCheck = { ok: true; email: string; token: string } | { ok: false; res: Response }

const FUNCTION_URL = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-champions`

/** Signed-in admin of `groupId` (or a GSI admin). Both routes email or show
 *  the champion welcome, so viewers are refused. Same check as the
 *  invitations route. */
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
  if (adminRes.data?.role !== 'admin' && adminRes.data?.role !== 'manager' && !gsiRes.data) {
    return { ok: false, res: Response.json({ error: 'Only workspace admins can email champions' }, { status: 403 }) }
  }
  return { ok: true, email: user.email, token }
}

/**
 * The champion welcome exactly as champions get it, with this company's
 * name, code and flyer (the Setup page's "How this looks to them"). Nothing
 * is sent. GET /api/employer/champions?group_id=<uuid>&name=<first champion>
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const groupId = params.get('group_id')
  const name = (params.get('name') ?? '').trim().slice(0, 120)
  const check = await requireGroupAdmin(request, groupId)
  if (!check.ok) return check.res
  try {
    const res = await fetch(FUNCTION_URL(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The admin's own sign-in: the function checks they admin this group.
        Authorization: `Bearer ${check.token}`,
      },
      body: JSON.stringify({ preview: { group_id: groupId, ...(name ? { name } : {}) } }),
    })
    const json = (await res.json().catch(() => null)) as { subject?: unknown; html?: unknown } | null
    if (!res.ok || typeof json?.subject !== 'string' || typeof json?.html !== 'string') {
      return Response.json({ error: 'Preview unavailable' }, { status: 502 })
    }
    return Response.json({ subject: json.subject, html: json.html })
  } catch {
    return Response.json({ error: 'Preview unavailable' }, { status: 502 })
  }
}

/**
 * "Send the welcome email" on Setup. Only the button calls this; saving
 * Setup never does. The function welcomes each champion at most once per
 * company (employer_champions), so a second click only reaches people
 * added since. Body: {group_id, champions: [{name, email}]}.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { group_id?: string; champions?: { name?: unknown; email?: unknown }[] }
    | null
  const groupId = body?.group_id
  const check = await requireGroupAdmin(request, groupId)
  if (!check.ok) return check.res

  const champions = (Array.isArray(body?.champions) ? body.champions : [])
    .map((c) => ({
      name: typeof c?.name === 'string' ? c.name.trim() : '',
      email: typeof c?.email === 'string' ? c.email.trim() : '',
    }))
    .filter((c) => c.email)
  if (champions.length === 0) return Response.json({ error: 'no_champions' }, { status: 400 })

  try {
    const res = await fetch(FUNCTION_URL(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${check.token}`,
      },
      body: JSON.stringify({ send: { group_id: groupId, champions } }),
    })
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok || !json?.ok) {
      return Response.json({ error: (json?.error as string | undefined) ?? 'send_failed' }, { status: res.status === 503 ? 503 : 502 })
    }
    return Response.json(json)
  } catch {
    return Response.json({ error: 'send_failed' }, { status: 502 })
  }
}
