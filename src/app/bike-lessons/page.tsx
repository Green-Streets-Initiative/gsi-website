import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreBadges from '@/components/StoreBadges'
import LessonAlertForm from '@/components/guides/LessonAlertForm'
import type { Placement } from '@/components/home/tracking'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { eventPath } from '@/lib/events-url'
import { BUTTON, CONTAINER, GSI_FONT, H3, SignHero } from '@/app/move-in/sign'
import JumpBar from './JumpBar'
import FreeLessonForm from './FreeLessonForm'

/*
 * gogreenstreets.org/bike-lessons: the landing page for the Ad Grants "Bike
 * lessons" test (Keith, 2026-10-27). People search "bike lessons near me" and
 * "adult bike lessons", not "learn to ride in traffic", so the page answers
 * that search and sorts people by where they're starting, in the app's own
 * three answers (bike-confidence.tsx): nervous in traffic, not sure I can
 * ride, would like company. It names the Bicycle Riding School (Susan said
 * yes) and no individual instructors.
 *
 * Listings come live from get_bike_lessons (Shift 01218): upcoming classes
 * from the events calendar, easy-pace group rides, and bike_instructors, the
 * same rows the app and the bike guides show.
 *
 * The free 1:1 street lesson code comes by email from the form here (Shift
 * 01465 and the free-lessons function; Keith: no app needed first). Shift is
 * offered after the code is on its way.
 *
 * Live 2026-10-28 (Keith: go) for the Ad Grants "learn to ride" test.
 */

export const metadata: Metadata = {
  title: 'Bike lessons for adults in Massachusetts | Green Streets Initiative',
  description:
    'Bike lessons for adults, from your first ride to riding on busy streets. A free one-on-one street lesson near Somerville, learn-to-ride classes and easy group rides.',
  alternates: { canonical: '/bike-lessons' },
}

export const revalidate = 600

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

async function load(): Promise<{ lessons: Ev[]; rides: Ev[]; instructors: Instructor[]; slugs: Map<string, string | null> }> {
  const empty = { lessons: [], rides: [], instructors: [], slugs: new Map<string, string | null>() }
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('get_bike_lessons')
    if (error || !data) return empty
    const lessons = (data.lessons ?? []) as Ev[]
    const rides = (data.easy_rides ?? []) as Ev[]
    const instructors = (data.instructors ?? []) as Instructor[]
    const ids = [...lessons, ...rides].map((e) => e.id)
    const slugs = new Map<string, string | null>()
    if (ids.length) {
      const { data: rows } = await supabase.from('content_items').select('id, slug').in('id', ids)
      for (const r of (rows ?? []) as { id: string; slug: string | null }[]) slugs.set(r.id, r.slug)
    }
    return { lessons, rides, instructors, slugs }
  } catch {
    return empty
  }
}

/** "Sat, Nov 7, 10 AM" from the calendar's date and time. */
function when(e: Ev): string {
  const [y, m, d] = e.event_date.split('-').map(Number)
  const [hh, mm] = (e.event_time ?? '').split(':').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, Number.isFinite(hh) ? hh : 12, Number.isFinite(mm) ? mm : 0))
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }
  if (e.event_time) {
    opts.hour = 'numeric'
    if (mm) opts.minute = '2-digit'
  }
  return date.toLocaleString('en-US', opts)
}

const STARTS = [
  { href: '#street-lesson', label: 'I can ride, but traffic makes me nervous', hint: 'A free 1:1 lesson on real streets, near Somerville.' },
  { href: '#classes', label: 'I’m not sure I can ride', hint: 'Learn-to-ride classes for adults.' },
  { href: '#group-rides', label: 'I’d like company the first time', hint: 'Easy-pace group rides open to beginners.' },
]

const FACTS = ['Free', '90 minutes, one-on-one', 'For adults who can already ride', 'If you live near Somerville', '10 lessons to start']

const H2 = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.625rem,3.4vw,2.25rem)] font-extrabold leading-[1.08] text-navy'
const BODY = 'text-[1.0625rem] leading-[1.6] text-navy'
const ROW = 'block rounded-[12px] border border-navy/10 bg-white px-4 py-3 transition-colors hover:border-forest/50'

