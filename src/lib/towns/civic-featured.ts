import type { TownCivicEvent, TownResource } from '@/lib/towns/queries'

/**
 * Shared "what's happening now" selection for a town — used by BOTH the
 * town page's Get Involved section (TownSections.tsx) and the town digest
 * email (digest.ts). Extracted so the page and the email can never drift:
 * same merge of pipeline civic items + hand-entered dated resources, same
 * dedupe, same 30-day horizon, same ET-safe formatting.
 *
 * All town pages are Massachusetts — format meeting times in ET explicitly.
 * Vercel renders in UTC; relying on server-local time showed the July 14
 * McGrath meeting as "11:00 PM" in production (caught 07-13).
 */

export const TOWN_TZ = 'America/New_York'

export function featuredDateChip(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TOWN_TZ }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TOWN_TZ })
  )
}

/** Date-only strings ("2026-07-16") — no timezone round-trip at all. */
export function dateOnlyChip(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

/** Wall-clock "19:00[:00]" → "7:00 PM" — pipeline times are already local. */
export function wallTime(hhmm: string | null): string | null {
  const m = hhmm?.match(/^(\d{2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`
}

export function sigTokens(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 4))
}

export const etDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: TOWN_TZ })

export interface FeaturedItem {
  key: string
  chip: string
  title: string
  desc: string | null
  label: string
  href: string
  sort: number
  /** Set when the item came from the hearings pipeline. */
  civic?: TownCivicEvent
  /** Set when the item is a hand-entered dated resource. */
  resource?: TownResource
}

export interface FeaturedSelection {
  /** Timely items within (now, now+30d), soonest first. */
  candidates: FeaturedItem[]
  /** Dated resource ids that duplicate a pipeline item (pipeline wins). */
  civicDupIds: Set<string>
}

export function buildFeaturedCandidates(
  civicEvents: TownCivicEvent[],
  resources: TownResource[],
  linkFor: (url: string | null) => string,
  now: number = Date.now(),
  horizonDays = 30,
): FeaturedSelection {
  const horizon = now + horizonDays * 24 * 3600 * 1000

  // Pipeline items (admin-published meetings/hearings/comment periods).
  // Fully undated items are open-ended feedback windows: always in-window,
  // ranked after anything with a real date.
  const civicFeatured: FeaturedItem[] = civicEvents
    .map((ce) => {
      const sort = ce.hearing_date
        ? new Date(`${ce.hearing_date}T${(ce.hearing_time ?? '12:00').slice(0, 5)}:00-04:00`).getTime()
        : ce.comment_deadline
        ? new Date(`${ce.comment_deadline}T23:59:00-04:00`).getTime()
        : horizon - 60000
      const t = wallTime(ce.hearing_time)
      const chip = ce.hearing_date
        ? dateOnlyChip(ce.hearing_date) + (t ? ` · ${t}` : '') + (ce.hearing_type === 'virtual' ? ' · virtual' : '')
        : ce.comment_deadline
        ? `Comment by ${dateOnlyChip(ce.comment_deadline)}`
        : 'Open for feedback'
      return {
        key: `civic-${ce.id}`,
        chip,
        title: ce.title,
        desc: ce.description,
        label: ce.action_label ?? (ce.virtual_link ? 'Register' : 'See details'),
        href: linkFor(ce.virtual_link ?? ce.source_url),
        sort,
        civic: ce,
      }
    })
    .filter((f) => f.sort > now && f.sort < horizon)

  // Hand-entered dated resources still work — but the pipeline wins when both
  // carry the same meeting (same ET date + shared title tokens).
  const isDupOfCivic = (r: TownResource) =>
    civicEvents.some((ce) => {
      if (!ce.hearing_date || !r.happens_at) return false
      if (etDate(r.happens_at) !== ce.hearing_date) return false
      const a = sigTokens(r.name)
      let shared = 0
      for (const t of sigTokens(ce.title)) if (a.has(t)) shared++
      return shared >= 2
    })

  const civicDupIds = new Set(resources.filter((r) => r.happens_at && isDupOfCivic(r)).map((r) => r.id))
  const datedResources = resources.filter((r) => {
    if (!r.happens_at || civicDupIds.has(r.id)) return false
    const t = new Date(r.happens_at).getTime()
    return t > now && t < horizon
  })
  const resourceFeatured: FeaturedItem[] = datedResources.map((r) => ({
    key: `res-${r.id}`,
    chip: featuredDateChip(r.happens_at!),
    title: r.name,
    desc: r.description,
    label: r.action_label ?? 'See details',
    href: linkFor(r.url),
    sort: new Date(r.happens_at!).getTime(),
    resource: r,
  }))

  return {
    candidates: [...civicFeatured, ...resourceFeatured].sort((a, b) => a.sort - b.sort),
    civicDupIds,
  }
}
