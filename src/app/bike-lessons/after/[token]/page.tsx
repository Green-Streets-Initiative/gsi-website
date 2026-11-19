import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { eventPath } from '@/lib/events-url'
import AfterLesson, { type Ride } from './AfterLesson'

/*
 * After the free street lesson (Shift 01870, Keith 2026-11-19). A learner
 * lands here from one tap in an email: how the lesson went (the morning
 * after), "Yes, we had the lesson" (day 14) or whether they've biked on their
 * own (a month after). The page saves the tap, asks one thing, and shows one
 * next step: plan the ride, ride with someone nearby, or an easy group ride
 * (the next ones, from the same listing as /bike-lessons). Persona:
 * first-timer. Reached only from those emails; never indexed.
 */
export const metadata: Metadata = {
  title: 'After your bike lesson',
  robots: { index: false, follow: false },
}

type Ev = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location_name: string | null
  organizer_name: string | null
}

/** Downtown Boston; every lesson instructor teaches within reach of it. */
const BOSTON = { lat: 42.3601, lng: -71.0589 }
const NEAR_MILES = 25

function milesFromBoston(lat: number, lng: number): number {
  const r = Math.PI / 180
  const dLat = (lat - BOSTON.lat) * r
  const dLng = (lng - BOSTON.lng) * r
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(BOSTON.lat * r) * Math.cos(lat * r) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(a))
}

/**
 * The next easy group rides near Boston, with their picture and link. Same
 * rows as /bike-lessons, which lists them statewide; a learner here had their
 * lesson around Boston, so a ride in Northampton is no use to them.
 */
async function readRides(): Promise<Ride[]> {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('get_bike_lessons')
    if (error || !data) return []
    const all = (data.easy_rides ?? []) as Ev[]
    if (!all.length) return []
    const ids = all.map((e) => e.id)
    const [{ data: slugs }, { data: details }] = await Promise.all([
      supabase.from('content_items').select('id, slug').in('id', ids),
      supabase.from('event_details').select('content_id, image_url, location_lat, location_lng').in('content_id', ids),
    ])
    type Detail = { content_id: string; image_url: string | null; location_lat: number | null; location_lng: number | null }
    const slug = new Map(((slugs ?? []) as { id: string; slug: string | null }[]).map((r) => [r.id, r.slug]))
    const detail = new Map(((details ?? []) as Detail[]).map((r) => [r.content_id, r]))
    return all
      .filter((e) => {
        const d = detail.get(e.id)
        return d?.location_lat != null && d.location_lng != null && milesFromBoston(d.location_lat, d.location_lng) <= NEAR_MILES
      })
      .slice(0, 3)
      .map((e) => ({
        ...e,
        image_url: detail.get(e.id)?.image_url ?? null,
        href: eventPath({ id: e.id, slug: slug.get(e.id) ?? null }),
      }))
  } catch {
    return []
  }
}

const loadRides = unstable_cache(readRides, ['lesson-after-rides-v2'], { revalidate: 600 })

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ANSWERS = ['great', 'ok', 'rough', 'had', 'rode', 'not_yet'] as const

export default async function Page({ params, searchParams }: Props) {
  const [{ token }, sp, rides] = await Promise.all([params, searchParams, loadRides()])
  const a = typeof sp.a === 'string' && (ANSWERS as readonly string[]).includes(sp.a) ? (sp.a as (typeof ANSWERS)[number]) : null
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream pb-16" style={{ paddingTop: '68px' }}>
        <AfterLesson token={token} tapped={a} rides={rides} />
      </main>
      <Footer variant="light" />
    </>
  )
}
