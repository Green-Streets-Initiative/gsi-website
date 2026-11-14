/**
 * What the Shift app should know about the page someone installed from.
 *
 * The App Store and Google Play drop every link parameter on install, so the
 * only thing that reaches a new account is the clipboard: ride pages copy
 * "SHIFT-<code>", a friend's shared link copies their invite code. Every
 * other page with a store badge copied nothing, so the app gave those people
 * the same commuter setup and recorded no source for them (116 of 223
 * sign-ups from September to mid-November 2026).
 *
 * A store badge tap now copies a page tag the app reads once during setup
 * (Shift lib/referral-code.ts parseWebFrom, lib/signup-source.ts):
 *
 *   SHIFTFROM:trail:<trail id>            /trails/<id>: setup opens on that route
 *   SHIFTFROM:plan:<lat>,<lng>;<lat>,<lng> a commute or trip plan: setup opens on those options
 *   SHIFTFROM:town:<slug>                 /shift/towns/<slug>
 *   SHIFTFROM:ad:<campaign token>         a paid visit (utm_medium cpc, paid, ...)
 *   SHIFTFROM:events | guide:<slug> | home | other
 *
 * Builds of the app from before this read the tag as "not an invite" and
 * leave it alone. A friend's code, when there is one, wins: StoreBadges
 * copies that instead.
 */
import { campaignToken, type StoreAttribution } from '@/lib/store-attribution'

type LatLng = { lat: number; lng: number }

let plan: { from: LatLng; to: LatLng } | null = null

/** The plan on screen, set by the planner while it shows one (null when it stops). */
export function setHandoffPlan(next: { from: LatLng; to: LatLng } | null): void {
  plan = next
}

const PAID = /^(cpc|ppc|paid|paid[_-]?social|paidsocial|display|cpm)$/i
const clean = (s: string) => s.replace(/[^A-Za-z0-9._~-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
const coord = (n: number) => (Math.round(n * 1e4) / 1e4).toString()

/** The tag for the page the visitor is on, or null when there is nothing to say. */
export function handoffTag(attr: StoreAttribution | null, pathname?: string): string | null {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')
  if (!path) return null
  const parts = path.split('/').filter(Boolean)
  // A language prefix (/es/..., /pt-BR/..., /zh-Hans/...) is not the page.
  if (parts[0] && /^(es|pt-BR|zh-Hans)$/.test(parts[0])) parts.shift()

  if (plan && [plan.from.lat, plan.from.lng, plan.to.lat, plan.to.lng].every(Number.isFinite)) {
    return `SHIFTFROM:plan:${coord(plan.from.lat)},${coord(plan.from.lng)};${coord(plan.to.lat)},${coord(plan.to.lng)}`
  }
  if (parts[0] === 'trails' && parts[1] && parts[1] !== 'conditions') {
    const id = clean(decodeURIComponent(parts[1]))
    if (id) return `SHIFTFROM:trail:${id}`
  }
  if (attr?.medium && PAID.test(attr.medium)) return `SHIFTFROM:ad:${clean(campaignToken(attr))}`
  if (parts[0] === 'shift' && parts[1] === 'towns' && parts[2]) return `SHIFTFROM:town:${clean(parts[2])}`
  if (parts[0] === 'trip' || parts[0] === 'plan' || parts[0] === 'commute-advisor') return 'SHIFTFROM:plan'
  if (parts[0] === 'events') return 'SHIFTFROM:events'
  if (parts[0] === 'guides') return parts[1] ? `SHIFTFROM:guide:${clean(parts[1])}` : 'SHIFTFROM:guide'
  if (parts.length === 0 || (parts[0] === 'shift' && parts.length === 1)) return 'SHIFTFROM:home'
  return 'SHIFTFROM:other'
}

/**
 * Copy the page tag on a store badge tap. Fire-and-forget: the store opens
 * either way, and a blocked clipboard just means the app learns nothing.
 */
export function copyHandoffTag(attr: StoreAttribution | null): void {
  const tag = handoffTag(attr)
  if (!tag) return
  try {
    void navigator.clipboard?.writeText(tag).catch(() => {})
  } catch {
    // No clipboard here.
  }
}
