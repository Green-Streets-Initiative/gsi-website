/**
 * The "Guides" card: every guide for the picked way in, filed under the
 * question a first-week commuter asks, in the order of the trip's stages
 * (what to wear, getting a bike, carrying things, planning the route,
 * riding with traffic or taking the bus, arriving at work, locking up).
 *
 * content_items carries three things worth reading for this: primary_mode
 * (cycling | transit | walking), primary_barrier (weather, gear, routes,
 * planning, bike_parking, safety, carrying, sweating, time, cost) and
 * topics[] (weather, gear, routes, planning, apps, parking, security,
 * safety, infrastructure, mbta-basics, fares, carrying, cargo, bike-share,
 * e-bikes, ...). The barrier is the editor's one call about what the guide
 * is for, so it decides first; topics break ties. Within a question the
 * guides that answer it most directly lead (a route-picking guide before a
 * "when biking is faster" guide under "Planning the route"). Pure, so it
 * can be tested with the library as it stands.
 */

import type { GuideLink } from '@/lib/types/commute'
import type { StageLabel } from './trip-stages'

export type GuideQuestion =
  | 'What to wear'
  | 'Getting a bike'
  | 'Carrying things'
  | 'Planning the route'
  | 'Riding with traffic'
  | 'Taking the bus'
  | 'Arriving at work'
  | 'Locking up and parking'

export interface GuideGroup {
  question: GuideQuestion
  guides: GuideLink[]
}

/** The order questions appear in (the trip's stages); a question with no guide is left out. */
export const QUESTION_ORDER: GuideQuestion[] = [
  'What to wear',
  'Getting a bike',
  'Carrying things',
  'Planning the route',
  'Riding with traffic',
  'Taking the bus',
  'Arriving at work',
  'Locking up and parking',
]

/**
 * The stage each question belongs to: its guides open from that stage of
 * the open row's strip (StageStrip, Keith 2026-10-21). The Seat stage left
 * the strip on 2026-10-15, so riding with traffic and taking the bus are
 * part of the route.
 */
export const QUESTION_STAGE: Record<GuideQuestion, StageLabel> = {
  'What to wear': 'Wear',
  'Getting a bike': 'Vehicle',
  'Carrying things': 'Cargo',
  'Planning the route': 'Route',
  'Riding with traffic': 'Route',
  'Taking the bus': 'Route',
  'Arriving at work': 'Arrive',
  'Locking up and parking': 'Store',
}

/** Plan-row mode -> content_items.primary_mode. Driving has no guides. */
export function contentModeFor(mode: string | null | undefined): string | null {
  switch (mode) {
    case 'bike':
    case 'ebike':
      return 'cycling'
    case 'walk':
      return 'walking'
    case 'transit':
    case 'bus':
    case 'park_ride':
    case 'bike_ride':
      return 'transit'
    default:
      return null
  }
}

/** "biking", "walking", "the bus and train" for the card title. */
export function contentModeWord(contentMode: string): string {
  if (contentMode === 'cycling') return 'biking'
  if (contentMode === 'walking') return 'walking'
  return 'the bus and train'
}

const BARRIER_QUESTION: Record<string, GuideQuestion> = {
  weather: 'What to wear',
  // Arriving fresh is the Arrive stage's question (Keith 2026-10-21).
  sweating: 'Arriving at work',
  gear: 'What to wear',
  carrying: 'Carrying things',
  routes: 'Planning the route',
  planning: 'Planning the route',
  time: 'Planning the route',
  bike_parking: 'Locking up and parking',
  safety: 'Riding with traffic',
  // "What a cargo e-bike costs": getting the bike, for a cyclist; the fare, for a rider.
  cost: 'Getting a bike',
}

/** Topics, in the order they are tried when the barrier decides nothing. */
const TOPIC_QUESTION: [string, GuideQuestion][] = [
  ['arriving', 'Arriving at work'],
  ['weather', 'What to wear'],
  ['year-round', 'What to wear'],
  ['carrying', 'Carrying things'],
  ['cargo', 'Carrying things'],
  ['errands', 'Carrying things'],
  ['bike-share', 'Getting a bike'],
  ['e-bikes', 'Getting a bike'],
  ['borrowing', 'Getting a bike'],
  ['parking', 'Locking up and parking'],
  ['security', 'Locking up and parking'],
  ['safety', 'Riding with traffic'],
  ['infrastructure', 'Riding with traffic'],
  ['mbta-basics', 'Taking the bus'],
  ['fares', 'Taking the bus'],
  ['routes', 'Planning the route'],
  ['planning', 'Planning the route'],
  ['apps', 'Planning the route'],
  ['multimodal', 'Planning the route'],
  ['short-trips', 'Planning the route'],
  ['getting-started', 'Planning the route'],
  ['gear', 'What to wear'],
]

