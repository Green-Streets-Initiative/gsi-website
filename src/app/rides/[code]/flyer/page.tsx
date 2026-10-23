import type { Metadata } from 'next'
import Link from 'next/link'
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PrintButton from '@/app/events/shift-your-summer/flyer/PrintButton'
import StaticMapSvg from '@/components/nearby/StaticMapSvg'
import { TAG_OPTIONS } from '@/lib/organizers/ride-words'
import { routeMiles } from '@/lib/organizers/route-geo'
import { PACE_LABEL, looksLikeRideCode, nextWhen, type RideLookup } from '@/lib/rides/public'
import { promoLink } from '@/lib/rides/promo'

/**
 * A ride's printable flyer: one letter-size page with the facts, the route
 * on a map, and a QR code that opens the ride page (through the Promote
 * tab's "qr" link, so scans are counted). Built like the site's other
 * printable flyers (Shift Your Semester posters, the employer flyer): a
 * server-rendered vector QR, StaticMapSvg, PrintButton. For organizers with
 * no designed flyer of their own; Promote links here.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Ride flyer | Green Streets Initiative', robots: { index: false } }

export default async function RideFlyerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!looksLikeRideCode(code)) notFound()
  const { data } = await createServerSupabaseClient().rpc('get_ride_public', { p_code: code })
  const ride = data as RideLookup | null
  if (!ride || !ride.web) notFound()

  const when = nextWhen(ride)
  const route = (ride.route_waypoints ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  const miles = route.length >= 2 ? routeMiles(route) : null
  const facts = [
    ride.pace ? PACE_LABEL[ride.pace] : null,
    miles ? `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} miles` : null,
    ride.no_drop ? 'Nobody gets dropped' : null,
    ...(ride.tags ?? []).map((t) => TAG_OPTIONS.find((o) => o.key === t)?.label).filter(Boolean),
  ].filter(Boolean) as string[]
  const meet = ride.meetup_lat != null && ride.meetup_lng != null ? { lat: ride.meetup_lat, lng: ride.meetup_lng } : null
  const qrSvg = await QRCode.toString(promoLink(ride.code, 'qr'), { type: 'svg', margin: 0, color: { dark: '#191A2E', light: '#ffffff' } })

  // Frame the route (or the meeting point) with a little room.
  const pts = route.length >= 2 ? route : meet ? [meet] : []
  const lats = pts.map((p) => p.lat)
  const lngs = pts.map((p) => p.lng)
  const center = pts.length ? { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 } : null
  const half = pts.length ? { lat: Math.max(0.006, (Math.max(...lats) - Math.min(...lats)) * 0.6), lng: Math.max(0.008, (Math.max(...lngs) - Math.min(...lngs)) * 0.6) } : null

  return (
    <main className="flyer-root min-h-screen bg-white text-[#191A2E]">
      <style>{`
        @page { size: letter; margin: 0.4in 0.5in; }
        @media print {
          .flyer-no-print { display: none !important; }
          .flyer-root { background: white !important; min-height: 0 !important; }
          body > :not(.flyer-root) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
        }
        .flyer-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
      <div className="mx-auto max-w-[8.5in] px-8 py-6">
        <div className="flyer-no-print mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[#191A2E]/10 bg-[#F4F8EE] px-5 py-3">
          <Link href={`/rides/${ride.code}`} className="text-sm font-semibold text-[#191A2E]/75 hover:text-[#191A2E]">&larr; The ride page</Link>
          <PrintButton />
        </div>

        <div className="overflow-hidden rounded-[24px] border-2 border-[#191A2E]">
          <div className="px-10 pb-8 pt-10">
            {ride.organizer_name && <p className="mb-2 text-[15px] font-bold uppercase tracking-[0.18em] text-[#2D6A4F]">{ride.organizer_name}</p>}
            <h1 className="font-display text-[46px] font-extrabold leading-[1.04] tracking-tight">{ride.name}</h1>
            {when && <p className="mt-4 text-[24px] font-bold">{when}</p>}
            {ride.meetup_name && (
              <p className="mt-1 text-[19px]">
                Meet at <strong>{ride.meetup_name}</strong>{ride.meetup_address ? `, ${ride.meetup_address.replace(/,?\s*USA$/, '')}` : ''}
              </p>
            )}
            {facts.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {facts.map((f) => <li key={f} className="rounded-full border border-[#191A2E]/25 px-3.5 py-1 text-[15px] font-semibold">{f}</li>)}
              </ul>
            )}
            {ride.description && (
              <p className="mt-5 max-w-[6.8in] text-[16px] leading-relaxed text-[#191A2E]/85">{ride.description.slice(0, 420)}{ride.description.length > 420 ? '…' : ''}</p>
            )}
          </div>

          {center && half && (
            <div className="border-y border-[#191A2E]/15">
              <StaticMapSvg
                center={center} maxHalf={half} width={760} height={300} title={`Map of ${ride.name}`}
                fitPoints={pts}
                lines={route.length >= 2 ? [{ coords: route.map((p) => [p.lng, p.lat] as [number, number]), color: '#2966E5' }] : []}
                markers={meet ? [{ lat: meet.lat, lng: meet.lng, kind: 'home', label: 'Meet here' }] : []}
                className="block h-auto w-full"
              />
            </div>
          )}

          <div className="flex items-center gap-8 px-10 py-7">
            <div className="h-[150px] w-[150px] shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div>
              <p className="font-display text-[28px] font-extrabold leading-tight">Scan to say you&rsquo;re coming</p>
              <p className="mt-1 text-[17px] text-[#191A2E]/85">No app needed. You&rsquo;ll get a reminder, and a heads-up if plans change.</p>
              <p className="mt-2 text-[15px] font-semibold">gogreenstreets.org/rides/{ride.code}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 border-t border-[#191A2E]/15 bg-[#F4F8EE] px-10 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/shift-wordmark-dark.svg" alt="Shift" className="h-[20px] w-auto" />
            <span className="text-[13px] text-[#191A2E]/75">by</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/gsi-wordmark.png" alt="Green Streets Initiative" className="h-[20px] w-auto" />
          </div>
        </div>

        <p className="flyer-no-print mt-4 text-center text-[15px] text-[#191A2E]/75">
          Prints on one letter-size page. Scans of the code count on the Promote tab.
        </p>
      </div>
    </main>
  )
}
