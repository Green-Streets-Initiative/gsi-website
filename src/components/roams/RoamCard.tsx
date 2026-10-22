import Link from 'next/link'
import PhotoCredit from '@/components/PhotoCredit'
import { MapPin, UsersRound } from 'lucide-react'
import type { RoamSummary } from '@/lib/roams/queries'

/** Minimum shape the card needs — TownRoam (towns/queries) also satisfies it. */
export type RoamCardData = Omit<RoamSummary, 'featured' | 'tagline'> & { tagline?: string | null }

const MIN_COMPLETIONS_TO_SHOW = 10

const MODE_LABEL: Record<string, string> = {
  bike: 'Bike',
  walk: 'Walk',
  transit: 'Transit',
  multi: 'Walk + transit',
}

/** "27 min", "1 hr 30 min", "7 hr" — minutes past an hour round to 5. */
export function roamDuration(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = Math.round((m % 60) / 5) * 5
  return rest === 60 ? `${h + 1} hr` : rest ? `${h} hr ${rest} min` : `${h} hr`
}

export function roamMetaLine(r: {
  mode: string
  distance_miles: number | null
  estimated_minutes: number | null
}): string {
  return [
    MODE_LABEL[r.mode] ?? r.mode,
    r.distance_miles != null ? `${r.distance_miles} mi` : null,
    r.estimated_minutes != null ? roamDuration(r.estimated_minutes) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

type Tone = 'dark' | 'light' | 'nearby'

// `light` is the cream campaign pages; `dark` (default) keeps every existing
// caller byte-identical. `nearby` paints from the /nearby --nb-* variables, so
// it matches whichever surface that page is on — on the cream surface the
// `dark` card put white text on near-white.
const THEME: Record<Tone, { card: string; name: string; meta: string; start: string; hook: string; done: string; group: string }> = {
  dark: {
    card: 'block overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.04] transition-colors hover:bg-white/[0.07]',
    name: 'text-sm font-semibold leading-snug text-white',
    meta: 'text-xs text-white/75',
    start: 'font-semibold text-white',
    hook: 'mt-1.5 text-xs leading-snug text-white/75',
    done: 'mt-2 flex items-center gap-1 text-[10px] text-white/70',
    group: 'mt-2 flex items-center gap-1.5 text-xs font-semibold text-gold',
  },
  light: {
    card: 'block overflow-hidden rounded-[14px] border border-navy/10 bg-white transition-colors hover:border-navy/30',
    name: 'text-[15px] font-semibold leading-snug text-navy',
    meta: 'text-[13px] text-ink-soft',
    start: 'font-semibold text-forest',
    hook: 'mt-1.5 text-[13px] leading-snug text-ink-soft',
    done: 'mt-2 flex items-center gap-1 text-[11px] text-ink-soft',
    group: 'mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-forest',
  },
  nearby: {
    card: 'block overflow-hidden rounded-[14px] border border-(--nb-line-mid) bg-(--nb-card) transition-colors hover:border-(--nb-line-strong)',
    name: 'text-sm font-semibold leading-snug text-(--nb-ink)',
    meta: 'text-xs text-(--nb-ink-80)',
    start: 'font-semibold text-(--nb-ink)',
    hook: 'mt-1.5 text-xs leading-snug text-(--nb-ink-80)',
    done: 'mt-2 flex items-center gap-1 text-[10px] text-(--nb-ink-70)',
    group: 'mt-2 flex items-center gap-1.5 text-xs font-semibold text-(--nb-ink)',
  },
}

/** "Sun, Oct 25" in Boston time. */
export function shortEventDay(date: string): string {
  return new Date(`${date}T12:00:00-04:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

/** Where a roam starts relative to the page it's listed on. `near` reads
 *  when it starts right there ("on campus"), `from` otherwise ("from campus"). */
export type RoamStart = { miles: number; near: string; from: string }

const ON_THE_SPOT_MILES = 0.15

function startLine(s: RoamStart): string {
  if (s.miles < ON_THE_SPOT_MILES) return `Starts ${s.near}`
  const mi = s.miles < 10 ? Math.round(s.miles * 10) / 10 : Math.round(s.miles)
  return `Starts ${mi} mi ${s.from}`
}

/** Hero-image roam card, shared by the roams index, the town pages, and the school pages.
 *  With `start`, the meta line leads with where it starts and calls the
 *  length the route's — "7.3 mi" alone read as "7.3 mi away" on school pages. */
export default function RoamCard({
  roam,
  tone = 'dark',
  start,
  nextGroupDate,
  filterable = false,
}: {
  roam: RoamCardData
  tone?: Tone
  start?: RoamStart
  /** YYYY-MM-DD of the next group ride or walk on this roam. */
  nextGroupDate?: string | null
  /** Adds the data the roams hub filters read (RoamHubFilters). */
  filterable?: boolean
}) {
  const t = THEME[tone]
  const meta = roamMetaLine(roam)
  const data = filterable
    ? {
        'data-roam-card': '',
        'data-minutes': roam.estimated_minutes ?? '',
        'data-lat': roam.start_lat ?? '',
        'data-lng': roam.start_lng ?? '',
        'data-group': nextGroupDate ? '1' : '0',
      }
    : {}
  // The whole card opens the roam (the title link stretches over it); the photo
  // credit's own links sit above that, as Unsplash's guidelines need.
  return (
    <div className={`${t.card} relative h-full`} {...data}>
      {roam.hero_image_url && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roam.hero_image_url}
            alt=""
            loading="lazy"
            className="h-32 w-full object-cover"
          />
          {roam.hero_image_attribution && (
            <PhotoCredit
              text={roam.hero_image_attribution}
              url={roam.hero_image_attribution_url}
              className="absolute bottom-1.5 right-1.5 z-10 max-w-[92%] rounded-[8px] bg-navy/65 px-2 py-0.5 text-[10.5px] leading-tight text-white/90 backdrop-blur-sm"
              linkClassName="underline decoration-white/50 underline-offset-2 hover:decoration-white"
            />
          )}
        </div>
      )}
      <div className="p-4">
        <p className={t.name}>
          <Link href={`/shift/roams/${encodeURIComponent(roam.id)}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-[14px] focus-visible:after:ring-2 focus-visible:after:ring-forest">
            {roam.name}
          </Link>
        </p>
        <p className={`mt-0.5 ${t.meta}`}>
          {filterable && <span data-roam-distance hidden className={t.start} />}
          {start && <span className={t.start}>{startLine(start)} · </span>}
          {start && roam.distance_miles != null ? meta.replace(`${roam.distance_miles} mi`, `${roam.distance_miles} mi route`) : meta}
          {roam.region ? ` · ${roam.region}` : ''}
        </p>
        {/* Every card gets its one line: the hook, or the tagline when there's no hook. */}
        {(roam.hook || roam.tagline) && <p className={t.hook}>{roam.hook || roam.tagline}</p>}
        {nextGroupDate && (
          <p className={t.group}>
            <UsersRound size={13} aria-hidden />
            Next group ride: {shortEventDay(nextGroupDate)}
          </p>
        )}
        {roam.completion_count >= MIN_COMPLETIONS_TO_SHOW && (
          <p className={t.done}>
            <MapPin size={9} />
            {roam.completion_count} completed
          </p>
        )}
      </div>
    </div>
  )
}