/** Which question a guide answers, or null when it fits none. */
export function questionFor(guide: Pick<GuideLink, 'primary_mode' | 'primary_barrier' | 'topics' | 'slug' | 'title'>): GuideQuestion | null {
  const transit = guide.primary_mode === 'transit'
  // On transit, "how to pay" and "your first bus ride" are the bus question
  // even when the editor filed them under planning.
  if (transit && guide.topics.some((t) => t === 'mbta-basics' || t === 'fares')) return 'Taking the bus'
  // A guide about getting to your desk (parking at the building, freshening
  // up) is the arrival, whatever barrier the editor picked.
  if (guide.topics.includes('arriving')) return fitForMode('Arriving at work', guide.primary_mode)
  const byBarrier = guide.primary_barrier ? BARRIER_QUESTION[guide.primary_barrier] : undefined
  if (byBarrier) return fitForMode(byBarrier, guide.primary_mode)
  // With no barrier set, a bike-share or borrowing walkthrough ("Bluebikes
  // from start to finish") is about getting the bike. A winter guide that
  // merely mentions bike share keeps its weather barrier above.
  if (guide.primary_mode === 'cycling' && (guide.topics.includes('bike-share') || guide.topics.includes('borrowing') || /bluebikes|bike-share|borrow/i.test(`${guide.slug ?? ''} ${guide.title}`))) {
    return 'Getting a bike'
  }
  for (const [topic, q] of TOPIC_QUESTION) {
    if (guide.topics.includes(topic)) return fitForMode(q, guide.primary_mode)
  }
  return null
}

/** A walker never locks up or gets a bike; a bus rider never rides with traffic. */
function fitForMode(q: GuideQuestion, mode: string): GuideQuestion | null {
  if (q === 'Locking up and parking' || q === 'Getting a bike') return mode === 'cycling' ? q : mode === 'transit' && q === 'Getting a bike' ? 'Taking the bus' : null
  if (q === 'Riding with traffic') return mode === 'cycling' ? q : mode === 'transit' ? 'Taking the bus' : null
  if (q === 'Taking the bus') return mode === 'transit' ? q : null
  return q
}

/**
 * How directly a guide answers its question; higher leads. Under "Planning
 * the route" a route-picking guide (route, routing, comfortable, quiet
 * streets in its slug or title) comes before a "when biking is faster"
 * guide. Elsewhere the library's title order stands.
 */
export function rankWithin(q: GuideQuestion, guide: Pick<GuideLink, 'slug' | 'title' | 'topics' | 'primary_barrier'>): number {
  const text = `${guide.slug ?? ''} ${guide.title}`.toLowerCase()
  if (q === 'Planning the route') {
    let score = 0
    if (/\broute|routing/.test(text)) score += 2
    if (/comfortable|quiet street|low-stress|calm/.test(text)) score += 2
    if (guide.primary_barrier === 'routes' || guide.topics.includes('routes')) score += 1
    return score
  }
  return 0
}

/**
 * The picked mode's guides grouped by question, at most `max` links in all.
 * Rounds through the questions so a cap of six never shows six weather
 * guides and nothing on parking.
 */
export function groupGuides(guides: GuideLink[], contentMode: string, max = 6): GuideGroup[] {
  const buckets = new Map<GuideQuestion, GuideLink[]>()
  for (const g of guides) {
    if (g.primary_mode !== contentMode) continue
    const q = questionFor(g)
    if (!q) continue
    const list = buckets.get(q) ?? []
    list.push(g)
    buckets.set(q, list)
  }
  for (const [q, list] of buckets) {
    list.sort((a, b) => rankWithin(q, b) - rankWithin(q, a) || a.title.localeCompare(b.title))
  }
  const present = QUESTION_ORDER.filter((q) => (buckets.get(q)?.length ?? 0) > 0)
  const picked = new Map<GuideQuestion, GuideLink[]>(present.map((q) => [q, []]))
  let count = 0
  for (let round = 0; count < max; round++) {
    let added = false
    for (const q of present) {
      if (count >= max) break
      const next = buckets.get(q)![round]
      if (!next) continue
      picked.get(q)!.push(next)
      count++
      added = true
    }
    if (!added) break
  }
  return present
    .map((q) => ({ question: q, guides: picked.get(q) ?? [] }))
    .filter((grp) => grp.guides.length > 0)
}

/**
 * A mode's guides filed by the stage of the strip they open from, each
 * stage's questions in trip order, at most `perStage` guides a stage
 * (rounding through its questions, as groupGuides does).
 */
export function guidesByStage(guides: GuideLink[], contentMode: string, perStage = 3): Partial<Record<StageLabel, GuideGroup[]>> {
  const all = groupGuides(guides, contentMode, Number.POSITIVE_INFINITY)
  const out: Partial<Record<StageLabel, GuideGroup[]>> = {}
  const stages = [...new Set(all.map((g) => QUESTION_STAGE[g.question]))]
  for (const stage of stages) {
    const groups = all.filter((g) => QUESTION_STAGE[g.question] === stage)
    const picked = groups.map((g) => ({ question: g.question, guides: [] as GuideLink[] }))
    let count = 0
    for (let round = 0; count < perStage; round++) {
      let added = false
      groups.forEach((g, i) => {
        if (count >= perStage || !g.guides[round]) return
        picked[i].guides.push(g.guides[round])
        count++
        added = true
      })
      if (!added) break
    }
    out[stage] = picked.filter((g) => g.guides.length > 0)
  }
  return out
}

export function guideHref(g: Pick<GuideLink, 'id' | 'slug'>): string {
  return `/guides/${g.slug ?? g.id}`
}
