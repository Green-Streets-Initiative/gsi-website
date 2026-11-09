import type { ComponentType } from 'react'
import { CurrencyDollar, Gift, HandHeart, Plant, Baby, UsersThree, ClipboardText, Translate } from '@phosphor-icons/react/dist/ssr'
import { eventLanguages, languageList, ownNames, type PartnerLanguage } from '@/lib/languages'
import { PACE_OPTIONS, TAG_OPTIONS, WALK_PACE_OPTIONS, travelMph } from '@/lib/organizers/ride-words'
import { RIDE_STYLE_BLURB, RIDE_STYLE_INK, RIDE_STYLE_LABEL, RIDE_STYLE_ORDER, rideStyle } from '@/lib/ride-style'
import type { PublicRide } from '@/lib/rides/public'
import { MAP_COMFORT_COLORS, comfortBreakdown, comfortableShare, type CalmSegment } from '@/components/commute/calm-route'
import { translator, type SiteLocale, type T } from '@/lib/site-i18n'
import { ridesStrings, type RideKey } from '@/lib/site-strings/rides'

type RT = T<RideKey>
/** A street type's words, rider's or walker's. */
function tierWord(rating: string, walk: boolean, t: RT): string {
  const k = `tier.${rating}`
  const own = (`${k}.${walk ? 'walk' : 'ride'}`) as RideKey
  const v = t(own)
  if (v !== own) return v
  const plain = t(k as RideKey)
  return plain !== k ? plain : TIER_WORDS[rating]?.[walk ? 1 : 0] ?? rating
}

/** The street types as a rider or walker reads them (the console's route review words). */
const TIER_WORDS: Record<string, [string, string]> = {
  path: ['Path', 'Path'],
  protected: ['Protected lane', 'Street with a protected lane'],
  bike_lane: ['Bike lane', 'Street with a bike lane'],
  quiet_street: ['Quiet street', 'Quiet street'],
  shared_road: ['Shared road', 'Busier street'],
}

