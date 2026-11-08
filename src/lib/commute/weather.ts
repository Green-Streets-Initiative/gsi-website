/**
 * The forecast for the plan's morning (product item 17: weather per way in).
 * The National Weather Service hourly forecast, read the way the Shift app's
 * Home card reads it (Shift supabase/functions/commute-advisor-realtime,
 * fetchNwsHourly and evaluateWeather), but for the hour each way in leaves
 * rather than the next two hours: the plan is for the next commute morning.
 *
 * Pure except fetchNwsHours, which the /api/commute/weather route calls.
 * Nothing here sees an address: the route gets a point rounded to ~1 km.
 *
 * Words take an optional locale (default 'en', which the tests and the
 * rides forecast use). Imports are relative with the extension so
 * node --test runs this file as is.
 */

import { siteDate, translator, type SiteLocale } from '../site-i18n.ts'
import { advisorStrings } from '../site-strings/advisor.ts'

const tr = (locale: SiteLocale) => translator(advisorStrings, locale)

export interface WeatherHour {
  /** NWS startTime, local to the point ("2026-10-22T08:00:00-04:00"). */
  start: string
  tempF: number
  /** NWS shortForecast, lowercased ("chance light rain"). */
  condition: string
  windMph: number
  /** Chance of precipitation, 0-100. */
  precipPct: number
}

export type WeatherFlag = 'rain' | 'snow' | 'cold' | 'heat' | 'severe'

export interface MorningWeather {
  /** "YYYY-MM-DD" of the morning the plan is for. */
  date: string
  /** "This morning", "Tomorrow morning", "Monday morning". */
  dayLabel: string
  /** The hour around leave-by, at the point. */
  hour: WeatherHour
  flags: WeatherFlag[]
}

/** How a way in meets the weather: outside the whole way, waiting at a stop, or not at all. */
export type Exposure = 'active' | 'wait' | 'none'

/** At or under this, a wait at a stop or a ride needs real layers (15 minutes standing at 40°F is cold). */
export const COLD_F = 40
/** At or over this, a ride or a walk needs water and light clothes. */
export const HEAT_F = 85
/** A chance of rain at or over this is worth packing for. */
export const RAIN_PCT = 40

const NWS_HEADERS = { 'User-Agent': '(Shift by Green Streets Initiative, shift@greenstreets.org)', Accept: 'application/geo+json' }

/** The hourly forecast at a point (about a week of hours); [] when NWS can't answer. */
export async function fetchNwsHours(lat: number, lng: number, revalidate = 1800): Promise<WeatherHour[]> {
  try {
    const points = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, {
      headers: NWS_HEADERS,
      // The grid a point falls in never changes.
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!points.ok) return []
    const pdata = await points.json()
    const url: string | undefined = pdata?.properties?.forecastHourly
    if (!url) return []
    const fc = await fetch(url, { headers: NWS_HEADERS, next: { revalidate } })
    if (!fc.ok) return []
    const fcdata = await fc.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((fcdata?.properties?.periods ?? []) as any[]).map((p) => ({
      start: String(p.startTime ?? ''),
      tempF: typeof p.temperature === 'number' ? p.temperature : 0,
      condition: String(p.shortForecast ?? '').toLowerCase(),
      windMph: parseInt(String(p.windSpeed ?? '0'), 10) || 0,
      precipPct: p.probabilityOfPrecipitation?.value ?? 0,
    })).filter((h) => h.start.length >= 13)
  } catch {
    return []
  }
}

/** The app's severe test (evaluateWeather's severeForActive), for one hour. */
function isSevere(h: WeatherHour): boolean {
  const c = h.condition
  return (h.precipPct >= 80 && (c.includes('thunder') || c.includes('heavy rain') || c.includes('heavy snow') || c.includes('sleet')))
    || c.includes('tornado') || c.includes('freezing rain') || c.includes('ice storm') || c.includes('blizzard')
    || h.windMph >= 35 || h.tempF < 10 || h.tempF > 105
}

/** What an hour asks of someone outside in it. */
export function flagsFor(h: WeatherHour): WeatherFlag[] {
  const c = h.condition
  const flags: WeatherFlag[] = []
  if (isSevere(h)) flags.push('severe')
  const snowy = /snow|sleet|flurr|ice|wintry/.test(c)
  const wet = /rain|shower|thunder|drizzle/.test(c)
  if (snowy && (h.precipPct >= RAIN_PCT || !/chance|slight/.test(c))) flags.push('snow')
  else if (wet && (h.precipPct >= RAIN_PCT || !/chance|slight/.test(c))) flags.push('rain')
  else if (h.precipPct >= 60) flags.push(h.tempF <= 32 ? 'snow' : 'rain')
  if (h.tempF <= COLD_F) flags.push('cold')
  if (h.tempF >= HEAT_F) flags.push('heat')
  return flags
}

