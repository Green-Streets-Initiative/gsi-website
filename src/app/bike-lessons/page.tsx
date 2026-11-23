import type { Metadata } from 'next'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import StoreBadges from '@/components/StoreBadges'
import PhotoCredit from '@/components/PhotoCredit'
import LessonAlertForm from '@/components/guides/LessonAlertForm'
import type { Placement } from '@/components/home/tracking'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { eventPath } from '@/lib/events-url'
import { BUTTON, CONTAINER, GSI_FONT, H3 } from '@/app/move-in/sign'
import JumpBar from './JumpBar'
import FreeLessonForm from './FreeLessonForm'
import RideCards, { type RideCard } from './RideCards'
import { siteLocale } from '@/lib/site-locale'
import { SITE_LOCALE_TAG, translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { bikeLessonsStrings } from '@/lib/site-strings/bike-lessons'

/*
 * gogreenstreets.org/bike-lessons: the free one-on-one street lesson, for
 * adults who can ride but whom busy streets scare (persona `first-timer`).
 *
 * Rebuilt 2026-11-18 (Keith: "CLEAR, SIMPLE, persona-aligned, not a
 * totem-pole page"; ad visitors left in about 4 seconds). One page, one job:
 *   1. The offer and the form, on the first screen at phone and desktop
 *      width, headlined in the learners' own words.
 *   2. How it works, in three steps. Who teaches comes up in the form once
 *      the learner's ZIP and times are in (Keith 2026-11-18: the instructor
 *      map was "not a thing someone coming to this form needs to see").
 *   3. Classes, for people who never learned (Ad Grants "bike lessons" search).
 *   4. Easy group rides, for people who'd like company.
 * A jump bar keeps the four reachable. The form asks one instructor at a time
 * (Shift 01750, the free-lessons function).
 *
 * Listings come live from get_bike_lessons (Shift 01218), the same rows the
 * app and the bike guides show. In the visitor's language (?lang=, then the
 * browser's). Strings: src/lib/site-strings/bike-lessons.ts.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const t = translator(bikeLessonsStrings, await siteLocale((await searchParams).lang))
  return {
    title: t('lessons.meta_title'),
    description: t('lessons.meta_description'),
    alternates: { canonical: '/bike-lessons' },
  }
}

const PLACEMENT = 'bike_lessons' as Placement

type Instructor = {
  id: string
  name: string
  url: string
  kind: string
  details: Record<string, string>
  price: Record<string, string> | null
  season: Record<string, string> | null
}

type Ev = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location_name: string | null
  organizer_name: string | null
}

/** What a ride card adds to the RPC's row: the picture, the meeting spot, the level (event_details, as the calendar reads it). */
type RideExtra = Omit<RideCard, 'href' | keyof Ev>

const RIDE_FIELDS = 'content_id, image_url, location_address, location_lat, location_lng, event_type, tags, pace, distance_text, no_drop, content_items!inner(body)'

type Loaded = {
  lessons: Ev[]
  rides: Ev[]
  instructors: Instructor[]
  slugs: [string, string | null][]
  extras: [string, RideExtra][]
}

async function readLessons(): Promise<Loaded> {
  // Slugs travel as pairs: the cache stores JSON, which has no Map.
  const empty: Loaded = { lessons: [], rides: [], instructors: [], slugs: [], extras: [] }
  try {
    const supabase = createServerSupabaseClient()
    // No count of free lessons left on the page (Keith 2026-11-23): the form
    // says when they are all taken.
    const { data, error } = await supabase.rpc('get_bike_lessons')
    if (error || !data) return empty
    const lessons = (data.lessons ?? []) as Ev[]
    const rides = (data.easy_rides ?? []) as Ev[]
    const instructors = (data.instructors ?? []) as Instructor[]
    const ids = [...lessons, ...rides].map((e) => e.id)
    const slugs = new Map<string, string | null>()
    const extras = new Map<string, RideExtra>()
    if (ids.length) {
      const [{ data: rows }, { data: details }] = await Promise.all([
        supabase.from('content_items').select('id, slug').in('id', ids),
        rides.length
          ? supabase.from('event_details').select(RIDE_FIELDS).in('content_id', rides.map((e) => e.id))
          : Promise.resolve({ data: [] }),
      ])
      for (const r of (rows ?? []) as { id: string; slug: string | null }[]) slugs.set(r.id, r.slug)
      for (const d of (details ?? []) as unknown as (Record<string, unknown> & { content_id: string; content_items: { body: string | null } | null })[]) {
        extras.set(d.content_id, {
          image_url: (d.image_url as string | null) ?? null,
          location_address: (d.location_address as string | null) ?? null,
          location_lat: d.location_lat == null ? null : Number(d.location_lat),
          location_lng: d.location_lng == null ? null : Number(d.location_lng),
          event_type: (d.event_type as string | null) ?? 'group_ride',
          tags: (d.tags as string[] | null) ?? [],
          pace: (d.pace as string | null) ?? null,
          distance_text: (d.distance_text as string | null) ?? null,
          no_drop: (d.no_drop as boolean | null) ?? null,
          body: d.content_items?.body ?? null,
        })
      }
    }
    return { lessons, rides, instructors, slugs: [...slugs], extras: [...extras] }
  } catch {
    return empty
  }
}

// Reading the language renders the page per request; the listings refresh
// every ten minutes.
const loadCached = unstable_cache(readLessons, ['bike-lessons-listings-v4'], { revalidate: 600 })

async function load() {
  const d = await loadCached()
  return { ...d, slugs: new Map(d.slugs), extras: new Map(d.extras) }
}

/** "Sat, Nov 7, 10 AM" from the calendar's date and time. */
function when(e: Ev, locale: SiteLocale): string {
  const [y, m, d] = e.event_date.split('-').map(Number)
  const [hh, mm] = (e.event_time ?? '').split(':').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, Number.isFinite(hh) ? hh : 12, Number.isFinite(mm) ? mm : 0))
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }
  if (e.event_time) {
    opts.hour = 'numeric'
    if (mm) opts.minute = '2-digit'
  }
  return date.toLocaleString(SITE_LOCALE_TAG[locale], opts)
}

