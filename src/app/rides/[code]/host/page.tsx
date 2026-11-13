import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, Bike, Footprints, MapPin } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { EventsToneProvider } from '@/components/events/EventsTone'
import '@/components/events/events-tone.css'
import { OrganizerStats } from '@/components/rides/RidePage'
import { rideOrganizer } from '@/lib/rides/organizer'
import { clock, dateShort, dayShort, looksLikeRideCode } from '@/lib/rides/public'
import { siteLocale } from '@/lib/site-locale'
import { translator, withLang } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

/**
 * The person who organizes a ride, when no verified group hosts it (Keith
 * 2026-11-12): who they are, how long they've been at it, how many people
 * have come, and their open rides. Reached from the ride page's "Hosted by".
 * Only for a public profile (Shift 01752); keyed by the ride's code so no
 * account id goes into a link.
 */
export const dynamic = 'force-dynamic'

type Search = Promise<{ lang?: string | string[] }>

export async function generateMetadata({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Search }): Promise<Metadata> {
  const { code } = await params
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(ridesStrings, locale)
  const org = looksLikeRideCode(code) ? await rideOrganizer(code) : null
  if (!org) return { title: t('meta.not_found'), robots: { index: false } }
  return { title: t('org.page_title', { name: org.name }), robots: { index: false, follow: true } }
}

export default async function Page({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Search }) {
  const { code } = await params
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(ridesStrings, locale)
  if (!looksLikeRideCode(code)) notFound()
  const org = await rideOrganizer(code)
  if (!org) notFound()
  const walksOnly = org.rides.length > 0 && org.rides.every((r) => r.activity === 'walk')
  const initials = org.name.split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <EventsToneProvider tone="light">
        <div className={`min-h-screen bg-(--ev-bg) px-4 pb-24 pt-6 sm:px-8 sm:pt-10 events-tone events-tone-light`}>
          <div className="mx-auto max-w-[760px]">
            <a href={withLang(`/rides/${code}`, locale)} className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-[#2E6B1F] hover:underline">
              <ArrowLeft size={16} aria-hidden /> {t('org.back')}
            </a>

            <div className="mt-4 flex items-center gap-5">
              {org.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={org.avatar_url} alt="" className="h-24 w-24 shrink-0 rounded-full border border-black/10 object-cover sm:h-28 sm:w-28" />
                : <span aria-hidden className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-[#191A2E] font-display text-[34px] font-extrabold text-[#BAF14D] sm:h-28 sm:w-28">{initials}</span>}
              <div className="min-w-0">
                <h1 className="font-display text-[clamp(28px,4vw,40px)] font-extrabold leading-[1.05] tracking-tight text-[#191A2E]">{org.name}</h1>
                <p className="mt-1 text-[16px] text-[#191A2E]/80">{t(walksOnly ? 'org.organizes.walk' : 'org.organizes.ride')}</p>
              </div>
            </div>

            <OrganizerStats org={org} walk={walksOnly} locale={locale} className="mt-6" />

            <h2 className="mt-10 font-display text-[22px] font-extrabold text-[#191A2E]">{t('org.upcoming')}</h2>
            {org.rides.length === 0 ? (
              <p className="mt-3 text-[16px] text-[#191A2E]/80">{t('org.none')}</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {org.rides.map((r) => (
                  <li key={r.code}>
                    <a href={withLang(`/rides/${r.code}?date=${r.next}`, locale)}
                      className="flex items-center gap-4 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_1px_3px_rgba(25,26,46,.06)] hover:bg-[#F7F8F2]">
                      <span className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-[#191A2E] py-2 text-white">
                        <span className="text-[13px] font-semibold text-white/80">{dayShort(r.next, locale)}</span>
                        <span className="text-[16px] font-bold">{dateShort(r.next, locale)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-bold leading-snug text-[#191A2E]">{r.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[#191A2E]/75">
                          <span className="inline-flex items-center gap-1">{r.activity === 'walk' ? <Footprints size={14} aria-hidden /> : <Bike size={14} aria-hidden />}{clock(r.start_time, locale)}</span>
                          {r.meetup_name && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden />{r.meetup_name}</span>}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </EventsToneProvider>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
