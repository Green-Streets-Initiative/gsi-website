import { buildShareUrl } from '@/lib/nearby/share'

/**
 * Links an employer hands its staff: the branded Commute Advisor and the
 * branded Nearby page for its office. Shared by the portal Share Kit and the
 * weekly digest so both always point at the same URLs.
 */

const SITE = 'https://www.gogreenstreets.org'

type Office = {
  destination_address?: string | null
  destination_lat?: number | null
  destination_lng?: number | null
}

/**
 * For an "Open" button in the portal: the same page on the site the admin is
 * on now. The shareable links stay on www (that is what staff receive), but a
 * click should open this deployment's copy, so a preview or the dev server
 * shows the page that ships with it, not whatever www runs today.
 */
export function onThisSite(url: string): string {
  return url.replace(/^(https?:\/\/)?(www\.)?gogreenstreets\.org(?=\/|$)/, '') || '/'
}

/** The branded Commute Advisor; with a location id it opens at that location. */
export function employerAdvisorUrl(slug: string, locationId?: string | null): string {
  const base = `${SITE}/commute-advisor/${encodeURIComponent(slug)}`
  return locationId ? `${base}?location=${encodeURIComponent(locationId)}` : base
}

/** An employer location in the shape the Nearby helpers take. */
export function locationAsOffice(l: { address: string; lat: number; lng: number }): Office {
  return { destination_address: l.address, destination_lat: l.lat, destination_lng: l.lng }
}

/**
 * "One Financial Center, Boston, MA 02111" -> "One Financial Center, Boston".
 * /nearby reads its label as "<place>, <town>" and shows it as the heading;
 * the town part also feeds the town-based sections. Falls back to the first
 * part of the address alone when there is no recognisable town.
 */
export function officeLabel(address: string | null | undefined): string {
  const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  const stateIdx = parts.findIndex((p, i) => i > 0 && /^(MA|Massachusetts)\b/i.test(p))
  const town = stateIdx > 1 ? parts[stateIdx - 1] : parts.length >= 3 ? parts[parts.length - 2] : null
  return town && town !== parts[0] ? `${parts[0]}, ${town}` : parts[0]
}

/** Branded /nearby for the office, or null until the employer has saved an
 *  office address (with coordinates) on its Commute Advisor page. */
export function employerNearbyUrl(slug: string, office: Office | null | undefined, opts: { print?: boolean } = {}): string | null {
  if (office?.destination_lat == null || office?.destination_lng == null) return null
  const sticky = new URLSearchParams({ partner: slug })
  const path = buildShareUrl(office.destination_lat, office.destination_lng, officeLabel(office.destination_address), sticky)
  return `${SITE}${opts.print ? path.replace(/^\/nearby\?/, '/nearby/print?') : path}`
}
