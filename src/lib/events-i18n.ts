/**
 * The events calendar's words and dates in the page's language (translation
 * plan, batch 5). Each helper returns exactly what lib/events.ts returns for
 * English, so the English pages are unchanged; the other languages take their
 * words from site-strings/events.ts and their dates from Intl.
 *
 * Stored content (titles, venues, organizers, distances as listed) passes
 * through untouched.
 */
import { translator, siteDate, siteTime, type SiteLocale, type T, type Vars } from '@/lib/site-i18n'
import { eventsStrings, type EventsKey } from '@/lib/site-strings/events'
import {
  EVENT_TYPES, TAG_META, PACE_BAND_LABEL,
  RIDE_STYLE_LABEL, RIDE_STYLE_FILTER_LABEL, RIDE_STYLE_BLURB,
  type CommunityEvent, type RideStyle,
  getTypeMeta, getTagMeta, formatTime, formatDistance, dateLong, dateMedium, groupLabel,
  dateRangeShort, dateRangeLong, rideLengthLabel, formatDistanceText, parseEventDate,
  isMultiDay, eventLastDay, parseStyleFilter,
} from '@/lib/events'
import {
  eventLanguages, languageEnglish, languageLabel, languageList, ledInLine, type PartnerLanguage,
} from '@/lib/languages'

export type EventsT = T<EventsKey>

export function eventsT(locale: SiteLocale): EventsT {
  return translator(eventsStrings, locale)
}

/** One key for one, another for the rest (Chinese has no plural, so both read the same). */
export function plural(t: EventsT, count: number, one: EventsKey, other: EventsKey, vars?: Vars): string {
  return t(count === 1 ? one : other, { count, ...vars })
}

/** "3 events" */
export function eventCount(t: EventsT, count: number): string {
  return plural(t, count, 'count.events_one', 'count.events_other')
}

// --- Labels ---------------------------------------------------------------

export function typeLabel(type: string, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return getTypeMeta(type).label
  return eventsT(locale)(`type.${type in EVENT_TYPES ? type : 'other'}` as EventsKey)
}

export function tagLabel(tag: string, locale: SiteLocale = 'en'): string {
  if (locale === 'en' || !(tag in TAG_META)) return getTagMeta(tag).label
  return eventsT(locale)(`tag.${tag}` as EventsKey)
}

export function rideLevelLabel(level: RideStyle, locale: SiteLocale = 'en'): string {
  return locale === 'en' ? RIDE_STYLE_LABEL[level] : eventsT(locale)(`level.${level}` as EventsKey)
}

export function rideLevelFilterLabel(level: RideStyle, locale: SiteLocale = 'en'): string {
  return locale === 'en' ? RIDE_STYLE_FILTER_LABEL[level] : eventsT(locale)(`level_filter.${level}` as EventsKey)
}

export function rideLevelBlurb(level: RideStyle, locale: SiteLocale = 'en'): string {
  return locale === 'en' ? RIDE_STYLE_BLURB[level] : eventsT(locale)(`level_blurb.${level}` as EventsKey)
}

/** The organizer's pace band with its speeds, or null for a band nobody set. */
export function paceLabel(pace: string | null, locale: SiteLocale = 'en'): string | null {
  if (!pace || !PACE_BAND_LABEL[pace]) return null
  return locale === 'en' ? PACE_BAND_LABEL[pace] : eventsT(locale)(`pace.${pace}` as EventsKey)
}

/** What a type-filter value (an event type or `style:<level>`) is called. */
export function typeFilterLabelL(value: string, locale: SiteLocale = 'en'): string {
  const level = parseStyleFilter(value)
  if (level) return rideLevelFilterLabel(level, locale)
  return typeLabel(value, locale)
}

/** "24 mi ride": the listing's own distance stays as written. */
export function rideLengthL(text: string | null | undefined, locale: SiteLocale = 'en'): string | null {
  if (locale === 'en') return rideLengthLabel(text)
  const t = formatDistanceText(text)?.trim()
  if (!t) return null
  const short = t.replace(/\bmiles?\b/gi, 'mi').replace(/\bminutes?\b/gi, 'min').replace(/\bhours?\b/gi, 'hr')
  return /round trip|loop|ride/i.test(short) ? short : eventsT(locale)('card.ride_length', { length: short })
}

