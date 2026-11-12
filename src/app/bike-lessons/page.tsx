import type { Metadata } from 'next'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import StoreBadges from '@/components/StoreBadges'
import LessonAlertForm from '@/components/guides/LessonAlertForm'
import type { Placement } from '@/components/home/tracking'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { eventPath } from '@/lib/events-url'
import { BUTTON, CONTAINER, GSI_FONT, H3, SignHero } from '@/app/move-in/sign'
import JumpBar from './JumpBar'
import FreeLessonForm from './FreeLessonForm'
import RideCards, { type RideCard } from './RideCards'
import { siteLocale } from '@/lib/site-locale'
import { SITE_LOCALE_TAG, translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { bikeLessonsStrings } from '@/lib/site-strings/bike-lessons'

/*
 * gogreenstreets.org/bike-lessons: the landing page for the Ad Grants "Bike
 * lessons" test (Keith, 2026-10-27). People search "bike lessons near me" and
 * "adult bike lessons", not "learn to ride in traffic", so the page answers
 * that search and sorts people by where they're starting, in the app's own
 * three answers (bike-confidence.tsx): nervous in traffic, not sure I can
 * ride, would like company. The free lesson form shows the instructors who
 * reach the visitor by first name (Shift 01750, matching 2026-11-12).
 *
 * Listings come live from get_bike_lessons (Shift 01218): upcoming classes
 * from the events calendar, easy-pace group rides, and bike_instructors, the
 * same rows the app and the bike guides show.
 *
 * The free 1:1 street lesson: the form here asks one instructor at a time
 * who reaches the visitor and usually teaches when they're free (Shift
 * 01750 and the free-lessons function; Keith: no app needed first). Shift is
 * offered after the request is in.
 *
 * Live 2026-10-28 (Keith: go) for the Ad Grants "learn to ride" test.
 *
 * In the visitor's language (?lang=, then the browser's), with the footer's
 * language links (Keith 2026-11-08). Strings: src/lib/site-strings/bike-lessons.ts.
 * Class, ride and instructor names come from the calendar as published;
 * instructor details use their own translations when the row has them.
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

async function readLessons(): Promise<{ lessons: Ev[]; rides: Ev[]; instructors: Instructor[]; slugs: [string, string | null][]; extras: [string, RideExtra][] }> {
  // Slugs travel as pairs: the cache stores JSON, which has no Map.
  const empty = { lessons: [], rides: [], instructors: [], slugs: [] as [string, string | null][], extras: [] as [string, RideExtra][] }
  try {
    const supabase = createServerSupabaseClient()
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

// Reading the language renders the page per request; the listings still
// refresh every ten minutes, as when the whole page was cached for 600s.
const loadCached = unstable_cache(readLessons, ['bike-lessons-listings-v2'], { revalidate: 600 })

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

type K = keyof (typeof bikeLessonsStrings)['en']

const STARTS: { href: string; label: K; hint: K }[] = [
  { href: '#street-lesson', label: 'lessons.start_nervous', hint: 'lessons.start_nervous_hint' },
  { href: '#classes', label: 'lessons.start_learn', hint: 'lessons.start_learn_hint' },
  { href: '#group-rides', label: 'lessons.start_company', hint: 'lessons.start_company_hint' },
]

const FACTS: K[] = ['lessons.fact_free', 'lessons.fact_length', 'lessons.fact_who', 'lessons.fact_where', 'lessons.fact_count']

/** The two bike guides, in the reader's language (both are translated: /es, /pt-BR, /zh-Hans). */
function guideHref(slug: string, locale: SiteLocale): string {
  return locale === 'en' ? `/guides/${slug}` : `/${locale}/guides/${slug}`
}

const H2 = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.625rem,3.4vw,2.25rem)] font-extrabold leading-[1.08] text-navy'
const BODY = 'text-[1.0625rem] leading-[1.6] text-navy'
const ROW = 'block rounded-[12px] border border-navy/10 bg-white px-4 py-3 transition-colors hover:border-forest/50'

