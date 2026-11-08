/**
 * The languages Shift asks about, one short list for Greater Boston (Shift
 * 01476 partner_languages(); the app's PARTNER_LANGUAGES and
 * LANGUAGE_OWN_NAMES). Shift Together asks which ones a person speaks; an
 * event or ride says which ones it is led in (Shift 01697
 * event_details.languages, ride_series.languages). Server-safe: no client
 * imports here.
 */

export type PartnerLanguage = 'en' | 'es' | 'pt' | 'zh' | 'ht' | 'vi' | 'ar' | 'fr'

/** Each in its own words, so people find theirs (the app's LANGUAGE_OWN_NAMES). */
export const LANGUAGES: { id: PartnerLanguage; label: string; english: string }[] = [
  { id: 'en', label: 'English', english: 'English' }, { id: 'es', label: 'Español', english: 'Spanish' },
  { id: 'pt', label: 'Português', english: 'Portuguese' }, { id: 'zh', label: '中文', english: 'Chinese' },
  { id: 'ht', label: 'Kreyòl ayisyen', english: 'Haitian Creole' }, { id: 'vi', label: 'Tiếng Việt', english: 'Vietnamese' },
  { id: 'ar', label: 'العربية', english: 'Arabic' }, { id: 'fr', label: 'Français', english: 'French' },
]

const BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]))

export function isLanguage(code: string): code is PartnerLanguage {
  return BY_ID.has(code as PartnerLanguage)
}

/**
 * The languages worth saying: known codes, the other languages first in the
 * list's order, English last. Nothing when it is English only or not said,
 * since English is what every listing assumes.
 */
export function eventLanguages(codes: readonly string[] | null | undefined): PartnerLanguage[] {
  const known = LANGUAGES.map((l) => l.id).filter((id) => (codes ?? []).includes(id))
  if (!known.some((id) => id !== 'en')) return []
  return [...known.filter((id) => id !== 'en'), ...known.filter((id) => id === 'en')]
}

/** "Spanish and English", "Spanish, Portuguese and English". */
export function languageList(codes: readonly PartnerLanguage[]): string {
  const names = codes.map((c) => BY_ID.get(c)?.english ?? c)
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** "Español · English": each in its own words, for the reader who speaks it. */
export function ownNames(codes: readonly PartnerLanguage[]): string {
  return codes.map((c) => BY_ID.get(c)?.label ?? c).join(' · ')
}

export function languageLabel(code: PartnerLanguage): string {
  return BY_ID.get(code)?.label ?? code
}

export function languageEnglish(code: PartnerLanguage): string {
  return BY_ID.get(code)?.english ?? code
}

/** Event types someone leads (a ride, walk, class, tour); the rest are just "in" a language. */
const LED_TYPES = new Set(['group_ride', 'guided_ride', 'walking_tour', 'bike_bus', 'class', 'bike_rodeo', 'transit_buddy'])

/**
 * "Led in Spanish and English" for a ride, walk or class; "In Spanish and
 * English" for the rest. Null when there is nothing to say (English only or
 * not said). The app's events.led_in line says the same.
 */
export function ledInLine(codes: readonly string[] | null | undefined, eventType?: string | null): string | null {
  const langs = eventLanguages(codes)
  if (langs.length === 0) return null
  const list = languageList(langs)
  return !eventType || LED_TYPES.has(eventType) ? `Led in ${list}` : `In ${list}`
}
