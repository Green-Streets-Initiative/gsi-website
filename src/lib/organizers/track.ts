import posthog from 'posthog-js'

/**
 * Organizer console analytics, named and shaped like the employer portal's
 * (portal_* events, portal/_components/PortalTracking.tsx): organizer_<what>
 * with ids, kinds and counts. Never a name, email, note or address. The
 * assistant's own use is in ride_assistant_messages, as the employer
 * assistant's is in employer_assistant_messages.
 */
export function track(event: `organizer_${string}`, props?: Record<string, unknown>): void {
  try { posthog.capture(event, props) } catch { /* analytics never blocks */ }
}
