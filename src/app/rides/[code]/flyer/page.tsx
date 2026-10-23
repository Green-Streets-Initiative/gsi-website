import type { Metadata } from 'next'
import Link from 'next/link'
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PrintButton from '@/app/events/shift-your-summer/flyer/PrintButton'
import StaticMapSvg from '@/components/nearby/StaticMapSvg'
import { routeMiles } from '@/lib/organizers/route-geo'
import { looksLikeRideCode, nextWhen, type RideLookup } from '@/lib/rides/public'
import { rideFacts } from '@/components/rides/RideFacts'
import { RIDE_STYLE_LABEL } from '@/lib/ride-style'
import { promoLink } from '@/lib/rides/promo'
import { contrast, organizerBrand } from '@/lib/organizers/brand'
import { rideExtras } from '@/lib/rides/host'

/**
 * A ride's printable flyer: one letter-size page with the facts, the route
 * on a map, and a QR code that opens the ride page (through the Promote
 * tab's "qr" link, so scans are counted). Built like the site's other
 * printable flyers (Shift Your Semester posters, the employer flyer): a
 * server-rendered vector QR, StaticMapSvg, PrintButton. For organizers with
 * no designed flyer of their own; Promote links here. It wears the
 * organizer's logo and colors (lib/organizers/brand.ts), as the share card
 * does; Shift shows only as the small "RSVP with" line at the foot.
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
  const meet = ride.meetup_lat != null && ride.meetup_lng != null ? { lat: ride.meetup_lat, lng: ride.meetup_lng } : null
  const extras = await rideExtras(ride.id).catch(() => null)
  // The ride page's facts, set the same way: numbers label-over-value, then
  // the level and policies as one line of icon-and-words.
  const facts = rideFacts(ride, miles, extras?.ascentFt ?? null)
  const stats = [
    ...facts.stats.filter((f) => f.label !== 'Riding time'),
    facts.level ? { label: 'Level', value: RIDE_STYLE_LABEL[facts.level] === 'Rec' ? 'Recreational' : RIDE_STYLE_LABEL[facts.level] } : null,
  ].filter(Boolean).slice(0, 4) as { label: string; value: string; sub?: string }[]
  const host = extras?.host ?? null
  const brand = await organizerBrand(host?.logo_url)
  const hostName = host?.name ?? ride.organizer_name
  const ink = brand?.ink ?? '#191A2E'
  const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
  // The QR stays dark on white for any phone camera; the brand's ink when it is dark enough.
  const qrInk = contrast(hexRgb(ink), [255, 255, 255]) >= 7 ? ink : '#191A2E'
  const qrSvg = await QRCode.toString(promoLink(ride.code, 'qr'), { type: 'svg', margin: 0, color: { dark: qrInk, light: '#ffffff' } })

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

        <div className="overflow-hidden rounded-[24px] border-2" style={{ borderColor: ink }}>
          <div className="px-10 pb-8 pt-10" style={{ backgroundColor: brand?.bg ?? '#ffffff', color: ink }}>
            {brand ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo} alt={hostName ?? ''} className="mb-6 h-auto max-h-[110px] w-auto max-w-[320px] object-contain" />
            ) : hostName ? (
              <p className="mb-3 text-[20px] font-bold">{hostName}</p>
            ) : null}
            <h1 className="text-[46px] font-extrabold leading-[1.04] tracking-tight">{ride.name}</h1>
            {when && <p className="mt-4 text-[24px] font-bold">{when}</p>}
            {ride.meetup_name && (
              <p className="mt-1 text-[19px]">
                Meet at <strong>{ride.meetup_name}</strong>{ride.meetup_address ? `, ${ride.meetup_address.replace(/,?\s*USA$/, '')}` : ''}
              </p>
            )}
            {stats.length > 0 && (
              <dl className="mt-6 flex">
                {stats.map((f, i) => (
                  <div key={f.label} className={i ? 'ml-6 border-l-2 pl-6' : ''} style={{ borderColor: `${ink}40` }}>
                    <dt className="text-[15px] font-medium">{f.label}</dt>
                    <dd className="text-[26px] font-extrabold leading-tight">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {facts.policies.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                {facts.policies.map(({ Icon, title }) => (
                  <li key={title} className="flex items-center gap-2 text-[17px] font-bold">
                    <Icon size={24} weight="regular" aria-hidden /> {title}
                  </li>
                ))}
              </ul>
            )}
            {ride.description && (
              <p className="mt-5 max-w-[6.8in] text-[16px] leading-relaxed">{ride.description.slice(0, 420)}{ride.description.length > 420 ? '…' : ''}</p>
            )}
          </div>

          {center && half && (
            <div className="border-y border-[#191A2E]/15">
              <StaticMapSvg
                center={center} maxHalf={half} width={760} height={300} title={`Map of ${ride.name}`}
                fitPoints={pts} quiet homeColor={brand?.accent ?? '#2966E5'}
                lines={route.length >= 2 ? [{ coords: route.map((p) => [p.lng, p.lat] as [number, number]), color: brand?.accent ?? '#2966E5' }] : []}
                markers={meet ? [{ lat: meet.lat, lng: meet.lng, kind: 'home', label: 'Meet here' }] : []}
                className="block h-auto w-full"
              />
            </div>
          )}

          <div className="flex items-center gap-8 px-10 py-7">
            <div className="h-[150px] w-[150px] shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div>
              <p className="text-[28px] font-extrabold leading-tight">Scan to say you&rsquo;re coming</p>
              <p className="mt-1 text-[17px] text-[#191A2E]/85">No app needed. You&rsquo;ll get a reminder, and a heads-up if plans change.</p>
              <p className="mt-2 text-[15px] font-semibold">gogreenstreets.org/rides/{ride.code}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-[#191A2E]/15 px-10 py-2.5">
            <span className="text-[13px] text-[#191A2E]/75">RSVP with</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/shift-wordmark-dark.svg" alt="Shift" className="h-[15px] w-auto" />
          </div>
        </div>

        <p className="flyer-no-print mt-4 text-center text-[15px] text-[#191A2E]/75">
          Prints on one letter-size page. Scans of the code count on the Promote tab.
        </p>
      </div>
    </main>
  )
}
