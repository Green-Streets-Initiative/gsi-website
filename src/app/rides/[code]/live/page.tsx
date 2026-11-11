import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import RideLive from '@/components/rides/RideLive'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { looksLikeRideCode, type RideLookup } from '@/lib/rides/public'
import { siteLocale } from '@/lib/site-locale'
import { translator } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

/**
 * Where the group is right now, without the app (Shift 01747): the link a
 * leader drops in the group chat, and the one in a guest's reminder and
 * "about 5 minutes from your stop" emails (?t= lets a guest see a ride shared
 * only with people on it). Never indexed.
 */
export const dynamic = 'force-dynamic'

type Search = Promise<{ date?: string | string[]; t?: string | string[]; lang?: string | string[] }>
const dateParam = (v: string | string[] | undefined) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const tokenParam = (v: string | string[] | undefined) => (typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) ? v : null)

async function loadRide(code: string, date: string | null): Promise<RideLookup | null> {
  if (!looksLikeRideCode(code)) return null
  const { data } = await createServerSupabaseClient().rpc('get_ride_public', date ? { p_code: code, p_date: date } : { p_code: code })
  return (data as RideLookup | null) ?? null
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Search }): Promise<Metadata> {
  const { code } = await params
  const sp = await searchParams
  const t = translator(ridesStrings, await siteLocale(sp.lang))
  const ride = await loadRide(code, dateParam(sp.date)).catch(() => null)
  return { title: ride ? t('live.meta', { name: ride.name }) : t('live.title'), robots: { index: false, follow: false } }
}

export default async function Page({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Search }) {
  const { code } = await params
  const sp = await searchParams
  const want = dateParam(sp.date)
  const locale = await siteLocale(sp.lang)
  const ride = await loadRide(code, want)
  if (!ride || !ride.web) notFound()
  // The asked-for date, else today's or the next one.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const date = (want ? ride.occurrences.find((d) => d.date === want) : null)
    ?? ride.occurrences.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
    ?? null

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <RideLive ride={ride} date={date} token={tokenParam(sp.t)} locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
