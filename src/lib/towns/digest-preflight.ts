import 'server-only'
import type { TownCivicEvent } from '@/lib/towns/queries'

/**
 * Checks a town digest makes before it goes out (Keith 2026-11-02). Plain
 * page loads, no model calls:
 *
 *  - every link an item sends people to still answers, and its form isn't
 *    closed. The Davis Square survey went out on 2026-11-02 as "open for
 *    feedback now" while its form said "This survey is now closed" with a
 *    200, five weeks after its Sept 27 deadline.
 *  - an item isn't a meeting the town was already told about under another
 *    record. Two watchers (SomerVoice and the city's news releases) each
 *    listed the Nov 4 Broadway/Magoun open house, so Somerville got it as
 *    news on Oct 26 and again on Nov 2.
 *
 * An item that fails is left out of today's email and stays eligible, so a
 * link that was only briefly down goes out the next day.
 */

/** What a closed online form says while still answering 200. Keep in step
 *  with CLOSED_FORM in Shift supabase/functions/_shared/civic-staging.ts. */
export const CLOSED_FORM =
  /\b(survey|form|questionnaire|registration) (is|has) (now )?(closed|ended)\b|no longer accepting (responses|submissions|registrations)|is not (currently )?accepting (responses|submissions)|this (form|survey) is (currently )?(closed|unavailable|disabled)|survey has (ended|expired)|registration (for this (event|meeting) )?(is|has) closed/i

/** Form services, where a page saying "closed" is about the form itself. A
 *  project page can say "our concept design survey is now closed" about an
 *  earlier round while the link is current (somervillema.gov/broadwaymagoun,
 *  2026-11-02), so other pages are never read for it. Keep in step with
 *  FORM_HOST in Shift supabase/functions/_shared/civic-staging.ts. */
export const FORM_HOST =
  /(^|\.)(jotform\.com|surveymonkey\.com|forms\.gle|forms\.office\.com|forms\.cloud\.microsoft|typeform\.com|alchemer\.com|surveygizmo\.com|qualtrics\.com|formstack\.com|cognitoforms\.com|wufoo\.com|smartsheet\.com|survey123\.arcgis\.com|polco\.us|zoho\.com)$/i

function isFormPage(url: string): boolean {
  try {
    const u = new URL(url)
    return FORM_HOST.test(u.hostname) || (u.hostname === 'docs.google.com' && u.pathname.startsWith('/forms'))
  } catch {
    return false
  }
}

const UA ='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

/**
 * Why this link shouldn't go in an email, or null when it's fine. Only the
 * form/registration link is read for "closed" wording, and only when it lands
 * on a form service: a notice page about a street closure says "closed" for
 * other reasons. Sites that refuse robots
 * (401/403/429) aren't held against the item; a person's browser gets in.
 */
export async function linkProblem(url: string, opts: { readForClosed: boolean }): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    })
    if ([401, 403, 429].includes(res.status)) {
      await res.body?.cancel()
      return null
    }
    if (!res.ok) {
      await res.body?.cancel()
      return `${url} answered ${res.status}`
    }
    if (!opts.readForClosed || !isFormPage(res.url || url)) {
      await res.body?.cancel()
      return null
    }
    const text = (await res.text())
      .slice(0, 400_000)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    const m = text.match(CLOSED_FORM)
    return m ? `${url} says "${m[0]}"` : null
  } catch {
    return `${url} did not respond`
  }
}

/** The first problem with an item's links, or null. */
export async function itemProblem(item: TownCivicEvent): Promise<string | null> {
  const checks: Promise<string | null>[] = []
  if (item.virtual_link) checks.push(linkProblem(item.virtual_link, { readForClosed: true }))
  if (item.source_url && item.source_url !== item.virtual_link) {
    checks.push(linkProblem(item.source_url, { readForClosed: false }))
  }
  return (await Promise.all(checks)).find((p) => p) ?? null
}

const GENERIC = new Set([
  'project', 'projects', 'open', 'house', 'meeting', 'public', 'hearing', 'virtual', 'community',
  'design', 'designs', 'updated', 'update', 'reconstruction', 'redesign', 'improvement', 'improvements',
  'street', 'square', 'avenue', 'road', 'safety', 'plan', 'session', 'workshop', 'online', 'person',
  'city', 'town', 'with', 'from', 'about', 'into', 'your',
])

function nameWords(item: TownCivicEvent, townNames: string[]): Set<string> {
  const towns = new Set(townNames.map((t) => t.toLowerCase()))
  const text = `${item.community_name ?? ''} ${item.digest_headline ?? ''} ${item.title}`.toLowerCase()
  return new Set(text.split(/[^a-z]+/).filter((w) => w.length >= 4 && !GENERIC.has(w) && !towns.has(w)))
}

/**
 * Same meeting under two records: same day and start time, and the titles
 * share at least two distinctive words ("broadway", "magoun"). Two different
 * meetings in one town at the same hour about different streets don't match.
 */
export function sameMeeting(a: TownCivicEvent, b: TownCivicEvent, townNames: string[]): boolean {
  if (a.id === b.id || !a.hearing_date || a.hearing_date !== b.hearing_date) return false
  if ((a.hearing_time ?? '').slice(0, 5) !== (b.hearing_time ?? '').slice(0, 5)) return false
  const wa = nameWords(a, townNames)
  let shared = 0
  for (const w of nameWords(b, townNames)) if (wa.has(w)) shared++
  return shared >= 2
}
