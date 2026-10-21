// An employer's bike share benefit, whichever system serves the office
// (Keith 2026-10-21: "we've got Bluebikes hard-coded as the only bikeshare").
// Stored in employer_benefits as bikeshare_* (Shift 01304 moved the old
// bluebikes_* keys over). The system is a name in the employer's words; the
// office's location suggests one.

import type { EmployerBenefits } from '@/lib/types/commute'

/** Bike share systems we know, by the area they serve: [south, west, north, east]. */
const SYSTEMS: { name: string; bbox: [number, number, number, number] }[] = [
  { name: 'Bluebikes', bbox: [42.2, -71.3, 42.55, -70.85] },
  // Same box /nearby uses for the ValleyBike feed (lib/nearby/live-data.ts).
  { name: 'ValleyBike', bbox: [42.0, -72.9, 42.5, -72.4] },
]

/** The bike share system that serves a place, if we know one. */
export function bikeShareSystemNear(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null) return null
  return SYSTEMS.find(({ bbox: [s, w, n, e] }) => lat >= s && lat <= n && lng >= w && lng <= e)?.name ?? null
}

/** "Bluebikes membership", or "Bike share membership" when no system is named. */
export function bikeShareMembership(b: EmployerBenefits): string {
  return `${b.bikeshare_system?.trim() || 'Bike share'} membership`
}

/** The line employees read: the employer's own note, or a plain default. */
export function bikeShareBenefitLine(b: EmployerBenefits, companyName?: string | null): string {
  if (b.bikeshare_subsidy_label?.trim()) return b.bikeshare_subsidy_label.trim()
  const who = companyName ?? 'Your employer'
  return `${who} ${b.bikeshare_subsidy_type === 'partial' ? 'helps pay for' : 'covers'} your ${bikeShareMembership(b)}`
}
