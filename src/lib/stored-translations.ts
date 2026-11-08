import 'server-only'
import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { SiteLocale } from '@/lib/site-i18n'

/**
 * Stored content (Roam names and text, Roam stops, badges) in the page's
 * language (translation plan, batch 8). Translations live in Shift's
 * content_item_translations under ids "roam:<id>", "roam_checkpoint:<id>",
 * "badge:<id>", with the translated columns in `fields` (Shift migration
 * 01701); the app reads the same rows (Shift lib/stored-translations.ts).
 * English, a missing translation or any error keeps the English. A
 * translation is removed when its English is edited, so none goes stale.
 */

export type StoredKind = 'badge' | 'roam' | 'roam_checkpoint'
type Dict = Map<string, Record<string, string>>

/** One query per request per language. */
const dictFor = cache(async (locale: SiteLocale): Promise<Dict> => {
  const dict: Dict = new Map()
  if (locale === 'en') return dict
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('content_item_translations')
      .select('content_item_id, fields')
      .eq('locale', locale)
      .or('content_item_id.like.roam:*,content_item_id.like.roam_checkpoint:*,content_item_id.like.badge:*')
      .limit(5000)
    if (error) return dict
    for (const row of (data ?? []) as Array<{ content_item_id: string; fields: Record<string, unknown> | null }>) {
      const clean: Record<string, string> = {}
      for (const [k, v] of Object.entries(row.fields ?? {})) if (typeof v === 'string' && v.trim()) clean[k] = v
      dict.set(row.content_item_id, clean)
    }
  } catch {
    // English it is.
  }
  return dict
})

function apply<T extends object>(dict: Dict, kind: StoredKind, id: unknown, row: T): T {
  const t = id == null ? undefined : dict.get(`${kind}:${String(id)}`)
  if (!t) return row
  const out = { ...row } as Record<string, unknown>
  for (const [col, value] of Object.entries(t)) if (typeof out[col] === 'string') out[col] = value
  return out as T
}

/** Roam cards (the hub): name, hook, tagline in the page's language. */
export async function localizeRoams<T extends { id: string }>(roams: T[], locale: SiteLocale): Promise<T[]> {
  if (locale === 'en' || !roams.length) return roams
  const dict = await dictFor(locale)
  return dict.size ? roams.map((r) => apply(dict, 'roam', r.id, r)) : roams
}

/** A Roam page: the Roam's text and every stop's label and description. */
export async function localizeRoamDetail<T extends { id: string; checkpoints: Array<{ id: string }> }>(
  roam: T | null,
  locale: SiteLocale,
): Promise<T | null> {
  if (!roam || locale === 'en') return roam
  const dict = await dictFor(locale)
  if (!dict.size) return roam
  const r = apply(dict, 'roam', roam.id, roam)
  return { ...r, checkpoints: roam.checkpoints.map((c) => apply(dict, 'roam_checkpoint', c.id, c)) }
}