/** Today's date and time in Massachusetts, whatever the server's or browser's zone. */
function bostonNow(now: Date): { date: string; hhmm: string; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hhmm: `${get('hour')}:${get('minute')}`, weekday: wd }
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "Monday morning" for a weekday (0 = Sunday) in the page's language. */
function weekdayMorning(wd: number, locale: SiteLocale): string {
  if (locale === 'en') return `${WEEKDAYS[wd]} morning`
  // 2026-11-01 was a Sunday; noon UTC keeps the day the same in every zone the site runs in.
  const day = siteDate(locale, Date.UTC(2026, 10, 1 + wd, 12), { weekday: 'long', timeZone: 'UTC' })
  const label = tr(locale)('wx.weekday_morning', { day })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * The morning a plan is for: today if it is a weekday and the person hasn't
 * left yet, else the next weekday. `leaveBy` is "HH:MM".
 */
export function planMorning(leaveBy: string, now: Date = new Date(), locale: SiteLocale = 'en'): { date: string; dayLabel: string } {
  const t = tr(locale)
  const b = bostonNow(now)
  const isWeekday = (wd: number) => wd >= 1 && wd <= 5
  if (isWeekday(b.weekday) && b.hhmm < leaveBy) return { date: b.date, dayLabel: t('wx.this_morning') }
  for (let n = 1; n <= 7; n++) {
    const wd = (b.weekday + n) % 7
    if (!isWeekday(wd)) continue
    return { date: addDays(b.date, n), dayLabel: n === 1 ? t('wx.tomorrow_morning') : weekdayMorning(wd, locale) }
  }
  return { date: addDays(b.date, 1), dayLabel: t('wx.tomorrow_morning') }
}

/** The forecast hour that holds `hhmm` on `date`; NWS times are local to the point (Eastern here). */
export function hourAt(hours: WeatherHour[], date: string, hhmm: string): WeatherHour | null {
  const key = `${date}T${hhmm.slice(0, 2)}`
  return hours.find((h) => h.start.startsWith(key)) ?? null
}

/** "This morning", "Tomorrow morning" or "Monday morning" for a "YYYY-MM-DD". */
export function dayLabelFor(date: string, now: Date = new Date(), locale: SiteLocale = 'en'): string {
  const t = tr(locale)
  const today = bostonNow(now).date
  if (date === today) return t('wx.this_morning')
  if (date === addDays(today, 1)) return t('wx.tomorrow_morning')
  const [y, m, d] = date.split('-').map(Number)
  return weekdayMorning(new Date(Date.UTC(y, m - 1, d)).getUTCDay(), locale)
}

/**
 * The weather for one leave-by: the hour it falls in, with the next hour's
 * flags too (a 40-minute ride crosses one). `routeDate` is the morning the
 * engine routed for; a stale one (a plan kept from last week) gives way to
 * the next commute morning.
 */
export function morningWeather(hours: WeatherHour[], leaveBy: string, routeDate?: string | null, now: Date = new Date(), locale: SiteLocale = 'en'): MorningWeather | null {
  if (hours.length === 0 || !/^\d{2}:\d{2}$/.test(leaveBy)) return null
  const today = bostonNow(now).date
  const { date, dayLabel } = routeDate && /^\d{4}-\d{2}-\d{2}$/.test(routeDate) && routeDate >= today
    ? { date: routeDate, dayLabel: dayLabelFor(routeDate, now, locale) }
    : planMorning(leaveBy, now, locale)
  const hour = hourAt(hours, date, leaveBy)
  // The routed morning's hour has passed (a plan made at 8 for 8:10): the next commute morning.
  if (!hour) return routeDate ? morningWeather(hours, leaveBy, null, now, locale) : null
  const nextHH = String(Math.min(23, Number(leaveBy.slice(0, 2)) + 1)).padStart(2, '0')
  const next = hourAt(hours, date, `${nextHH}:00`)
  const flags = new Set<WeatherFlag>([...flagsFor(hour), ...(next ? flagsFor(next) : [])])
  return { date, dayLabel, hour, flags: [...flags] }
}

/** How each way in meets the weather. Driving doesn't; a park-and-ride waits on the platform. */
export function exposureFor(mode: string): Exposure {
  switch (mode) {
    case 'bike':
    case 'ebike':
    case 'walk':
    case 'bike_ride':
      return 'active'
    case 'drive':
    case 'rideshare':
      return 'none'
    default:
      return 'wait'
  }
}

/** The flags that matter for a way in: heat only for the active ones, nothing for driving. */
export function flagsForMode(w: MorningWeather | null | undefined, mode: string): WeatherFlag[] {
  if (!w) return []
  const ex = exposureFor(mode)
  if (ex === 'none') return []
  return w.flags.filter((f) => ex === 'active' || f !== 'heat')
}

/**
 * The Wear stage from the forecast, four words at most. Null when there is
 * no forecast, so the caller can fall back.
 */
export function wearFor(w: MorningWeather | null | undefined, mode: string, locale: SiteLocale = 'en'): string | null {
  if (!w) return null
  const t = tr(locale)
  const ex = exposureFor(mode)
  if (ex === 'none') return t('wx.wear_anything')
  const f = new Set(flagsForMode(w, mode))
  if (f.has('snow')) return t('wx.wear_snow')
  if (f.has('rain') && f.has('cold')) return t('wx.wear_rain_cold')
  if (f.has('rain')) return t(ex === 'wait' ? 'wx.wear_rain_wait' : 'wx.wear_rain')
  if (f.has('cold')) return t(ex === 'wait' ? 'wx.wear_cold_wait' : 'wx.wear_cold')
  if (f.has('heat')) return t('wx.wear_heat')
  return t('wx.wear_anything')
}

/** "Rain", "34°F" and the like: the short chip a row shows when the weather matters to it. */
export function chipFor(w: MorningWeather | null | undefined, mode: string, locale: SiteLocale = 'en'): { flag: WeatherFlag; label: string } | null {
  const f = flagsForMode(w, mode)
  if (!w || f.length === 0) return null
  const t = tr(locale)
  if (f.includes('severe')) return { flag: 'severe', label: t('wx.chip_severe') }
  if (f.includes('snow')) return { flag: 'snow', label: t('wx.chip_snow') }
  if (f.includes('rain')) return { flag: 'rain', label: t('wx.chip_rain') }
  if (f.includes('cold')) return { flag: 'cold', label: `${w.hour.tempF}°F` }
  if (f.includes('heat')) return { flag: 'heat', label: `${w.hour.tempF}°F` }
  return null
}

/** "41°F, light rain" for the line under the headline. */
export function summaryFor(w: MorningWeather, locale: SiteLocale = 'en'): string {
  const cond = w.hour.condition.replace(/^(slight )?chance /, '').trim()
  const showRain = w.hour.precipPct >= RAIN_PCT && !/rain|shower|thunder|drizzle|snow|sleet/.test(cond)
  const showChance = /^(slight )?chance /.test(w.hour.condition) && w.hour.precipPct > 0
  if (locale === 'en') {
    const rain = showRain ? `, ${w.hour.precipPct}% chance of rain` : ''
    const chance = showChance ? `, ${w.hour.precipPct}% chance` : ''
    return `${w.hour.tempF}°F, ${cond || 'no forecast detail'}${chance}${rain}`
  }
  // Other languages: the forecast's words come from NWS in English, so only
  // the common ones are said (CONDITION_KEYS); any other reads as the
  // temperature alone, never as English in the middle of the sentence.
  const t = tr(locale)
  const vars = { temp: w.hour.tempF, pct: w.hour.precipPct }
  const known = conditionWords(cond, locale)
  if (!known) return showRain || showChance ? t('wx.summary_temp_rain', vars) : t('wx.summary_temp', vars)
  if (showRain) return t('wx.summary_rain', { ...vars, cond: known })
  if (showChance) return t('wx.summary_chance', { ...vars, cond: known })
  return t('wx.summary', { ...vars, cond: known })
}

/** NWS shortForecast wording (lowercased, "chance" already stripped) the site can say in every language. */
const CONDITION_KEYS = {
  'sunny': 'wx.cond.sunny',
  'mostly sunny': 'wx.cond.mostly_sunny',
  'partly sunny': 'wx.cond.partly_sunny',
  'clear': 'wx.cond.clear',
  'mostly clear': 'wx.cond.mostly_clear',
  'partly cloudy': 'wx.cond.partly_cloudy',
  'mostly cloudy': 'wx.cond.mostly_cloudy',
  'cloudy': 'wx.cond.cloudy',
  'fog': 'wx.cond.fog',
  'areas of fog': 'wx.cond.patchy_fog',
  'patchy fog': 'wx.cond.patchy_fog',
  'drizzle': 'wx.cond.drizzle',
  'light rain': 'wx.cond.light_rain',
  'rain': 'wx.cond.rain',
  'heavy rain': 'wx.cond.heavy_rain',
  'rain showers': 'wx.cond.rain_showers',
  'light snow': 'wx.cond.light_snow',
  'snow': 'wx.cond.snow',
  'heavy snow': 'wx.cond.heavy_snow',
  'snow showers': 'wx.cond.snow_showers',
  'rain and snow': 'wx.cond.rain_and_snow',
  'rain and snow showers': 'wx.cond.rain_and_snow',
  'sleet': 'wx.cond.sleet',
  'freezing rain': 'wx.cond.freezing_rain',
  'thunderstorms': 'wx.cond.thunderstorms',
  'showers and thunderstorms': 'wx.cond.showers_and_thunderstorms',
  'windy': 'wx.cond.windy',
} as const

function conditionWords(cond: string, locale: SiteLocale): string | null {
  // "rain likely", "patchy drizzle", "light rain then cloudy": the first, plain part.
  const c = cond.replace(/\s+likely$/, '').split(/ then | and areas of /)[0].trim()
  const key = (CONDITION_KEYS as Record<string, (typeof CONDITION_KEYS)[keyof typeof CONDITION_KEYS]>)[c]
    ?? (CONDITION_KEYS as Record<string, (typeof CONDITION_KEYS)[keyof typeof CONDITION_KEYS]>)[c.replace(/^(patchy|isolated|scattered|areas of) /, '')]
  return key ? tr(locale)(key) : null
}
