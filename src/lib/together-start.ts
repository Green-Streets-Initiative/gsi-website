import { supabase } from '@/lib/supabase'
import { TERMS_VERSION, type PartnerDay } from '@/lib/together'

/**
 * The one-minute ask on /together/start (Shift 01854, Keith 2026-11-19):
 * saved before sign-in, read back after the email link, then saved through
 * the app's own calls (lib/together.ts) and marked done with its source.
 */
export type AskPlace = { address: string; lat: number; lng: number; placeId?: string | null }
export type Ask = { home: AskPlace; work: AskPlace; days: PartnerDay[]; claimed: boolean }

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const

/** The campaign tags on the page's address (?utm_source=meta&utm_content=route). */
export function utmFromUrl(): Record<string, string> {
  const p = new URLSearchParams(window.location.search)
  const out: Record<string, string> = {}
  for (const k of UTM_KEYS) {
    const v = p.get(k)
    if (v) out[k] = v.slice(0, 80)
  }
  return out
}

export async function startAsk(a: {
  email: string; home: AskPlace; work: AskPlace; days: PartnerDay[]; utm: Record<string, string>; locale: string
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc('start_together_ask', {
    p_email: a.email,
    p_home: a.home,
    p_work: a.work,
    p_days: a.days,
    p_terms_version: TERMS_VERSION,
    p_utm: a.utm,
    p_locale: a.locale,
  })
  if (error) return { ok: false, reason: 'network' }
  const r = data as { ok?: boolean; id?: string; reason?: string } | null
  return r?.ok && r.id ? { ok: true, id: r.id } : { ok: false, reason: r?.reason ?? 'failed' }
}

export async function takeAsk(id: string): Promise<{ ok: true; ask: Ask } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc('take_together_ask', { p_id: id })
  if (error) return { ok: false, reason: 'network' }
  const r = data as ({ ok?: boolean; reason?: string } & Partial<Ask>) | null
  if (!r?.ok || !r.home || !r.work) return { ok: false, reason: r?.reason ?? 'failed' }
  return { ok: true, ask: { home: r.home, work: r.work, days: (r.days ?? []) as PartnerDay[], claimed: !!r.claimed } }
}

export async function finishAsk(id: string): Promise<void> {
  await supabase.rpc('finish_together_ask', { p_id: id })
}
