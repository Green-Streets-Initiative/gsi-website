/**
 * Feeder rides on the calendar (Shift 01460; Keith 2026-10-29, option A): a
 * ride or walk that goes together to a bigger event sits in that event's
 * "Go together" tray instead of a row of its own. Mirrors Shift's
 * lib/go-together.ts (nestFeeders, feederPlace, shortOrganizer).
 */

type Nestable = { id: string; feeds_content_id?: string | null }

export interface CalendarEntry<E> {
  event: E
  /** Groups going to this event, in list order; empty for most events. */
  feeders: E[]
}

/**
 * Turn the filtered list into calendar entries. `shown` is what the filters
 * let through (distance included), `all` every loaded event in time order,
 * and `inTray` the filters without the distance: it decides which of an
 * event's feeders sit in its tray, and whether an event past the distance
 * may come in because one of its feeders is near. A feeder whose event is
 * not loaded, or does not pass, stays a card of its own.
 */
export function nestFeeders<E extends Nestable>(
  shown: E[],
  all: E[],
  inTray: (e: E) => boolean,
): CalendarEntry<E>[] {
  const byId = new Map(all.map((e) => [e.id, e]))
  const shownIds = new Set(shown.map((e) => e.id))
  const feedersOf = new Map<string, E[]>()
  for (const e of all) {
    const to = e.feeds_content_id
    if (!to || to === e.id || !byId.has(to)) continue
    const list = feedersOf.get(to) ?? []
    list.push(e)
    feedersOf.set(to, list)
  }
  const listed = (id: string) => {
    const e = byId.get(id)
    if (!e) return false
    if (shownIds.has(id)) return true
    return inTray(e) && (feedersOf.get(id) ?? []).some((f) => shownIds.has(f.id))
  }
  const out: CalendarEntry<E>[] = []
  for (const e of all) {
    const to = e.feeds_content_id
    const nested = !!to && to !== e.id && listed(to)
    if (nested || !listed(e.id)) continue
    out.push({ event: e, feeders: (feedersOf.get(e.id) ?? []).filter((f) => shownIds.has(f.id) || inTray(f)) })
  }
  return out
}

/** "Roslindale" from "Ride to Critical Mass from Roslindale (Parkway
 *  Cycling Club)"; the meeting place when the title names none. */
export function feederPlace(title: string, locationName: string | null): string {
  const m = title.match(/\bfrom\s+(?:the\s+)?([^()]+?)\s*(?:\(|$)/i)
  const place = m?.[1]?.trim()
  return place && place.length >= 3 ? place : locationName || title
}

/** "JPTAG" from "JPTAG (Jamaica Plain Transportation Action Group)". */
export function shortOrganizer(name: string | null): string | null {
  const short = name?.replace(/\s*\(.*\)\s*$/, '').trim()
  return short || null
}
