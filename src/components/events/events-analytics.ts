import posthog from 'posthog-js'

/**
 * PostHog capture that never throws and never fires before the provider has
 * initialized (posthog-js sets __loaded once init() has run).
 */
export function trackEvents(name: string, props?: Record<string, unknown>) {
  try {
    if ((posthog as unknown as { __loaded?: boolean }).__loaded) posthog.capture(name, props)
  } catch {
    /* analytics must never break the page */
  }
}
