import 'server-only'
import type { NextRequest } from 'next/server'

/**
 * One call to Shift's report-route-issue function from this site's server,
 * the way /api/commute/report-route and /api/spot/report make it: the
 * service-role key in x-advisor-key and the visitor's IP in
 * x-advisor-client-ip (the function hashes it before use and rate-limits on
 * it). The key and the IP never reach the browser. Used by /api/notes/add
 * and /api/notes/vote.
 */

export function clientIp(req: NextRequest): string {
  return (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
}

export function routeIssueConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

export async function forwardRouteIssue(
  req: NextRequest,
  body: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const ip = clientIp(req)
  const res = await fetch(`${base}/functions/v1/report-route-issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'x-advisor-key': key,
      ...(ip ? { 'x-advisor-client-ip': ip } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {} }
}

/** The function's refusal, passed on: its 400 and 429 as they are, anything else as 502. */
export function routeIssueStatus(status: number): number {
  return status === 429 || status === 400 ? status : 502
}

/** The site's version from here, never the browser's. */
export function siteVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  return sha ? `web-${sha.slice(0, 7)}` : 'web'
}
