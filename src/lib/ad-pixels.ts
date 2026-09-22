// Meta Pixel + Reddit Pixel, loaded by <AdPixels /> in the root layout.
//
// Both platforms need their own tag on the site to see a landing view and
// the "Get Shift" conversion for the ads that send people here. PostHog
// stays the source of truth for the funnel; these tags exist so Ads
// Manager can report and, once volume allows, optimize for the conversion.
//
// The stubs below are the vendors' own bootstrap code written out in TS so
// calls made before the remote script finishes loading are queued, not
// lost. Do Not Track is honored the same way PostHogProvider does it.

type QueuedFn = ((...args: unknown[]) => void) & {
  queue?: unknown[]
  callQueue?: unknown[]
  callMethod?: (...args: unknown[]) => void
  sendEvent?: (...args: unknown[]) => void
  push?: unknown
  loaded?: boolean
  version?: string
}

type AdWindow = Window & { fbq?: QueuedFn; _fbq?: QueuedFn; rdt?: QueuedFn }

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ''
export const REDDIT_PIXEL_ID = process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID ?? ''

export const META_PIXEL_SRC = 'https://connect.facebook.net/en_US/fbevents.js'
export const REDDIT_PIXEL_SRC = 'https://www.redditstatic.com/ads/pixel.js'

export function doNotTrack(): boolean {
  if (typeof window === 'undefined') return true
  const w = window as Window & { doNotTrack?: string }
  return navigator.doNotTrack === '1' || w.doNotTrack === '1'
}

/** Meta's `fbq` bootstrap: queue calls until fbevents.js takes over. */
export function ensureFbq(): QueuedFn {
  const w = window as AdWindow
  if (w.fbq) return w.fbq
  const n: QueuedFn = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args)
    else n.queue?.push(args)
  }
  if (!w._fbq) w._fbq = n
  n.push = n
  n.loaded = true
  n.version = '2.0'
  n.queue = []
  w.fbq = n
  return n
}

/** Reddit's `rdt` bootstrap: queue calls until pixel.js takes over. */
export function ensureRdt(): QueuedFn {
  const w = window as AdWindow
  if (w.rdt) return w.rdt
  const p: QueuedFn = function (...args: unknown[]) {
    if (p.sendEvent) p.sendEvent(...args)
    else p.callQueue?.push(args)
  }
  p.callQueue = []
  w.rdt = p
  return p
}

/**
 * One conversion, both platforms. Meta gets a custom event by name (a
 * custom conversion in Events Manager keys on it); Reddit gets its standard
 * Lead event so a Conversions campaign can target it later. No-ops when a
 * tag is not loaded (no ID, DNT, or server render).
 */
export function trackAdConversion(name: string, props: Record<string, string | undefined> = {}) {
  if (typeof window === 'undefined') return
  const w = window as AdWindow
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(props)) if (v !== undefined) clean[k] = v
  if (META_PIXEL_ID && w.fbq) w.fbq('trackCustom', name, clean)
  if (REDDIT_PIXEL_ID && w.rdt) w.rdt('track', 'Lead', clean)
}