export default async function BikeLessonsPage() {
  const { lessons, rides, instructors, slugs } = await load()
  const school = instructors.find((x) => x.kind === 'school')
  const league = instructors.find((x) => x.id === 'league_instructors')
  const seasonal = instructors.filter((x) => x.kind === 'seasonal')
  const adaptive = instructors.filter((x) => x.kind === 'adaptive')

  const eventRow = (e: Ev) => (
    <li key={e.id}>
      <Link href={eventPath({ id: e.id, slug: slugs.get(e.id) ?? null })} className={ROW}>
        <span className="block text-[1rem] font-bold leading-snug text-navy">{e.title}</span>
        <span className="block text-[0.9375rem] leading-snug text-navy/80">
          {[when(e), e.location_name].filter(Boolean).join(' · ')}
        </span>
      </Link>
    </li>
  )

  const instructorRow = (x: Instructor) => {
    const meta = [x.price?.en, x.season?.en].filter(Boolean).join(' · ')
    return (
      <li key={x.id}>
        <a href={x.url} target="_blank" rel="noopener noreferrer" className={ROW}>
          <span className="block text-[1rem] font-bold leading-snug text-navy">{x.name}</span>
          <span className="block text-[0.9375rem] leading-snug text-navy/80">{x.details.en}</span>
          {meta && <span className="mt-1 block text-[0.9375rem] font-bold leading-snug text-navy">{meta}</span>}
        </a>
      </li>
    )
  }

  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <Nav variant="light" street />
      <JumpBar after="start" />

      <SignHero
        title="Learn to bike in the city."
        lede={
          <p>
            Lessons for adults, whether you&rsquo;re getting on a bike for the first time or you can
            ride but busy streets make you nervous. Many are free.
          </p>
        }
        after={
          <p className="mt-5 max-w-[780px] text-[1.0625rem] leading-[1.6] text-navy">
            Green Streets Initiative is a Massachusetts nonprofit that has helped people walk, bike
            and take transit more since 2006.
          </p>
        }
      />

      {/* Where are you starting: the in-page nav, in the app's own answers. */}
      <section id="start" className="bg-cream" aria-labelledby="start-heading">
        <div className={`${CONTAINER} pb-12`}>
          <h2 id="start-heading" className={H3}>Where are you starting?</h2>
          <ul className="mt-4 grid gap-2.5 md:grid-cols-3 md:gap-3">
            {STARTS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className="flex h-full min-h-[64px] flex-col justify-center rounded-[14px] border-2 border-forest/30 bg-white px-4 py-3 transition-colors hover:border-forest sm:px-5 sm:py-4"
                >
                  <span className="text-[1.0625rem] font-bold leading-snug text-navy">{s.label}</span>
                  <span className="mt-1 text-[0.9375rem] leading-snug text-navy/80">{s.hint}</span>
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
              <h2 className={H2}>Nervous in traffic? Take a free 1:1 lesson.</h2>
              <p className={`${BODY} mt-4 max-w-[640px]`}>
                An instructor from the Bicycle Riding School rides with you on real streets, at your
                own pace. Practice the turns and intersections that worry you. Green Streets pays.
              </p>
              <ul className="mt-6 flex max-w-[640px] flex-wrap gap-2" aria-label="Lesson details">
                {FACTS.map((f) => (
                  <li key={f} className="rounded-full bg-forest/10 px-4 py-2 text-[0.9375rem] font-bold leading-snug text-navy">
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[20px] bg-cream p-6 sm:p-7">
              <h3 className={H3}>Ask for your free lesson</h3>
              <p className="mt-2 mb-4 text-[0.9375rem] leading-relaxed text-navy/80">
                For people who live in Somerville, Cambridge, Medford, Arlington, Belmont, Watertown,
                Malden, Everett, Chelsea, Winchester and nearby parts of Boston.
              </p>
              <FreeLessonForm
                buttonClass={BUTTON}
                leagueUrl={league?.url}
                after={
                  <div className="mt-5 border-t border-navy/10 pt-4">
                    <p className="text-[1rem] leading-[1.55] text-navy">
                      While you wait, Shift, our free app, can help you plan a calm route for your
                      first rides.
                    </p>
                    <StoreBadges className="mt-3" placement={PLACEMENT} />
                  </div>
                }
              />
            </div>
          </div>

          {league && (
            <p className={`${BODY} mt-10 max-w-[760px]`}>
              Live farther away? A League-certified instructor can teach the same skills, one-on-one or
              in a group, anywhere in Massachusetts.{' '}
              <a
                href={league.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-forest underline underline-offset-4 hover:opacity-80"
              >
                Find an instructor near you
              </a>
            </p>
          )}
        </div>
      </section>

      {/* Not sure I can ride: classes. */}
      <section id="classes" className="scroll-mt-[128px] bg-cream">
        <div className={`${CONTAINER} py-14 lg:py-16`}>
          <h2 className={H2}>Not sure you can ride? Start with a class.</h2>
          <p className={`${BODY} mt-4 max-w-[680px]`}>
            Classes for adults who never learned, or haven&rsquo;t ridden in years. Most provide the
            bike.
          </p>

          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="text-[1.125rem] font-bold text-navy">Coming up</h3>
              {lessons.length > 0 ? (
                <ul className="mt-3 space-y-2">{lessons.slice(0, 5).map(eventRow)}</ul>
              ) : (
                <p className={`${BODY} mt-2`}>
                  No group classes are posted right now. City classes mostly run spring through fall.
                </p>
              )}
              {school && (
                <>
                  <h3 className="mt-8 text-[1.125rem] font-bold text-navy">Book any time</h3>
                  <ul className="mt-3 space-y-2">{instructorRow(school)}</ul>
                </>
              )}
            </div>
            <div className="min-w-0">
              {seasonal.length > 0 && (
                <>
                  <h3 className="text-[1.125rem] font-bold text-navy">City classes in season</h3>
                  <ul className="mt-3 space-y-2">{seasonal.map(instructorRow)}</ul>
                </>
              )}
              {adaptive.length > 0 && (
                <>
                  <h3 className="mt-8 text-[1.125rem] font-bold text-navy">Adaptive cycling</h3>
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
          <h2 className={H2}>Want company the first time? Join an easy group ride.</h2>
          <p className={`${BODY} mt-4 max-w-[680px]`}>
            Group rides open to beginners, at an easy pace, with people who know the way.
          </p>
          {rides.length > 0 && <ul className="mt-6 grid gap-2 md:grid-cols-2">{rides.map(eventRow)}</ul>}
          <Link
            href="/events"
            className="mt-5 inline-block text-[1rem] font-bold text-forest underline underline-offset-4 hover:opacity-80"
          >
            See all events
          </Link>
        </div>
      </section>

      {/* Rather wait: an email when a class is posted. */}
      <section id="wait" className="scroll-mt-[128px] bg-cream">
        <div className={`${CONTAINER} py-14 lg:py-16`}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div className="min-w-0">
              <h2 className={H2}>Rather wait for warmer weather?</h2>
              <p className={`${BODY} mt-4 max-w-[520px]`}>
                Most classes start again in the spring.
              </p>
            </div>
            <div className="min-w-0 [&>div]:mt-0">
              <LessonAlertForm locale="en" />
            </div>
          </div>

          <h2 className={`${H3} mt-14`}>Before your first ride</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            <li>
              <Link href="/guides/your-first-ride-in-a-bike-lane" className={ROW}>
                <span className="block text-[1rem] font-bold leading-snug text-navy">Your first ride in a bike lane</span>
                <span className="block text-[0.9375rem] leading-snug text-navy/80">What each kind of bike lane means and how to ride it.</span>
              </Link>
            </li>
            <li>
              <Link href="/guides/picking-a-bike-route" className={ROW}>
                <span className="block text-[1rem] font-bold leading-snug text-navy">Picking a bike route that feels comfortable</span>
                <span className="block text-[0.9375rem] leading-snug text-navy/80">How to pick a route that feels manageable from day one.</span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <Footer variant="light" />
    </div>
  )
}