/** "2.3 mi" (英里 in Chinese). */
export function distanceL(miles: number, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return formatDistance(miles)
  const n = miles < 10 ? Math.round(miles * 10) / 10 : Math.round(miles)
  return eventsT(locale)('unit.mi', { n })
}

/** The calendar keeps "Your location" in the URL; it is said in the page's language. */
export function placeLabel(label: string, locale: SiteLocale = 'en'): string {
  return locale !== 'en' && label === 'Your location' ? eventsT(locale)('loc.yours') : label
}

// --- Dates and times ------------------------------------------------------

/** "2 PM" in English (unchanged); the language's own clock otherwise. */
export function timeL(time: string, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return formatTime(time)
  const [h, m] = time.split(':').map((x) => parseInt(x, 10))
  return siteTime(locale, new Date(2000, 0, 1, h || 0, m || 0), { hour: 'numeric', minute: '2-digit' })
}

/** "Sunday, November 1, 2026" */
export function dateLongL(d: Date, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return dateLong(d)
  return siteDate(locale, d, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

/** "Sunday, November 1": the long date without the year. */
export function dayTitleL(d: Date, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return dateLong(d).replace(/, \d{4}$/, '')
  return siteDate(locale, d, { weekday: 'long', month: 'long', day: 'numeric' })
}

/** The agenda's day header: "Sunday · November 1". */
export function groupLabelL(d: Date, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return groupLabel(d)
  return siteDate(locale, d, { weekday: 'long', month: 'long', day: 'numeric' })
}

/** "Tue, Sep 8" */
export function dateMediumL(d: Date, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return dateMedium(d)
  return siteDate(locale, d, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "Nov 1" */
export function dateShortL(d: Date, locale: SiteLocale = 'en'): string {
  return siteDate(locale, d, { month: 'short', day: 'numeric' })
}

/** Month name for a range template; Chinese writes "11月" either way. */
function monthName(locale: SiteLocale, d: Date, style: 'short' | 'long'): string {
  return siteDate(locale, d, { month: locale === 'zh-Hans' ? 'short' : style })
}

function rangeDay(t: EventsT, locale: SiteLocale, d: Date, style: 'short' | 'long', withYear: boolean): string {
  const vars = { month: monthName(locale, d, style), day: d.getDate(), year: d.getFullYear() }
  return t(withYear ? 'date_range.day_year' : 'date_range.day', vars)
}

/** "Nov 1 to 30" for a multi-day event, "Nov 1" otherwise. */
export function dateRangeShortL(ev: Pick<CommunityEvent, 'event_date' | 'event_end_date'>, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return dateRangeShort(ev)
  const start = parseEventDate(ev.event_date)
  if (!isMultiDay(ev)) return dateShortL(start, locale)
  const t = eventsT(locale)
  const end = parseEventDate(eventLastDay(ev))
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameYear && start.getMonth() === end.getMonth()) {
    return t('date_range.month', { month: monthName(locale, start, 'short'), start: start.getDate(), end: end.getDate() })
  }
  return t('date_range.span', {
    from: rangeDay(t, locale, start, 'short', !sameYear),
    to: rangeDay(t, locale, end, 'short', !sameYear),
  })
}

/** "November 1 to 30, 2026" for a multi-day event, "Sunday, November 1, 2026" otherwise. */
export function dateRangeLongL(ev: Pick<CommunityEvent, 'event_date' | 'event_end_date'>, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return dateRangeLong(ev)
  const start = parseEventDate(ev.event_date)
  if (!isMultiDay(ev)) return dateLongL(start, locale)
  const t = eventsT(locale)
  const end = parseEventDate(eventLastDay(ev))
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameYear && start.getMonth() === end.getMonth()) {
    return t('date_range.month_year', { month: monthName(locale, start, 'long'), start: start.getDate(), end: end.getDate(), year: end.getFullYear() })
  }
  if (sameYear) {
    return t('date_range.span_year', {
      from: rangeDay(t, locale, start, 'long', false),
      to: rangeDay(t, locale, end, 'long', false),
      year: end.getFullYear(),
    })
  }
  return t('date_range.span', {
    from: rangeDay(t, locale, start, 'long', true),
    to: rangeDay(t, locale, end, 'long', true),
  })
}

// --- Calendar entry notes -------------------------------------------------

const MAX_DESCRIPTION_CHARS = 1500

function trimText(text: string, max: number): string {
  const flat = text.trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).trimEnd()}…`
}

/**
 * The .ics / Google Calendar note in the page's language: the same parts as
 * lib/event-calendar.ts calendarNotes, labelled with the app's
 * community_event.calendar_note words. Null for English, which keeps the
 * shared builder's own note. The event's description stays as listed.
 */
export function calendarNotesL(
  ev: Pick<CommunityEvent, 'body' | 'tags' | 'registration_url' | 'registration_notes' | 'event_url' | 'organizer_name' | 'organizer_url'>,
  pageUrl: string,
  locale: SiteLocale,
): string | null {
  if (locale === 'en') return null
  const t = eventsT(locale)
  const tags = ev.tags ?? []
  const regNotes = (ev.registration_notes ?? '').trim()
  const attend: string[] = []
  if (ev.registration_url) {
    attend.push(`${t(tags.includes('registration_required') ? 'ics.signup_required' : 'ics.signup')} ${ev.registration_url}`)
  }
  if (regNotes) attend.push(regNotes)
  if (ev.event_url && ev.event_url !== ev.registration_url) attend.push(`${t('ics.event_page')} ${ev.event_url}`)
  if (tags.includes('free') && !/^free\b/i.test(regNotes)) attend.push(t('ics.free'))
  if (ev.organizer_name) attend.push(t('ics.hosted_by', { name: ev.organizer_name }))
  if (ev.organizer_url && !ev.event_url && !ev.registration_url) attend.push(ev.organizer_url)
  return [
    trimText(ev.body ?? '', MAX_DESCRIPTION_CHARS),
    attend.join('\n'),
    `${t('ics.details')} ${pageUrl}`,
  ].filter(Boolean).join('\n\n')
}

// --- Languages an event is led in (Shift 01697) -----------------------------

/** "español", "西班牙语": a language's name in the page's language, from Intl. */
export function languageNameL(code: PartnerLanguage, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return languageEnglish(code)
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? languageEnglish(code)
  } catch {
    return languageEnglish(code)
  }
}

/** "español e inglés": the names joined the page's way (lib/languages for English). */
export function languageListL(codes: readonly PartnerLanguage[], locale: SiteLocale = 'en'): string {
  if (locale === 'en') return languageList(codes)
  const names = codes.map((c) => languageNameL(c, locale))
  try {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(names)
  } catch {
    return names.join(', ')
  }
}

/**
 * "Led in Spanish and English" / "In …" (lib/languages for English); in
 * another language, the app's events.led_in with the names in that language,
 * as the ride pages do.
 */
export function ledInLineL(codes: readonly string[] | null | undefined, eventType: string | null | undefined, locale: SiteLocale = 'en'): string | null {
  const english = ledInLine(codes, eventType)
  if (locale === 'en' || english === null) return english
  // lib/languages decides which types someone leads; its English line says which it picked.
  const led = english.startsWith('Led in ')
  return eventsT(locale)(led ? 'lang.led' : 'lang.in', { list: languageListL(eventLanguages(codes), locale) })
}

/**
 * Whether a language's own name ("Español") would only repeat its name in the
 * page's language ("español"), so a chip can leave it off.
 */
export function ownNameRepeats(code: PartnerLanguage, locale: SiteLocale = 'en'): boolean {
  return locale !== 'en' && languageNameL(code, locale).toLocaleLowerCase(locale) === languageLabel(code).toLocaleLowerCase(locale)
}
