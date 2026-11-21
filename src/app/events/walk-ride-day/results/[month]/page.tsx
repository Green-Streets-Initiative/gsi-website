import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Bicycle, Car, PersonSimpleWalk, Train } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import {
  dayAndTime,
  dollars,
  loadResults,
  loadWrdMonths,
  longDay,
  prizeLine,
  shortName,
} from '../../_lib/results'

// A drawing's results change only when a prize is redrawn or a winner picks
// how their name shows, so a few minutes' cache is plenty.
export const revalidate = 300

type Props = { params: Promise<{ month: string }> }

async function find(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const months = await loadWrdMonths()
  const m = months.find(x => x.month === month)
  return m ? { m, months } : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params
  const found = await find(month)
  if (!found) return { title: 'Walk/Ride Day results | Green Streets Initiative' }
  const name = shortName(found.m.name)
  return {
    title: `${name} results | Green Streets Initiative`,
    description: `Who won the ${name} gift card drawing, when it ran and how many people took part.`,
  }
}

const APP_STORE = 'https://apps.apple.com/us/app/shift-by-gsi/id6761119037'
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=org.greenstreets.shift'
const linkCls = 'font-semibold text-forest underline-offset-4 hover:underline'

export default async function WalkRideDayResultsPage({ params }: Props) {
  const { month } = await params
  const found = await find(month)
  if (!found) notFound()
  const results = await loadResults(found.m.id)
  if (!results) notFound()

  const name = shortName(results.name)
  const drawnCount = results.prizes.reduce((s, p) => s + p.drawn, 0)
  const others = found.months.filter(m => m.drawn && m.month !== month).slice(0, 6)
  const modeRows = modesToRows(results.modes)
  const modeMax = Math.max(1, ...modeRows.map(r => r.n))
  const shops = results.shops ?? []

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 py-8 lg:py-10">
          <Link href="/events" className={`mb-8 inline-flex items-center gap-1.5 text-[15px] ${linkCls}`}>
            &larr; Back to events
          </Link>

          <h1 className="font-serif text-[clamp(2.25rem,5.5vw,3.75rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">
            {name} results
          </h1>
          <p className="mt-4 text-[15px] text-ink-soft">{longDay(results.starts_at)} &middot; Green Streets Initiative</p>

          <div className="mt-6 rounded-[12px] border border-navy/10 bg-navy/[0.04] p-5">
            <p className="text-[1.0625rem] leading-[1.7] text-navy">
              {results.drawn && results.drawn_at ? (
                <>
                  <strong>The drawing is done.</strong> {drawnCount} gift card{drawnCount === 1 ? ' was' : 's were'} drawn
                  at random on {dayAndTime(results.drawn_at)} ET
                  {results.entries ? <>, from {results.entries.toLocaleString('en-US')} entries</> : null}.
                  Each draw&rsquo;s entry count and random seed are recorded.
                </>
              ) : results.drawing_at ? (
                <>
                  <strong>The drawing is {dayAndTime(results.drawing_at)} ET.</strong> The winners appear here once it runs.
                </>
              ) : (
                <>The winners appear here once the drawing runs.</>
              )}
            </p>
          </div>

          <dl className="mt-8 grid grid-cols-3 gap-4 text-center">
            <Stat value={results.people.toLocaleString('en-US')} label="people took part" />
            <Stat value={results.trips.toLocaleString('en-US')} label={modeRows.length > 0 ? 'trips' : 'walks, bike rides, transit trips and carpools'} />
            <Stat value={String(results.prizes.reduce((s, p) => s + p.quantity, 0))} label="gift cards" />
          </dl>

          {modeRows.length > 0 && (
            <figure className="mt-6 rounded-[12px] border border-navy/10 bg-white p-5">
              <figcaption className="mb-4 text-[1.0625rem] font-semibold text-navy">The trips, by type</figcaption>
              <ul className="space-y-4">
                {modeRows.map(({ key, n, label, Icon: ModeIcon }) => (
                  <li key={key} className="flex items-center gap-3">
                    <ModeIcon size={26} weight="regular" className="shrink-0 text-forest" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] text-navy">
                        <strong className="font-semibold">{n.toLocaleString('en-US')}</strong> {label}
                      </p>
                      <div className="mt-1.5 h-2.5 rounded-full bg-navy/[0.07]">
                        <div className="h-full rounded-full bg-forest" style={{ width: `${Math.max(3, (n / modeMax) * 100)}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </figure>
          )}

          {results.drawn && (
            <section className="mt-10">
              <h2 className="mb-4 font-serif text-[1.75rem] font-normal leading-[1.1] text-navy">Who won</h2>
              <div className="space-y-6">
                {results.prizes.filter(p => p.drawn > 0).map(p => (
                  <div key={p.prize_id}>
                    <h3 className="text-[1.0625rem] font-semibold text-navy">
                      {p.value != null ? `${dollars(p.value)} gift card` : p.description}
                      {p.drawn > 1 ? <span className="font-normal text-ink-soft"> &middot; {p.drawn} winners</span> : null}
                    </h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {p.winners.map((w, i) => (
                        <li key={i} className="rounded-full border border-navy/10 bg-white px-3 py-1 text-[15px] text-navy">
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[15px] leading-[1.6] text-ink-soft">
                {results.names_shown
                  ? 'Winners are listed by first name, last initial and home town, or by town only when their Shift profile is private or they ask. Gift cards are the winner’s choice of a local shop or a brand.'
                  : 'Winners of drawings before November 2026 are listed by town. Gift cards are the winner’s choice of a local shop or a brand.'}
              </p>
              {shops.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-[1.0625rem] font-semibold text-navy">Shops winners picked for their gift cards</h3>
                  <ul className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
                    {shops.map(shop => (
                      <li key={shop.name} className="flex flex-col items-center text-center">
                        <span className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border border-navy/10 bg-white">
                          {shop.logo_url ? (
                            <Image src={shop.logo_url} alt="" width={52} height={52} className="h-[52px] w-[52px] object-contain" />
                          ) : (
                            <span className="font-serif text-[1.5rem] text-forest">{shop.name.charAt(0)}</span>
                          )}
                        </span>
                        <span className="mt-2 text-[14px] leading-[1.3] text-navy">{shop.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {results.next && (
            <section className="mt-10 rounded-[12px] bg-navy p-6 text-white">
              <h2 className="font-serif text-[1.75rem] font-normal leading-[1.1]">
                Next: {longDay(results.next.starts_at)}
              </h2>
              <p className="mt-3 text-[1.0625rem] leading-[1.6] text-white/85">
                Everyone on Shift is entered automatically: every walk, bike ride, transit trip or carpool that day counts.
                {prizeLine(results.next.prizes) ? <> Up for grabs: {prizeLine(results.next.prizes)}.</> : null}
              </p>
              <p className="mt-4 flex flex-wrap gap-3">
                <a href={APP_STORE} className="rounded-full bg-lime px-5 py-2.5 font-semibold text-navy">App Store</a>
                <a href={PLAY_STORE} className="rounded-full bg-lime px-5 py-2.5 font-semibold text-navy">Google Play</a>
              </p>
            </section>
          )}

          <p className="mt-8 text-[15px] leading-[1.6] text-ink-soft">
            <Link href="/events/walk-ride-day/rules" className={linkCls}>Official rules</Link>
            {others.length > 0 && (
              <>
                {' '}&middot; Earlier results:{' '}
                {others.map((o, i) => (
                  <span key={o.month}>
                    {i > 0 ? ', ' : ''}
                    <Link href={`/events/walk-ride-day/results/${o.month}`} className={linkCls}>
                      {shortName(o.name).replace(' Walk/Ride Day', '')}
                    </Link>
                  </span>
                ))}
              </>
            )}
          </p>
        </article>
      </main>
      <Footer />
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="mt-1.5 text-[14px] leading-[1.35] text-ink-soft">{label}</dt>
      <dd className="font-serif text-[2rem] leading-none text-forest">{value}</dd>
    </div>
  )
}

const MODES: { key: 'walk' | 'bike' | 'transit' | 'carpool'; one: string; other: string; Icon: Icon }[] = [
  { key: 'walk', one: 'walk', other: 'walks', Icon: PersonSimpleWalk },
  { key: 'bike', one: 'bike ride', other: 'bike rides', Icon: Bicycle },
  { key: 'transit', one: 'bus or train ride', other: 'bus and train rides', Icon: Train },
  { key: 'carpool', one: 'carpool', other: 'carpools', Icon: Car },
]

/** The app's "What everyone did" bars (ChallengeResults.tsx): one row per kind of trip that day. */
function modesToRows(modes: { walk: number; bike: number; transit: number; carpool: number } | null | undefined) {
  if (!modes) return []
  return MODES.map(m => ({ key: m.key, n: modes[m.key] ?? 0, label: (modes[m.key] ?? 0) === 1 ? m.one : m.other, Icon: m.Icon }))
    .filter(r => r.n > 0)
}
