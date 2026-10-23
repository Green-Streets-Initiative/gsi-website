import type { ComponentType } from 'react'
import { CurrencyDollar, Gift, HandHeart, Plant, Baby, UsersThree, ClipboardText } from '@phosphor-icons/react/dist/ssr'
import { PACE_MID_MPH, PACE_OPTIONS, TAG_OPTIONS } from '@/lib/organizers/ride-words'
import { RIDE_STYLE_BLURB, RIDE_STYLE_INK, RIDE_STYLE_LABEL, RIDE_STYLE_ORDER, rideStyle } from '@/lib/ride-style'
import type { PublicRide } from '@/lib/rides/public'

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

function duration(min: number): string {
  if (min < 60) return `${Math.max(5, Math.round(min / 5) * 5)} min`
  const h = Math.floor(min / 60)
  const m = Math.round((min % 60) / 15) * 15
  return m === 60 ? `${h + 1} hr` : m ? `${h} hr ${m} min` : `${h} hr`
}

const AUDIENCE = ['women', 'lgbtq', 'seniors', 'students', 'spanish', 'bilingual', 'family_friendly']

type Icon = ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill'; className?: string; 'aria-hidden'?: boolean }>

export interface RideFactModel {
  stats: { label: string; value: string; sub?: string }[]
  level: ReturnType<typeof rideStyle>
  policies: { Icon: Icon; title: string; line: string }[]
  audience: string[]
}

/** The facts themselves, for the ride page here and the printed flyer. */
export function rideFacts(ride: PublicRide, miles: number | null, ascentFt: number | null): RideFactModel {
  const pace = PACE_OPTIONS.find((p) => p.key === ride.pace) ?? null
  const tags = ride.tags ?? []
  const ridingMin = miles && ride.pace && PACE_MID_MPH[ride.pace] ? (miles / PACE_MID_MPH[ride.pace]) * 60 : null
  const level = rideStyle({ title: ride.name, description: ride.description, distanceText: miles ? `${miles} miles` : null, tags, pace: ride.pace, eventType: 'group_ride' })

  const stats = [
    miles ? { label: 'Distance', value: `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi` } : null,
    pace ? { label: 'Pace', value: pace.mph, sub: pace.label } : null,
    ascentFt != null && miles ? { label: 'Hills', value: hills(ascentFt, miles), sub: `${ascentFt.toLocaleString()} ft of climbing` } : null,
    ridingMin ? { label: 'Riding time', value: `About ${duration(ridingMin)}`, sub: 'Plus any stops' } : null,
  ].filter(Boolean) as { label: string; value: string; sub?: string }[]

  const policies = [
    ride.no_drop === true ? { Icon: HandHeart, title: 'No-drop', line: 'Nobody gets dropped' } : ride.no_drop === false ? { Icon: UsersThree, title: 'Drop ride', line: 'The group may split up' } : null,
    tags.includes('beginner_friendly') ? { Icon: Plant, title: 'Beginner friendly', line: 'Good for a first group ride' } : null,
    tags.includes('family_friendly') ? { Icon: Baby, title: 'Family friendly', line: 'Kids are welcome' } : null,
    tags.includes('free') ? { Icon: Gift, title: 'Free', line: 'No cost to ride' } : tags.includes('paid') ? { Icon: CurrencyDollar, title: 'Paid', line: 'The organizer charges a fee' } : null,
    tags.includes('registration_required') ? { Icon: ClipboardText, title: 'Sign-up required', line: 'Register with the organizer' } : null,
  ].filter(Boolean) as { Icon: Icon; title: string; line: string }[]

  const audience = tags.filter((t) => AUDIENCE.includes(t) && t !== 'family_friendly').map((t) => TAG_OPTIONS.find((o) => o.key === t)?.label).filter(Boolean) as string[]
  return { stats, level, policies, audience }
}

export default function RideFacts({ ride, miles, ascentFt }: { ride: PublicRide; miles: number | null; ascentFt: number | null }) {
  const { stats, level, policies, audience } = rideFacts(ride, miles, ascentFt)
  if (stats.length === 0 && !level && policies.length === 0 && audience.length === 0) return null

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-(--ev-line) bg-(--ev-card)">
      {stats.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`px-4 py-3.5 ${i % 2 === 1 ? 'border-l border-(--ev-line)' : ''} ${i >= 2 ? 'border-t border-(--ev-line) sm:border-t-0' : ''} ${i > 0 ? 'sm:border-l sm:border-(--ev-line)' : ''}`}>
              <dt className="text-[13px] font-semibold text-(--ev-ink-75)">{s.label}</dt>
              <dd className="mt-0.5 font-display text-[20px] font-extrabold leading-tight text-(--ev-ink)">{s.value}</dd>
              {s.sub && <dd className="text-[13px] text-(--ev-ink-75)">{s.sub}</dd>}
            </div>
          ))}
        </dl>
      )}

      {(level || policies.length > 0 || audience.length > 0) && (
        <div className={`grid gap-4 px-4 py-4 ${stats.length > 0 ? 'border-t border-(--ev-line)' : ''}`}>
          {level && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[13px] font-semibold text-(--ev-ink-75)">Level</span>
              <span className="flex gap-1" role="img" aria-label={`Level: ${RIDE_STYLE_LABEL[level]}, ${RIDE_STYLE_ORDER.indexOf(level) + 1} of 3`}>
                {RIDE_STYLE_ORDER.map((l, i) => (
                  <span key={l} className="h-2.5 w-8 rounded-full"
                    style={{ background: i <= RIDE_STYLE_ORDER.indexOf(level) ? RIDE_STYLE_INK[level] : 'var(--ev-line-strong)' }} />
                ))}
              </span>
              <span className="text-[15px] font-bold" style={{ color: RIDE_STYLE_INK[level] }}>{RIDE_STYLE_LABEL[level] === 'Rec' ? 'Recreational' : RIDE_STYLE_LABEL[level]}</span>
              <span className="text-[14px] text-(--ev-ink-80)">{RIDE_STYLE_BLURB[level]}</span>
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
              <span className="text-[13px] font-semibold text-(--ev-ink-75)">Especially for</span>
              {audience.map((a) => <span key={a} className="rounded-full border border-(--ev-line-strong) px-3 py-1 text-[14px] font-semibold text-(--ev-ink)">{a}</span>)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
