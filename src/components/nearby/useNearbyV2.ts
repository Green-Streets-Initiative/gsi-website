'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'

/**
 * Around You v2 is on for the people in app_feature_flag_users under
 * `around_you_v2` (Shift 01581: Keith and Meghan Keaney), and only when they
 * are signed in on this site. Everyone else gets today's page.
 *
 * Signing in: /nearby?signin=1 shows a one-field email form (NearbySignIn);
 * the link comes back here as ?token_hash=, the same flow Shift Together uses.
 * The last answer is kept for the browser session so a reload doesn't flash
 * the old page first.
 */

const FLAG = 'around_you_v2'
const CACHE_KEY = 'nearby:v2:on'

export type V2State = { on: boolean; signedIn: boolean; checked: boolean }

function cached(): boolean {
  try { return sessionStorage.getItem(CACHE_KEY) === '1' } catch { return false }
}

export function useNearbyV2(): V2State {
  const [state, setState] = useState<V2State>({ on: false, signedIn: false, checked: false })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // The last answer first (after hydration), then the real check
      if (cached()) setState(s => ({ ...s, on: true }))
      try {
        const params = new URLSearchParams(window.location.search)
        // Local preview only (next dev): ?v2=1 shows the new view signed out
        if (process.env.NODE_ENV === 'development' && params.get('v2') === '1') {
          if (!cancelled) setState({ on: true, signedIn: true, checked: true })
          return
        }
        const tokenHash = params.get('token_hash')
        const type = params.get('type')
        if (tokenHash && (type === 'email' || type === 'magiclink')) {
          await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
          params.delete('token_hash')
          params.delete('type')
          params.delete('signin')
          const rest = params.toString()
          window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
        }
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          try { sessionStorage.removeItem(CACHE_KEY) } catch { /* private mode */ }
          if (!cancelled) setState({ on: false, signedIn: false, checked: true })
          return
        }
        const on = await aroundYouV2On(session.user.id)
        try { if (on) sessionStorage.setItem(CACHE_KEY, '1'); else sessionStorage.removeItem(CACHE_KEY) } catch { /* private mode */ }
        if (on) posthog.capture('nearby_v2_shown')
        if (!cancelled) setState({ on, signedIn: true, checked: true })
      } catch {
        if (!cancelled) setState(s => ({ ...s, checked: true }))
      }
    })()
    return () => { cancelled = true }
  }, [])

  return state
}

/** Same rule as the app's isFlagOnForUser: a user row wins, then the flag's
 *  own switch and rollout (float FNV bucket, never Math.imul). Also gates the
 *  organizer console's avoid-a-street (lib/organizers/avoid-street). */
export async function aroundYouV2On(userId: string): Promise<boolean> {
  const [flag, mine] = await Promise.all([
    supabase.from('app_feature_flags').select('enabled, rollout_percent').eq('name', FLAG).maybeSingle(),
    supabase.from('app_feature_flag_users').select('user_id').eq('flag_name', FLAG).eq('user_id', userId).maybeSingle(),
  ])
  if (!mine.error && mine.data) return true
  const f = flag.data as { enabled: boolean; rollout_percent: number | null } | null
  if (flag.error || !f?.enabled) return false
  const pct = f.rollout_percent ?? 0
  if (pct >= 100) return true
  let h = 2166136261
  for (let i = 0; i < userId.length; i++) { h ^= userId.charCodeAt(i); h = (h * 16777619) >>> 0 }
  return pct > 0 && h % 100 < pct
}

/** ?signin=1 asks for the email form (only shown while signed out). */
export function wantsSignIn(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('signin') === '1'
}