/** A real street of the kind learners worry about, where our first requests came from (Somerville). */
const STREET_PHOTO = {
  // Washington Street at the Paramount, Downtown Crossing: the green lane, a bus and a car (Unsplash License,
  // unsplash.com/photos/JwAeeifBANs). PhotoCredit turns "Name / Unsplash" into Unsplash's required credit.
  src: '/bike-lessons/washington-st-boston.jpg',
  width: 1400,
  height: 934,
  credit: 'Aaron Doucett / Unsplash',
  url: 'https://unsplash.com/@adoucett',
  position: '55% 35%',
}
/** Credit is fine print: one line, so it doesn't cover the short phone band. */
const CREDIT = 'absolute bottom-2 right-2 whitespace-nowrap rounded-md bg-[rgba(25,26,46,.6)] px-2 py-0.5 text-[0.75rem] leading-snug text-white'

const HEADLINE = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold text-navy'
const H1 = `${HEADLINE} text-balance text-[clamp(2rem,4.6vw,3.125rem)] leading-[1.04]`
const H2 = `${HEADLINE} text-balance text-[clamp(1.625rem,3.4vw,2.25rem)] leading-[1.08]`
const BODY = 'text-[1.0625rem] leading-[1.6] text-navy'
const LINK = 'font-bold text-forest underline underline-offset-4 hover:opacity-80'

