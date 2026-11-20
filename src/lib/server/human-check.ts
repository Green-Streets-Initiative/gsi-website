import 'server-only'
import { clientIp } from '@/lib/signup-guard'

/*
 * Cloudflare Turnstile for the website's message forms (contact, volunteer).
 * 2026-11-20: a data-licensing pitch came through the contact form about once
 * a day from rotating domains, past the hidden trap field. The email sign-ups
 * already had Turnstile (lib/useTurnstile, lib/signup-guard); these forms now
 * send the same token.
 *
 * The secret lives only in Supabase, so this asks the turnstile-verify
 * function (supabase/functions/turnstile-verify) rather than Cloudflare
 * directly. If that check can't be reached, the message goes through: losing
 * a real person's message is worse than one more pitch.
 *
 * Every blocked message is counted in PostHog as `form_blocked` {form, reason}.
 * No name or address is ever sent.
 */

const VERIFY_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/turnstile-verify`
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_tZDqVkUx4TmwYokjRBVLpEBpycp4PZWCr9bWEbN3SBpb'

export type FormName = 'contact' | 'volunteer'

/** True when the request is a person (or the check couldn't run); false to refuse it. */
export async function passesHumanCheck(req: Request, token: unknown, form: FormName): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') return true
  const t = typeof token === 'string' ? token : ''
  if (!t) {
    await recordFormBlocked(form, 'no-token')
    return false
  }
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t, ip: clientIp(req) }),
      signal: AbortSignal.timeout(7000),
    })
    const d = (await res.json()) as { ok?: boolean; reason?: string }
    if (d.ok) return true
    if (d.reason === 'unreachable') return true
    await recordFormBlocked(form, d.reason ?? 'refused')
    return false
  } catch (e) {
    console.error(`[human-check] ${form}: check unavailable, letting it through:`, (e as Error).message)
    return true
  }
}

export async function recordFormBlocked(form: FormName, reason: string): Promise<void> {
  console.warn(`[human-check] blocked form=${form} reason=${reason}`)
  try {
    await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: 'form_blocked',
        distinct_id: 'gsi-website-human-check',
        properties: { form, reason: reason.slice(0, 80), $process_person_profile: false },
      }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    /* counting must never break the answer */
  }
}