export default async function BikeLessonsPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(bikeLessonsStrings, locale)
  const { lessons, rides, instructors, slugs, extras } = await load()
  const rideCards: RideCard[] = rides.slice(0, 6).map((e) => ({
    event_type: 'group_ride', image_url: null, location_address: null, location_lat: null, location_lng: null,
    tags: [], pace: null, distance_text: null, no_drop: null, body: null,
    ...e,
    ...extras.get(e.id),
    href: withLang(eventPath({ id: e.id, slug: slugs.get(e.id) ?? null }), locale),
  }))
  const school = instructors.find((x) => x.kind === 'school')
  const league = instructors.find((x) => x.id === 'league_instructors')
  const seasonal = instructors.filter((x) => x.kind === 'seasonal')
  const adaptive = instructors.filter((x) => x.kind === 'adaptive')

  const eventRow = (e: Ev) => (
    <li key={e.id}>
      <Link href={withLang(eventPath({ id: e.id, slug: slugs.get(e.id) ?? null }), locale)} className={ROW}>
        <span className="block text-[1rem] font-bold leading-snug text-navy">{e.title}</span>
        <span className="block text-[0.9375rem] leading-snug text-navy/80">
          {[when(e, locale), e.location_name].filter(Boolean).join(' · ')}
        </span>
      </Link>
    </li>
  )

  const instructorRow = (x: Instructor) => {
    const meta = [x.price?.[locale] || x.price?.en, x.season?.[locale] || x.season?.en].filter(Boolean).join(' · ')
    return (
      <li key={x.id}>
        <a href={x.url} target="_blank" rel="noopener noreferrer" className={ROW}>
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
      <JumpBar after="start" locale={locale} />

      <SignHero
        title={t('lessons.hero_title')}
        lede={<p>{t('lessons.hero_lede')}</p>}
        after={
          <p className="mt-5 max-w-[780px] text-[1.0625rem] leading-[1.6] text-navy">
            {t('lessons.hero_after')}
          </p>
        }
      />

      {/* Where are you starting: the in-page nav, in the app's own answers. */}
      <section id="start" className="bg-cream" aria-labelledby="start-heading">
        <div className={`${CONTAINER} pb-12`}>
          <h2 id="start-heading" className={H3}>{t('lessons.start_heading')}</h2>
          <ul className="mt-4 grid gap-2.5 md:grid-cols-3 md:gap-3">
            {STARTS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className="flex h-full min-h-[64px] flex-col justify-center rounded-[14px] border-2 border-forest/30 bg-white px-4 py-3 transition-colors hover:border-forest sm:px-5 sm:py-4"
                >
                  <span className="text-[1.0625rem] font-bold leading-snug text-navy">{t(s.label)}</span>
                  <span className="mt-1 text-[0.9375rem] leading-snug text-navy/80">{t(s.hint)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Nervous in traffic: the free 1:1 lesson. */}
      <section id="street-lesson" className="scroll-mt-[128px] bg-white">
        <div className={`${CONTAINER} py-14 lg:py-16`}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
            <div className="min-w-0">
              <h2 className={H2}>{t('lessons.street_title')}</h2>
              <p className={`${BODY} mt-4 max-w-[640px]`}>
                {t('lessons.street_body')}
              </p>
              <ul className="mt-6 flex max-w-[640px] flex-wrap gap-2" aria-label={t('lessons.facts_label')}>
                {FACTS.map((f) => (
                  <li key={f} className="rounded-full bg-forest/10 px-4 py-2 text-[0.9375rem] font-bold leading-snug text-navy">
                    {t(f)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[20px] bg-cream p-6 sm:p-7">
              <h3 className={H3}>{t('lessons.form_title')}</h3>
              <p className="mt-2 mb-4 text-[0.9375rem] leading-relaxed text-navy/80">
                {t('lessons.form_area')}
              </p>
              <FreeLessonForm
                buttonClass={BUTTON}
                leagueUrl={league?.url}
                locale={locale}
                after={
                  <div className="mt-5 border-t border-navy/10 pt-4">
                    <p className="text-[1rem] leading-[1.55] text-navy">
                      {t('lessons.form_after')}
                    </p>
                    <StoreBadges className="mt-3" placement={PLACEMENT} />
                  </div>
                }
              />
            </div>
          </div>

          {league && (
            <p className={`${BODY} mt-10 max-w-[760px]`}>
              {t('lessons.league_body')}{locale === 'zh-Hans' ? '' : ' '}
              <a
                href={league.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-forest underline underline-offset-4 hover:opacity-80"
              >
                {t('lessons.league_link')}
              </a>
            </p>
          )}
        </div>
      </section>

      {/* Not sure I can ride: classes. */}
      <section id="classes" className="scroll-mt-[128px] bg-cream">
        <div className={`${CONTAINER} py-14 lg:py-16`}>
          <h2 className={H2}>{t('lessons.classes_title')}</h2>
          <p className={`${BODY} mt-4 max-w-[680px]`}>
            {t('lessons.classes_body')}
          </p>

          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="text-[1.125rem] font-bold text-navy">{t('lessons.coming_up')}</h3>
              {lessons.length > 0 ? (
                <ul className="mt-3 space-y-2">{lessons.slice(0, 5).map(eventRow)}</ul>
              ) : (
                <p className={`${BODY} mt-2`}>
                  {t('lessons.no_classes')}
                </p>
              )}
              {school && (
                <>
                  <h3 className="mt-8 text-[1.125rem] font-bold text-navy">{t('lessons.book_any_time')}</h3>
                  <ul className="mt-3 space-y-2">{instructorRow(school)}</ul>
                </>
              )}
            </div>
            <div className="min-w-0">
              {seasonal.length > 0 && (
                <>
                  <h3 className="text-[1.125rem] font-bold text-navy">{t('lessons.city_classes')}</h3>
                  <ul className="mt-3 space-y-2">{seasonal.map(instructorRow)}</ul>
                </>
              )}
              {adaptive.length > 0 && (
                <>
                  <h3 className="mt-8 text-[1.125rem] font-bold text-navy">{t('lessons.adaptive')}</h3>
                  <ul className="mt-3 space-y-2">{adaptive.map(instructorRow)}</ul>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Would like company: easy group rides. */}
      <section id="group-rides" className="scroll-mt-[128px] bg-white">
        <div className={`${CONTAINER} py-14 lg:py-16`}>
          <h2 className={H2}>{t('lessons.rides_title')}</h2>
          <p className={`${BODY} mt-4 max-w-[680px]`}>
            {t('lessons.rides_body')}
          </p>
          {rideCards.length > 0 && <RideCards rides={rideCards} locale={locale} />}
          <Link
            href={withLang('/events', locale)}
            className="mt-5 inline-block text-[1rem] font-bold text-forest underline underline-offset-4 hover:opacity-80"
          >
            {t('lessons.all_events')}
          </Link>
        </div>
      </section>

      {/* Rather wait: an email when a class is posted. */}
      <section id="wait" className="scroll-mt-[128px] bg-cream">
        <div className={`${CONTAINER} py-14 lg:py-16`}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div className="min-w-0">
              <h2 className={H2}>{t('lessons.wait_title')}</h2>
              <p className={`${BODY} mt-4 max-w-[520px]`}>
                {t('lessons.wait_body')}
              </p>
            </div>
            <div className="min-w-0 [&>div]:mt-0">
              <LessonAlertForm locale={locale} />
            </div>
          </div>

          <h2 className={`${H3} mt-14`}>{t('lessons.first_ride_heading')}</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            <li>
              <Link href={guideHref('your-first-ride-in-a-bike-lane', locale)} className={ROW}>
                <span className="block text-[1rem] font-bold leading-snug text-navy">{t('lessons.guide_lane_title')}</span>
                <span className="block text-[0.9375rem] leading-snug text-navy/80">{t('lessons.guide_lane_body')}</span>
              </Link>
            </li>
            <li>
              <Link href={guideHref('picking-a-bike-route', locale)} className={ROW}>
                <span className="block text-[1rem] font-bold leading-snug text-navy">{t('lessons.guide_route_title')}</span>
                <span className="block text-[0.9375rem] leading-snug text-navy/80">{t('lessons.guide_route_body')}</span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <Footer variant="light" locale={locale} />
    </div>
  )
}