/** How comfortable the route is: one bar and its share on calm streets, the same maths as the planner and Commute Advisor. */
function ComfortRow({ segments, walk, t }: { segments: CalmSegment[]; walk: boolean; t: RT }) {
  const tiers = comfortBreakdown(segments)
  if (tiers.length === 0) return null
  const pct = Math.round(comfortableShare(segments) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-semibold text-(--ev-ink-75)">{t('calm')}</span>
        <span className="font-display text-[20px] font-extrabold leading-tight text-(--ev-ink)">{pct}%</span>
      </div>
      <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-(--ev-track)" role="img"
        aria-label={tiers.map((x) => `${x.pct}% ${tierWord(x.rating, walk, t)}`).join(', ')}>
        {tiers.map((x) => <span key={x.rating} style={{ width: `${x.pct}%`, background: MAP_COMFORT_COLORS[x.rating] ?? MAP_COMFORT_COLORS.shared_road }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {tiers.map((x) => (
          <li key={x.rating} className="flex items-center gap-1.5 text-[14px] text-(--ev-ink-80)">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: MAP_COMFORT_COLORS[x.rating] ?? MAP_COMFORT_COLORS.shared_road }} aria-hidden />
            {x.pct}% {tierWord(x.rating, walk, t).toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * What a ride is like, laid out the way ride and trail apps do it rather
 * than as one row of look-alike pills (Keith 2026-10-23):
 *  - numbers in a stat strip, label over value, like Strava's route stats
 *    and AllTrails' length / elevation / route type: distance, pace, hills,
 *    riding time;
 *  - the level as a three-step meter, like Komoot's difficulty, with the
 *    calendar's own words for each level (lib/ride-style.ts);
 *  - policies as icon rows with a few words each, like Airbnb's highlights:
 *    no-drop, beginners, cost, sign-up;
 *  - who it's for (women, LGBTQ+, Spanish…) as its own line, since it answers
 *    a different question ("is this for me?") than pace does.
 * The hills words and thresholds are the app's (Shift lib/elevation.ts
 * hilliness), and "Nobody gets dropped" is the app's no-drop line.
 */

/** Shift lib/elevation.ts hilliness: feet of climbing per mile. */
export function hills(ascentFt: number, miles: number): 'Mostly flat' | 'Rolling' | 'Hilly' {
  if (!(miles > 0)) return 'Mostly flat'
  const perMile = ascentFt / miles
  return perMile < 30 ? 'Mostly flat' : perMile < 80 ? 'Rolling' : 'Hilly'
}

function duration(min: number, t: RT): string {
  if (min < 60) return t('dur.min', { n: Math.max(5, Math.round(min / 5) * 5) })
  const h = Math.floor(min / 60)
  const m = Math.round((min % 60) / 15) * 15
  return m === 60 ? t('dur.hr', { h: h + 1 }) : m ? t('dur.hr_min', { h, m }) : t('dur.hr', { h })
}

const HILLS_KEY = { 'Mostly flat': 'hills.flat', Rolling: 'hills.rolling', Hilly: 'hills.hilly' } as const

const AUDIENCE = ['women', 'lgbtq', 'seniors', 'students', 'spanish', 'bilingual', 'family_friendly']

type Icon = ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill'; className?: string; 'aria-hidden'?: boolean }>

export interface RideFactModel {
  /** `key` stays English-free so callers can tell the stats apart in any language. */
  stats: { key: 'distance' | 'pace' | 'hills' | 'time'; label: string; value: string; sub?: string }[]
  level: ReturnType<typeof rideStyle>
  policies: { Icon: Icon; title: string; line: string }[]
  audience: string[]
}

/** "Led in Spanish and English"; in another language, the app's events.led_in with the names in that language. */
function ledIn(langs: PartnerLanguage[], locale: SiteLocale, t: RT): string {
  if (locale === 'en') return `Led in ${languageList(langs)}`
  const names = new Intl.DisplayNames([locale], { type: 'language' })
  return t('lang.led', { list: new Intl.ListFormat(locale, { type: 'conjunction' }).format(langs.map((c) => names.of(c) ?? c)) })
}

/** The facts themselves, for the ride page here and the printed flyer. */
export function rideFacts(ride: PublicRide, miles: number | null, ascentFt: number | null, locale: SiteLocale = 'en'): RideFactModel {
  const t = translator(ridesStrings, locale)
  const walk = ride.activity === 'walk'
  const pace = (walk ? WALK_PACE_OPTIONS : PACE_OPTIONS).find((p) => p.key === ride.pace) ?? null
  const tags = ride.tags ?? []
  const langs = eventLanguages(ride.languages)
  const mph = travelMph(ride.pace, walk ? 'walk' : 'bike')
  const ridingMin = miles && mph ? (miles / mph) * 60 : null
  // A walk has no bike-ride level (rideStyle answers only for rides).
  const level = rideStyle({ title: ride.name, description: ride.description, distanceText: miles ? `${miles} miles` : null, tags, pace: ride.pace, eventType: walk ? 'walking_tour' : 'group_ride' })

  // Pace words by key (the console's English tables are the fallback); bike speeds stay as written ("8–12 mph").
  const word = (k: string, en: string) => { const v = t(k as RideKey); return locale === 'en' || v === k ? en : v }
  const paceLabel = pace ? word(`pace.${pace.key}`, pace.label) : ''
  const paceWalk = pace ? word(`wpace.${pace.key}`, pace.mph) : ''
  const numLocale = locale === 'en' ? undefined : locale
  const milesText = miles ? (miles < 10 ? miles.toFixed(1) : String(Math.round(miles))) : ''
  const stats = [
    miles ? { key: 'distance', label: t('stat.distance'), value: t('stat.mi', { n: locale === 'en' ? milesText : Number(milesText).toLocaleString(locale, { minimumFractionDigits: miles < 10 ? 1 : 0 }) }) } : null,
    // A ride's pace reads as its speed; a walk's as its word, with what it means.
    pace ? (walk ? { key: 'pace', label: t('stat.pace'), value: paceLabel, sub: paceWalk } : { key: 'pace', label: t('stat.pace'), value: pace.mph, sub: paceLabel }) : null,
    ascentFt != null && miles ? { key: 'hills', label: t('stat.hills'), value: t(HILLS_KEY[hills(ascentFt, miles)]), sub: t('stat.climb', { ft: ascentFt.toLocaleString(numLocale) }) } : null,
    ridingMin ? { key: 'time', label: t(walk ? 'stat.walk_time' : 'stat.ride_time'), value: t('stat.about', { d: duration(ridingMin, t) }), sub: t('stat.plus_stops') } : null,
  ].filter(Boolean) as RideFactModel['stats']

  const w = walk ? 'walk' : 'ride'
  const policies = [
    ride.no_drop === true ? { Icon: HandHeart, title: t('pol.nodrop'), line: t('pol.nodrop_line') } : ride.no_drop === false && !walk ? { Icon: UsersThree, title: t('pol.drop'), line: t('pol.drop_line') } : null,
    // A ride the level calls Rec isn't beginner friendly whatever its tag
    // says (a "beginner road ride" is beginner at the sport): the same guard
    // the calendar sync applies (Shift sync-community-events, Keith 2026-09-14).
    tags.includes('beginner_friendly') && level !== 'rec' ? { Icon: Plant, title: t('pol.beginner'), line: t(`pol.beginner.${w}`) } : null,
    tags.includes('family_friendly') ? { Icon: Baby, title: t('pol.family'), line: t('pol.family_line') } : null,
    tags.includes('free') ? { Icon: Gift, title: t('pol.free'), line: t(`pol.free.${w}`) } : tags.includes('paid') ? { Icon: CurrencyDollar, title: t('pol.paid'), line: t('pol.paid_line') } : null,
    tags.includes('registration_required') ? { Icon: ClipboardText, title: t('pol.signup'), line: t('pol.signup_line') } : null,
    // The language it's led in (Shift 01697), each also in its own words.
    langs.length > 0 ? { Icon: Translate, title: ledIn(langs, locale, t), line: ownNames(langs) } : null,
  ].filter(Boolean) as { Icon: Icon; title: string; line: string }[]

  // The language row says Spanish / bilingual already.
  const audience = tags.filter((g) => AUDIENCE.includes(g) && g !== 'family_friendly' && !(langs.length > 0 && (g === 'spanish' || g === 'bilingual'))).map((g) => {
    const k = `tag.${g}` as RideKey
    const v = t(k)
    return v !== k ? v : TAG_OPTIONS.find((o) => o.key === g)?.label
  }).filter(Boolean) as string[]
  return { stats, level, policies, audience }
}

export default function RideFacts({ ride, miles, ascentFt, comfort = null, className = 'mt-5', locale = 'en' }: {
  ride: PublicRide; miles: number | null; ascentFt: number | null; className?: string
  locale?: SiteLocale
  /** The route's comfort pieces, when this date rides the ride's own route. */
  comfort?: CalmSegment[] | null
}) {
  const t = translator(ridesStrings, locale)
  const { stats, level, policies, audience } = rideFacts(ride, miles, ascentFt, locale)
  const calm = comfort && comfort.length > 0 ? comfort : null
  if (stats.length === 0 && !level && policies.length === 0 && audience.length === 0 && !calm) return null

  return (
    <div className={`${className} overflow-hidden rounded-2xl border border-(--ev-line) bg-(--ev-card)`}>
      {stats.length > 0 && (
        <dl className={`grid ${stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {stats.map((s, i) => (
            <div key={s.key} className={`px-4 py-3.5 ${i % 2 === 1 ? 'border-l border-(--ev-line)' : ''} ${i >= 2 ? 'border-t border-(--ev-line) sm:border-t-0' : ''} ${i > 0 ? 'sm:border-l sm:border-(--ev-line)' : ''}`}>
              <dt className="text-[14px] font-semibold text-(--ev-ink-75)">{s.label}</dt>
              <dd className="mt-0.5 font-display text-[20px] font-extrabold leading-tight text-(--ev-ink)">{s.value}</dd>
              {s.sub && <dd className="text-[14px] text-(--ev-ink-75)">{s.sub}</dd>}
            </div>
          ))}
        </dl>
      )}

      {calm && (
        <div className={`px-4 py-4 ${stats.length > 0 ? 'border-t border-(--ev-line)' : ''}`}>
          <ComfortRow segments={calm} walk={ride.activity === 'walk'} t={t} />
        </div>
      )}

      {(level || policies.length > 0 || audience.length > 0) && (
        <div className={`grid gap-4 px-4 py-4 ${stats.length > 0 || calm ? 'border-t border-(--ev-line)' : ''}`}>
          {level && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[14px] font-semibold text-(--ev-ink-75)">{t('level')}</span>
              <span className="flex gap-1" role="img" aria-label={t('level_aria', { label: t(`lvl.${level}` as RideKey), n: RIDE_STYLE_ORDER.indexOf(level) + 1 })}>
                {RIDE_STYLE_ORDER.map((l, i) => (
                  <span key={l} className="h-2.5 w-8 rounded-full"
                    style={{ background: i <= RIDE_STYLE_ORDER.indexOf(level) ? RIDE_STYLE_INK[level] : 'var(--ev-line-strong)' }} />
                ))}
              </span>
              <span className="text-[15px] font-bold" style={{ color: RIDE_STYLE_INK[level] }}>{locale === 'en' ? (RIDE_STYLE_LABEL[level] === 'Rec' ? 'Recreational' : RIDE_STYLE_LABEL[level]) : t(`lvl.${level}` as RideKey)}</span>
              <span className="text-[14px] text-(--ev-ink-80)">{locale === 'en' ? RIDE_STYLE_BLURB[level] : t(`lvlb.${level}` as RideKey)}</span>
            </div>
          )}

          {policies.length > 0 && (
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {policies.map(({ Icon, title, line }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ev-accent-tint-15) text-(--ev-accent)">
                    <Icon size={20} weight="regular" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold text-(--ev-ink)">{title}</span>
                    <span className="block text-[14px] text-(--ev-ink-80)">{line}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {audience.length > 0 && (
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold text-(--ev-ink-75)">{t('especially')}</span>
              {audience.map((a) => <span key={a} className="rounded-full border border-(--ev-line-strong) px-3 py-1 text-[14px] font-semibold text-(--ev-ink)">{a}</span>)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