export default async function BikeLessonsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const locale = await siteLocale(sp.lang)
  const t = translator(bikeLessonsStrings, locale)
  const { lessons, rides, instructors, slugs, extras } = await load()
  const rideCards: RideCard[] = rides.slice(0, 6).map((e) => ({
    event_type: 'group_ride', image_url: null, location_address: null, location_lat: null, location_lng: null,
    tags: [], pace: null, distance_text: null, no_drop: null, body: null,
    ...e,
    ...extras.get(e.id),
    href: withLang(eventPath({ id: e.id, slug: slugs.get(e.id) ?? null }), locale),
  }))
  const league = instructors.find((x) => x.id === 'league_instructors')
  // Classes for people who never learned: the school you can book any time, the city classes, then adaptive.
  const classRows = [
    ...instructors.filter((x) => x.kind === 'school'),
    ...instructors.filter((x) => x.kind === 'seasonal'),
    ...instructors.filter((x) => x.kind === 'adaptive'),
  ]

  const streetPhoto = (className: string) => (
    <figure className={`relative overflow-hidden bg-navy/10 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={STREET_PHOTO.src}
        alt={t('lessons.photo_alt')}
        width={STREET_PHOTO.width}
        height={STREET_PHOTO.height}
        loading="eager"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: STREET_PHOTO.position }}
      />
      <figcaption className={CREDIT}>
        <PhotoCredit text={STREET_PHOTO.credit} url={STREET_PHOTO.url} linkClassName="underline-offset-2 hover:underline" />
      </figcaption>
    </figure>
  )

  const classRow = (x: Instructor) => {
    const meta = [x.price?.[locale] || x.price?.en, x.season?.[locale] || x.season?.en].filter(Boolean).join(' · ')
    return (
      <li key={x.id}>
        <a href={x.url} target="_blank" rel="noopener noreferrer" className="block h-full rounded-[12px] border border-navy/10 bg-white px-4 py-3 transition-colors hover:border-forest/50">
          <span className="block text-[1rem] font-bold leading-snug text-navy">{x.name}</span>
          <span className="block text-[0.9375rem] leading-snug text-navy/80">{x.details[locale] || x.details.en}</span>
          {meta && <span className="mt-1 block text-[0.9375rem] font-bold leading-snug text-navy">{meta}</span>}
        </a>
      </li>
    )
  }

  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <HtmlLang locale={locale} />
      <Nav variant="light" street locale={locale} />
      <JumpBar
        after="street-lesson"
        locale={locale}
        links={[
          { id: 'street-lesson', label: t('lessons.jump_street') },
          { id: 'how', label: t('lessons.how_title') },
          { id: 'classes', label: t('lessons.jump_classes') },
          { id: 'group-rides', label: t('lessons.jump_rides') },
        ]}
      />

      {/* 1. The offer and the form: the whole first screen. */}
      <section id="street-lesson" className="scroll-mt-[128px] bg-white pt-[60px]">
        <div className={`${CONTAINER} pb-12 lg:pt-12 lg:pb-16`}>
          {/* On a phone the street comes first, as a short band; on a wide screen it fills the right column. */}
          {streetPhoto('-mx-6 mb-6 h-[150px] sm:mx-0 sm:mt-8 sm:h-[220px] sm:rounded-[16px] lg:hidden')}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-14">
            <div className="min-w-0">
              <h1 className={H1}>
                {/* One worry per line, as the learners listed them (and as on the ad). */}
                {t('lessons.street_title')
                  .split(/(?<=[.。])\s*/)
                  .filter(Boolean)
                  .map((line) => (
                    <span key={line} className="block">{line}</span>
                  ))}
              </h1>
              <p className={`${BODY} mt-4 max-w-[600px] text-[1.125rem]`}>{t('lessons.lede')}</p>

              {/* The form sits right under the promise: the one thing to do on this page. */}
              <div className="mt-6 max-w-[600px] rounded-[20px] bg-cream p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <h2 className={H3}>{t('lessons.form_title')}</h2>
                </div>
                <p className="mt-2 mb-4 text-[0.9375rem] leading-relaxed text-navy/80">{t('lessons.form_area')}</p>
                <FreeLessonForm
                  buttonClass={BUTTON}
                  leagueUrl={league?.url}
                  locale={locale}
                  after={
                    <div className="mt-5 border-t border-navy/10 pt-4">
                      <p className="text-[1rem] leading-[1.55] text-navy">{t('lessons.form_after')}</p>
                      <StoreBadges className="mt-3" placement={PLACEMENT} />
                    </div>
                  }
                />
              </div>
              {/* The other two starting points, for search visitors who can't ride yet or want company. */}
              <p className="mt-5 text-[1rem] leading-[1.7] text-navy">
                {t('lessons.other_learn')}{' '}
                <a href="#classes" className={LINK}>{t('lessons.other_learn_link')}</a>
                <br />
                {t('lessons.other_company')}{' '}
                <a href="#group-rides" className={LINK}>{t('lessons.other_company_link')}</a>
              </p>
            </div>
            {streetPhoto('hidden min-h-[520px] rounded-[16px] lg:block')}
          </div>
        </div>
      </section>

      {/* 2. How it works: what happens after they ask, in three steps. */}
      <section id="how" className="scroll-mt-[128px] bg-cream">
        <div className={`${CONTAINER} py-14 lg:py-16`}>
          <h2 className={H2}>{t('lessons.how_title')}</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
            {(['lessons.how_1', 'lessons.how_2', 'lessons.how_3'] as const).map((k, i) => (
              <li key={k} className="flex gap-4 md:flex-col md:gap-3">
                <span className={`${HEADLINE} flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-[1.375rem] text-white`}>
                  {i + 1}
                </span>
                <p className={`${BODY} pt-1.5 md:pt-0`}>{t(k)}</p>
              </li>
            ))}
          </ol>
          <a href="#street-lesson" className={`${BUTTON} mt-8 inline-flex w-full justify-center sm:w-auto`}>
            {t('lessons.form_title')}
          </a>
        </div>
      </section>

      {/* 3. Never learned to ride: classes. */}
      <section id="classes" className="scroll-mt-[128px] bg-white">
        <div className={`${CONTAINER} py-14 lg:py-16`}>
          <h2 className={H2}>{t('lessons.classes_title')}</h2>
          <p className={`${BODY} mt-4 max-w-[680px]`}>{t('lessons.classes_body')}</p>
          {lessons.length > 0 ? (
            <>
              <h3 className="mt-8 text-[1.125rem] font-bold text-navy">{t('lessons.coming_up')}</h3>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {lessons.slice(0, 4).map((e) => (
                  <li key={e.id}>
                    <Link
                      href={withLang(eventPath({ id: e.id, slug: slugs.get(e.id) ?? null }), locale)}
                      className="block h-full rounded-[12px] border border-navy/10 bg-white px-4 py-3 transition-colors hover:border-forest/50"
                    >
                      <span className="block text-[1rem] font-bold leading-snug text-navy">{e.title}</span>
                      <span className="block text-[0.9375rem] leading-snug text-navy/80">
                        {[when(e, locale), e.location_name].filter(Boolean).join(' · ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {classRows.length > 0 && <ul className="mt-6 grid gap-3 md:grid-cols-2">{classRows.map(classRow)}</ul>}
          {lessons.length === 0 && (
            <div className="mt-8 grid gap-4 rounded-[20px] bg-cream p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
              <p className={`${H3}`}>{t('lessons.no_classes_now')}</p>
              <div className="min-w-0 [&>div]:mt-0">
                <LessonAlertForm locale={locale} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Would like company: easy group rides. */}
      <section id="group-rides" className="scroll-mt-[128px] bg-cream">
        <div className={`${CONTAINER} py-14 lg:py-16`}>
          <h2 className={H2}>{t('lessons.rides_title')}</h2>
          <p className={`${BODY} mt-4 max-w-[680px]`}>{t('lessons.rides_body')}</p>
          {rideCards.length > 0 && <RideCards rides={rideCards} locale={locale} />}
          <Link href={withLang('/events', locale)} className={`mt-5 inline-block text-[1rem] ${LINK}`}>
            {t('lessons.all_events')}
          </Link>
        </div>
      </section>

      <Footer variant="light" locale={locale} />
    </div>
  )
}
