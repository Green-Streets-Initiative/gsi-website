/**
 * The workplace a Green Streets staff member chose to open in the portal
 * (Keith 2026-10-29). Kept per browser tab in sessionStorage, so a reload
 * stays on it and a new tab starts from the staff member's own workplace.
 * A link with ?workplace=<group id> opens one directly. Only staff are
 * offered the choice; the portal ignores it for everyone else, and the
 * server checks every request on its own (requirePortalCaller and RLS).
 */

const KEY = 'shift.portal.staffWorkplace'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const WORKPLACE_PARAM = 'workplace'

export function isGroupId(v: string | null | undefined): v is string {
  return !!v && UUID.test(v)
}

export function readStaffWorkplace(): string | null {
  try {
    const v = window.sessionStorage.getItem(KEY)
    return isGroupId(v) ? v : null
  } catch {
    return null
  }
}

export function writeStaffWorkplace(id: string | null): void {
  try {
    if (id && isGroupId(id)) window.sessionStorage.setItem(KEY, id)
    else window.sessionStorage.removeItem(KEY)
  } catch {
    /* storage blocked: the choice lasts until the next load */
  }
}

/** Takes ?workplace=<id> off the address bar and returns it (null when absent or malformed). */
export function takeWorkplaceParam(): string | null {
  const url = new URL(window.location.href)
  const v = url.searchParams.get(WORKPLACE_PARAM)
  if (v === null) return null
  url.searchParams.delete(WORKPLACE_PARAM)
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  return isGroupId(v) ? v : null
}

/**
 * Opens another workplace as staff: reloads this page with ?workplace=<id>,
 * which the portal stores and strips again. A full load, so nothing from
 * the previous workplace stays on screen.
 */
export function openStaffWorkplace(id: string): void {
  writeStaffWorkplace(id)
  window.location.assign(`${window.location.pathname}?${WORKPLACE_PARAM}=${encodeURIComponent(id)}`)
}
