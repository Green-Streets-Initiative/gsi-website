// The app's language for what the assistants' servers write themselves:
// approval cards, step lines ("Looking for rides and events") and button
// labels. The model already answers in the person's language; these strings
// are built in code, in English (parity gap gap-assistant-english, Keith
// 2026-11-07: "Can we work on those 'still not covered' items?").
//
// Only the app gets them translated. It sends its own language exactly
// ("es", "pt-BR", "zh-Hans"; Shift lib/assistant.ts). A browser sends a list
// ("es-ES,es;q=0.9") and stays in English, like the website's pages around it.
//
// A small model translates; a miss or a slow answer leaves the English, so a
// card is never held up or lost. Step lines and buttons repeat, so each
// translation is kept for the life of the server.

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AppLang = 'es' | 'pt-BR' | 'zh-Hans'

const NAMES: Record<AppLang, string> = { es: 'Spanish', 'pt-BR': 'Brazilian Portuguese', 'zh-Hans': 'Simplified Chinese' }
const MODEL = 'claude-haiku-5-5'
const MAX_CACHE = 4000

export function appLanguage(request: Request): AppLang | null {
  const v = request.headers.get('accept-language')?.trim()
  return v === 'es' || v === 'pt-BR' || v === 'zh-Hans' ? v : null
}

export type OnUsage = (model: string, usage: Anthropic.Usage) => void

/** Translation calls in ai_usage_log under the assistant's own name, feature translate. */
export function usageLogger(admin: SupabaseClient, fn: string): OnUsage {
  return (model, u) => {
    void admin.from('ai_usage_log').insert({
      fn, feature: 'translate', model,
      input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0,
      cache_read_tokens: u.cache_read_input_tokens ?? 0, cache_write_tokens: u.cache_creation_input_tokens ?? 0,
    }).then(({ error }) => { if (error) console.warn(`[${fn}] usage log failed`, error.message) })
  }
}

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<void>>()
const key = (lang: AppLang, en: string) => `${lang}\u0000${en}`
const remember = (k: string, v: string) => {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string)
  cache.set(k, v)
}

/** Kept exactly, whatever the language: product and place names. */
const KEEP = 'Shift, Shift Together, Go together, Green Streets, Bluebikes, Roam, MBTA, CharlieCard, Ride with GPS, Street View'

/** Texts per model call: the step lines of a whole assistant (~70) in one
 *  call took 11 s and 3,200 tokens in Chinese; batches of this size run side
 *  by side in about 4 s. */
const BATCH = 25

async function translateBatch(lang: AppLang, batch: string[], onUsage?: OnUsage): Promise<void> {
  const msg = await new Anthropic({ timeout: 20_000, maxRetries: 0 }).messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Translate each string in this JSON array into ${NAMES[lang]}. They are short labels, buttons and lines on cards in a transportation app (walking, biking, transit, carpools), shown to a member who uses the app in ${NAMES[lang]}. Keep them as short and plain as the English, sentence case. Keep these names as they are: ${KEEP}. Keep people's names, place and street names, ride and group names, email addresses, numbers, dates, times and anything inside quotation marks or ⟦ ⟧ exactly as written.\n\n${JSON.stringify(batch)}\n\nAnswer with only a JSON array of ${batch.length} strings, in the same order.`,
    }],
  })
  onUsage?.(msg.model, msg.usage)
  const said = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
  const arr = JSON.parse(said.slice(said.indexOf('['), said.lastIndexOf(']') + 1)) as unknown
  if (!Array.isArray(arr) || arr.length !== batch.length) throw new Error('translation came back the wrong length')
  batch.forEach((en, i) => { const v = arr[i]; if (typeof v === 'string' && v.trim()) remember(key(lang, en), v) })
}

/** Each text in the app's language, in order. Texts already translated come
 *  from the cache; the rest go to the model in batches. Any failure, or no
 *  answer within `waitMs`, gives back the English for what wasn't cached. */
