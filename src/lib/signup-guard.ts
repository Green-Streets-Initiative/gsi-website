/*
 * Bot checks for the website's email sign-ups (Shift product item 33).
 *
 * 2026-11: a script added 50 strangers' addresses to Newton's town digest,
 * posting straight to the old town sign-up route (most never loaded the page,
 * a few drove a real browser). Two checks now stand in front of every sign-up:
 *
 *  - the hidden `website` field people never fill in (a form-filling bot
 *    does), checked here;
 *  - Cloudflare Turnstile, which a script that skips the page can't pass and
 *    real people almost never see. The form sends its token; Shift's
 *    email-subscriptions function verifies it (so a script can't go around the
 *    website to the function either) and answers error "verify" when it fails.
 *
 * Every blocked sign-up is counted in PostHog as `email_signup_blocked`
 * {reason, topic, town}, so a new wave shows up on its own. No address is
 * ever sent.
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_tZDqVkUx4TmwYokjRBVLpEBpycp4PZWCr9bWEbN3SBpb'

export type BlockReason = 'honeypot' | 'turnstile' | 'retired_route'

/** The visitor's IP, passed to Turnstile's check (Cloudflare weighs it; it is not stored). */
export function clientIp(req: Request): string {
  return (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64)
}

export function isHoneypot(body: Record<string, unknown>): boolean {
  return typeof body.website === 'string' && body.website.trim() !== ''
}

/** Count a blocked sign-up (log line + PostHog event). Never includes the address. */
export async function recordBlocked(reason: BlockReason, topic: unknown, town: unknown): Promise<void> {
  const t = typeof topic === 'string' ? topic.slice(0, 40) : 'unknown'
  const townSlug = typeof town === 'string' ? town.slice(0, 60) : null
  console.warn(`[signup-guard] blocked reason=${reason} topic=${t} town=${townSlug ?? '-'}`)
  try {
    await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: 'email_signup_blocked',
        distinct_id: 'gsi-website-signup-guard',
        properties: { reason, topic: t, town: townSlug, $process_person_profile: false },
      }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    /* counting must never break the answer */
  }
}
