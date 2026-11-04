import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Coffee, ExternalLink } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { BUTTON, CONTAINER, GSI_FONT } from '../../move-in/sign'

/**
 * A Ride Fund season's report (Shift 01596, get_ride_fund_public): who funds
 * it, and what it has bought so far, counted live. The sponsor, the
 * organizers and the shops all get this one link. Totals only: no names of
 * people, and an organizer is named only once their organization is verified.
 * Ride pages link here from their coffee line.
 *
 * Noindex until Keith approves the Ride Fund copy (2026-11-02).
 */

export const dynamic = 'force-dynamic'

interface FundReport {
  name: string
  funder_name: string
  funder_url: string | null
  funder_logo_url: string | null
  towns: string[] | null
  starts_on: string
  ends_on: string
  active: boolean
  coffee_cents: number
  coffees: number
  spent_at_shops_cents: number
  rides: number
  miles_together: number
  shops: { name: string; city: string | null; coffees: number; cents: number }[]
  ride_list: { name: string; organizer: string | null; dates: number; coffees: number }[]
}

const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold text-navy'

async function load(slug: string): Promise<FundReport | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null
  const { data, error } = await createServerSupabaseClient().rpc('get_ride_fund_public', { p_slug: slug })
  if (error) throw new Error(error.message)
  return (data as FundReport | null) ?? null
}

const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`
const title = (t: string) => t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const fund = await load((await params).slug).catch(() => null)
  return {
    title: fund ? `${fund.name} | Green Streets Initiative` : 'Ride Fund',
    description: fund ? `${fund.funder_name} buys a coffee at the local shop where each community ride ends.` : undefined,
    robots: { index: false, follow: false },
  }
}

export default async function RideFundReport({ params }: { params: Promise<{ slug: string }> }) {
  const fund = await load((await params).slug)
  if (!fund) notFound()

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = fund.starts_on > today
  const over = fund.ends_on < today
  const where = fund.towns?.length ? fund.towns.map(title).join(', ') : 'Massachusetts'
  const stats: [string, string][] = [
    [fund.rides.toLocaleString('en-US'), fund.rides === 1 ? 'ride date' : 'ride dates'],
    [fund.miles_together.toLocaleString('en-US'), 'miles ridden together'],
    [fund.coffees.toLocaleString('en-US'), fund.coffees === 1 ? 'coffee' : 'coffees'],
    [dollars(fund.spent_at_shops_cents), 'spent at local shops'],
  ]

  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <Nav variant="light" street />
      <main className={`${CONTAINER} pb-16 pt-[84px] md:pt-[100px]`}>
        <p className="text-[15px] font-bold text-forest">Ride Fund · {where}</p>
        <h1 className={`${HEAD} mt-2 text-[clamp(2rem,4.6vw,3rem)] leading-[1.05]`}>{fund.name}</h1>
        <p className="mt-4 max-w-[680px] text-[1.125rem] leading-[1.55] text-navy/85">
          {fund.funder_name} buys a coffee at the local shop where each community ride ends, for everyone who rides.
          {' '}{day(fund.starts_on)} to {day(fund.ends_on)}.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[18px] border border-navy/10 bg-white p-5">
          {fund.funder_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fund.funder_logo_url} alt={fund.funder_name} className="h-12 w-auto max-w-[180px] object-contain" />
          )}
          <p className="text-[15px] text-navy/80">
            Funded by{' '}
            {fund.funder_url
              ? <a href={fund.funder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-navy hover:underline">{fund.funder_name}<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
              : <span className="font-bold text-navy">{fund.funder_name}</span>}
            .{fund.funder_name === 'Green Streets Initiative' ? '' : ' Run by Green Streets Initiative.'}
          </p>
        </div>

        <section className="mt-10">
          <h2 className={`${HEAD} text-[1.5rem]`}>{over ? 'The season' : 'So far'}</h2>
          {upcoming && fund.coffees === 0 ? (
            <p className="mt-2 text-[1.0625rem] text-navy/80">The season starts {day(fund.starts_on)}. Rides, miles and coffees show here as they happen.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {stats.map(([n, label]) => (
                <li key={label} className="rounded-[18px] bg-white p-5">
                  <p className={`${HEAD} text-[2rem] leading-none`}>{n}</p>
                  <p className="mt-2 text-[15px] text-navy/80">{label}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[14px] text-navy/75">Counted live from check-ins in the Shift app. Totals only; nobody&rsquo;s name is shared.</p>
        </section>

        {fund.shops.length > 0 && (
          <section className="mt-10">
            <h2 className={`${HEAD} text-[1.5rem]`}>Where the coffee came from</h2>
            <ul className="mt-4 divide-y divide-navy/10 rounded-[18px] bg-white">
              {fund.shops.map((s) => (
                <li key={`${s.name}|${s.city}`} className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <Coffee className="h-5 w-5 shrink-0 text-forest" aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-bold text-navy">{s.name}</span>
                      {s.city && <span className="block text-[14px] text-navy/75">{title(s.city)}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[15px] text-navy/80">{s.coffees} · {dollars(s.cents)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {fund.ride_list.length > 0 && (
          <section className="mt-10">
            <h2 className={`${HEAD} text-[1.5rem]`}>The rides</h2>
            <ul className="mt-4 divide-y divide-navy/10 rounded-[18px] bg-white">
              {fund.ride_list.map((r, i) => (
                <li key={`${r.name}|${i}`} className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block font-bold text-navy">{r.name}</span>
                    {r.organizer && <span className="block text-[14px] text-navy/75">{r.organizer}</span>}
                  </span>
                  <span className="shrink-0 text-[15px] text-navy/80">{r.dates} {r.dates === 1 ? 'date' : 'dates'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 rounded-[24px] bg-forest px-6 py-8 text-white sm:px-10">
          <h2 className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[1.75rem] font-extrabold leading-tight">Lead a ride? Get the coffee for your riders.</h2>
          <p className="mt-2 max-w-[620px] text-[1.0625rem] leading-[1.55] text-white/90">
            Set up your ride with Shift&rsquo;s free ride tools and pick the shop where it ends. Within the fund&rsquo;s towns and dates, everyone who checks in gets a coffee there.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/organizers" className={`${BUTTON} !bg-white !text-navy`}>Set up a ride</Link>
            <Link href="/ride-fund" className="inline-flex min-h-[48px] items-center rounded-[12px] border border-white/40 px-5 text-[1rem] font-bold text-white hover:bg-white/10">Fund a season</Link>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </div>
  )
}