export async function translateTexts(lang: AppLang, texts: string[], onUsage?: OnUsage, waitMs = 8000): Promise<string[]> {
  const uncached = [...new Set(texts.filter((t) => t.trim() && !cache.has(key(lang, t))))]
  // Texts another request is already translating wait on that call.
  const waiting = [...new Set(uncached.flatMap((t) => { const p = inflight.get(key(lang, t)); return p ? [p] : [] }))]
  const missing = uncached.filter((t) => !inflight.has(key(lang, t)))
  const calls: Promise<void>[] = []
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH)
    const call = translateBatch(lang, batch, onUsage)
      .catch((e) => console.warn('[assistant] translation failed', e instanceof Error ? e.message : e))
      .finally(() => { for (const t of batch) inflight.delete(key(lang, t)) })
    for (const t of batch) inflight.set(key(lang, t), call)
    calls.push(call)
  }
  if (calls.length || waiting.length) {
    await Promise.race([Promise.all([...calls, ...waiting]), new Promise((r) => setTimeout(r, waitMs))])
  }
  return texts.map((t) => cache.get(key(lang, t)) ?? t)
}

/** Text that is never machine-translated: the agreement people accept, in
 *  the app's own reviewed words. Keyed by the exact English. */
export type Fixed = Record<string, Partial<Record<AppLang, string>>>

type CardLike = { title: string; lines: string[]; cta: string }

/** A card in the app's language. A fixed passage is swapped for a marker
 *  before translating and put back in the app's words after; a line whose
 *  marker didn't survive stays in English. The typed confirmation word, if
 *  any, is left alone: it's what the person has to type. */
export async function translateCard<C extends CardLike>(lang: AppLang, card: C, fixed: Fixed = {}, onUsage?: OnUsage): Promise<C> {
  const passages = Object.keys(fixed).filter((en) => fixed[en][lang])
  const mark = (t: string) => passages.reduce((s, en, i) => s.split(en).join(`⟦${i + 1}⟧`), t)
  const unmark = (t: string, en: string) => {
    let out = t
    for (const [i, p] of passages.entries()) {
      const m = `⟦${i + 1}⟧`
      if (!mark(en).includes(m)) continue
      if (!out.includes(m)) return en
      out = out.split(m).join(fixed[p][lang]!)
    }
    return out
  }
  const texts = [card.title, ...card.lines, card.cta]
  const done = await translateTexts(lang, texts.map(mark), onUsage)
  const back = done.map((t, i) => unmark(t, texts[i]))
  return { ...card, title: back[0], lines: back.slice(1, -1), cta: back[back.length - 1] }
}

/** Step lines and button labels: one call per batch, cached after; a slow
 *  answer gives the English rather than holding the reply. */
export async function translateLabels(lang: AppLang, labels: string[], onUsage?: OnUsage): Promise<string[]> {
  return translateTexts(lang, labels, onUsage, 2500)
}

/** For the live stream: a step line, a button, a card, in the app's language
 *  (or as they are, for English and the website). */
export function localizer(lang: AppLang | null, fixed: Fixed, onUsage?: OnUsage) {
  return {
    label: async (l: string): Promise<string> => (lang && l ? (await translateLabels(lang, [l], onUsage))[0] : l),
    link: async <L extends { label: string }>(l: L | undefined): Promise<L | undefined> =>
      (lang && l ? { ...l, label: (await translateLabels(lang, [l.label], onUsage))[0] } : l),
    card: async <C extends CardLike>(c: C): Promise<C> => (lang ? translateCard(lang, c, fixed, onUsage) : c),
    /** Fills the cache with every step line while the model thinks. */
    warm: (labels: string[]) => { if (lang) void translateLabels(lang, labels, onUsage) },
  }
}

/** A reopened conversation: its step lines and buttons, in one call. */
export async function translateToolItems<T extends { kind: string; label?: string; link?: { label: string } }>(
  lang: AppLang | null, items: T[], onUsage?: OnUsage,
): Promise<T[]> {
  if (!lang) return items
  const tools = items.filter((i) => i.kind === 'tool')
  const texts = tools.flatMap((i) => [i.label ?? '', i.link?.label ?? ''])
  const done = await translateLabels(lang, texts, onUsage)
  const byItem = new Map(tools.map((i, n) => [i, n]))
  return items.map((i) => {
    const n = byItem.get(i)
    if (n == null) return i
    return { ...i, ...(i.label ? { label: done[n * 2] } : {}), ...(i.link ? { link: { ...i.link, label: done[n * 2 + 1] } } : {}) }
  })
}
