import type { EmployerBenefits } from '@/lib/types/commute'

/**
 * "Preview unsaved changes": the portal hands the public employer page the
 * benefits form as it stands, plus the locations, in `?draft=` so the page
 * renders them instead of the saved ones under a "Preview of unsaved changes"
 * ribbon (advisor v2 contract, section 4). Nothing is written in draft mode.
 *
 * Payload (JSON, then base64url without padding):
 *   { v: 1, benefits: EmployerBenefits, locations: AdvisorDraftLocation[] }
 *
 * `locations` is in display order, main first, each with its saved id (so
 * `?location=<id>` keeps working) and its arrive-by time. A location the
 * admin has added but not yet saved has no id.
 */
export const ADVISOR_DRAFT_VERSION = 1 as const

export type AdvisorDraftLocation = {
  id?: string
  name: string | null
  address: string
  lat: number
  lng: number
  /** "HH:MM" 24h local; the page's "Arrive by" default for this location. */
  typical_start_time: string
}

export type AdvisorDraftPayload = {
  v: typeof ADVISOR_DRAFT_VERSION
  benefits: EmployerBenefits
  locations: AdvisorDraftLocation[]
}

/** Browser-safe base64url of a UTF-8 string, no padding. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeAdvisorDraft(payload: Omit<AdvisorDraftPayload, 'v'>): string {
  return toBase64Url(JSON.stringify({ v: ADVISOR_DRAFT_VERSION, ...payload }))
}

/**
 * The inverse, for the public page. Returns null for anything that is not a
 * v1 payload; the page then shows the saved benefits as usual.
 */
export function decodeAdvisorDraft(param: string | null | undefined): AdvisorDraftPayload | null {
  if (!param) return null
  try {
    const parsed = JSON.parse(fromBase64Url(param)) as Partial<AdvisorDraftPayload>
    if (!parsed || parsed.v !== ADVISOR_DRAFT_VERSION || typeof parsed.benefits !== 'object' || !parsed.benefits) return null
    const locations = Array.isArray(parsed.locations)
      ? parsed.locations.filter(
          (l): l is AdvisorDraftLocation =>
            !!l && typeof l.address === 'string' && typeof l.lat === 'number' && typeof l.lng === 'number',
        )
      : []
    return { v: ADVISOR_DRAFT_VERSION, benefits: parsed.benefits, locations }
  } catch {
    return null
  }
}

/** The public page with the draft attached, on this deployment. */
export function advisorDraftPath(slugOrCode: string, locationId: string | null | undefined, draft: string): string {
  const qs = new URLSearchParams()
  if (locationId) qs.set('location', locationId)
  qs.set('draft', draft)
  return `/commute-advisor/${encodeURIComponent(slugOrCode)}?${qs.toString()}`
}
