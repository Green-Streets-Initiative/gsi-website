import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { signEmployerReportToken, EMPLOYER_REPORT_TOKEN_TTL_SECONDS } from '@/lib/employer-report-token'
import { isImpactRangeKey } from '@/lib/impact-range'

/**
 * POST { groupId, range } → { url, expires_at }
 *
 * Mints a one-hour link to the printable impact report for a workplace.
 * Anyone on the portal for that workplace may ask (admins and viewers can
 * both see the Impact page), and so may GSI staff. The report page itself
 * renders with the service-role client, so this signature is the whole
 * gate: nothing here is admin-only, but nothing is anonymous either.
 */
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const {
    data: { user },
    error: authErr,
  } = await authClient.auth.getUser(token)
  if (authErr || !user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { groupId?: unknown; range?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'groupId and range required' }, { status: 400 })
  }
  const groupId = typeof body.groupId === 'string' ? body.groupId : null
  const range = isImpactRangeKey(body.range) ? body.range : null
  if (!groupId || !/^[0-9a-f-]{36}$/i.test(groupId) || !range) {
    return Response.json({ error: 'groupId and range required' }, { status: 400 })
  }

  const sb = createServerSupabaseClient()
  const [adminRes, gsiRes] = await Promise.all([
    sb.from('group_admins').select('role').eq('group_id', groupId).eq('email', user.email).maybeSingle(),
    sb.from('school_roles').select('role').eq('user_id', user.id).eq('role', 'gsi_admin').maybeSingle(),
  ])

  const onPortal = ['admin', 'manager', 'viewer'].includes(adminRes.data?.role ?? '')
  const isGsiAdmin = !!gsiRes.data
  if (!onPortal && !isGsiAdmin) {
    return Response.json({ error: 'This account is not on that workplace portal' }, { status: 403 })
  }

  if (!process.env.EMPLOYER_REPORT_TOKEN_SECRET) {
    return Response.json({ error: 'Report links are not configured on this server' }, { status: 500 })
  }

  const t = signEmployerReportToken(groupId, range, user.email)
  const origin = new URL(request.url).origin
  const url = `${origin}/shift/employers/report?group=${encodeURIComponent(groupId)}&range=${range}&t=${t}`
  const expiresAt = new Date(Date.now() + EMPLOYER_REPORT_TOKEN_TTL_SECONDS * 1000).toISOString()
  return Response.json({ url, expires_at: expiresAt })
}
