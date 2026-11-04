import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Whether the New Routes movers' offer is open right now, read from the
 * campaign row (Shift's `newroutes_config`) so no page can outlive or
 * misstate it. Open means enabled and inside the sign-up window, the same
 * rule GuideOffer uses. Fails CLOSED: showing a reward we no longer offer is
 * the worse error.
 *
 * Partner pages live on in welcome emails and printed packets long after the
 * window closes (Dec 15, 2026), so /move-in, the print sheet and the
 * /api/nearby/newroutes check behind /nearby all ask this, never a hard-coded
 * date or amount.
 *
 * Its own client with uncached fetches: the print page renders inside the
 * data cache (its snapshot model is cached for Vercel), and a cached answer
 * here would keep an offer on, or off, past the moment it changed.
 */
const noStore: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

export interface NewRoutesOffer {
  /** "$15" */
  dollars: string
  signupEnd: string
}

export async function loadNewRoutesOffer(): Promise<NewRoutesOffer | null> {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStore },
    })
    const { data } = await sb
      .from('newroutes_config')
      .select('enabled, signup_start, signup_end, value_cents')
      .eq('id', true)
      .maybeSingle()
    const row = data as { enabled: boolean; signup_start: string; signup_end: string; value_cents: number } | null
    if (!row?.enabled) return null
    const now = Date.now()
    if (now < new Date(row.signup_start).getTime() || now > new Date(row.signup_end).getTime()) return null
    return { dollars: `$${Math.round(row.value_cents / 100)}`, signupEnd: row.signup_end }
  } catch {
    return null
  }
}

