import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { signEmployerReportToken, EMPLOYER_REPORT_TOKEN_TTL_SECONDS } from '@/lib/employer-report-token'
import { isImpactRangeKey, isCustomDates } from '@/lib/impact-range'

/**
 * POST { groupId, range, from?, to? } → { url, expires_at }
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

  let body: { groupId?: unknown; range?: unknown; from?: unknown; to?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'groupId and range required' }, { status: 400 })
  }
  const groupId = typeof body.groupId === 'string' ? body.groupId : null
  const custom = { from: body.from, to: body.to }
  const range = isImpactRangeKey(body.range)
    ? body.range
    : body.range === 'custom' && isCustomDates(custom, Date.now())
      ? ('custom' as const)
      : null
  if (!groupId || !/^[0-9a-f-]{36}$/i.test(groupId) || !range) {
    return Response.json({ error: 'groupId and range required' }, { status: 400 })
  }

  const sb = createServerSupabaseClient()
  const [adminRes, gsiRes, groupRes] = await Promise.all([
    sb.from('group_admins').select('role').eq('group_id', groupId).eq('email', user.email).maybeSingle(),
    sb.from('school_roles').select('role').eq('user_id', user.id).eq('role', 'gsi_admin').maybeSingle(),
    sb.from('groups').select('tier').eq('id', groupId).maybeSingle(),
  ])

  const onPortal = ['admin', 'manager', 'viewer'].includes(adminRes.data?.role ?? '')
  const isGsiAdmin = !!gsiRes.data
  if (!onPortal && !isGsiAdmin) {
    return Response.json({ error: 'This account is not on that workplace portal' }, { status: 403 })
  }
  // Custom dates come with Basic and up (lib/employer/plans.ts).
  if (range === 'custom' && !isGsiAdmin && !['basic', 'standard', 'premium'].includes(groupRes.data?.tier ?? '')) {
    return Response.json({ error: 'Custom dates come with the Basic plan and up' }, { status: 403 })
  }

  if (!process.env.EMPLOYER_REPORT_TOKEN_SECRET) {
    return Response.json({ error: 'Report links are not configured on this server' }, { status: 500 })
  }

  const dates = range === 'custom' ? (custom as { from: string; to: string }) : undefined
  const t = signEmployerReportToken(groupId, range, user.email, dates)
  const origin = new URL(request.url).origin
  const url = `${origin}/shift/employers/report?group=${encodeURIComponent(groupId)}&range=${range}${dates ? `&from=${dates.from}&to=${dates.to}` : ''}&t=${t}`
  const expiresAt = new Date(Date.now() + EMPLOYER_REPORT_TOKEN_TTL_SECONDS * 1000).toISOString()
  return Response.json({ url, expires_at: expiresAt })
}
