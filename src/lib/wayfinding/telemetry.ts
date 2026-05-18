type EventName =
  | 'page_load'
  | 'language_detected'
  | 'language_selected'
  | 'chip_toggle'
  | 'pin_tap'
  | 'arrival_mode_selected'
  | 'departure_mode_selected'
  | 'get_me_home'
  | 'get_me_there'
  | 'geolocation_granted'
  | 'geolocation_denied'
  | 'rain_banner_impression'
  | 'share'

interface TrackPayload {
  event: EventName
  slug: string
  locale: string
  [key: string]: string | number | boolean
}

export function trackEvent(payload: TrackPayload) {
  if (typeof window === 'undefined') return
  try {
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/wayfinding/track', JSON.stringify(payload))
    }
  } catch {
    // silently fail — telemetry is best-effort
  }
}
