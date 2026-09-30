/**
 * Public address of a community event.
 *
 * Every event carries a readable slug — "a-simple-machine-bike-convoy-2026-10-11"
 * — set once by the database when the event is created (Shift migration
 * 01037). The raw content id ("ce_sync_massbike_8912d763626a") is an internal
 * key and only ever appears in a link when a row somehow has no slug; the
 * event page still resolves it, and redirects it to the slug when one exists.
 */
export function eventPath(e: { id: string; slug?: string | null }, base = '/events'): string {
  return `${base}/${encodeURIComponent(e.slug || e.id)}`
}

export function eventUrl(e: { id: string; slug?: string | null }, origin = 'https://www.gogreenstreets.org'): string {
  return `${origin}${eventPath(e)}`
}
