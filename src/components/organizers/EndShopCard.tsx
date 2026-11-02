'use client'

import { useEffect, useState } from 'react'
import { Coffee } from 'lucide-react'
import { getEndShops, type EndShop, type RideFundHere } from '@/lib/organizers/api'
import { Card, SectionTitle, cx } from './ui'

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`

function away(m: number) {
  if (m < 40) return 'At the end of the ride'
  const ft = m * 3.281
  if (ft < 1000) return `${Math.max(50, Math.round(ft / 50) * 50)} ft away`
  return `${(m / 1609.34).toFixed(1)} mi away`
}

/**
 * "Coffee at the end" (Ride Fund, Shift 01596): the organizer picks the shop
 * where the ride ends, from the shops we buy gift cards from near the
 * route's end (or the meeting point when there's no route). When a fund
 * covers the area, everyone checked in on Shift gets a coffee code there.
 * Shown only when a fund covers the ride, or a shop is already set.
 */
export default function EndShopCard({ at, value, onChange, fund }: {
  at: { lat: number; lng: number } | null
  value: string | null
  onChange: (locationId: string | null) => void
  fund: RideFundHere | null
}) {
  // About 100 m of movement before asking again, so a dragged pin doesn't flood it.
  const key = at ? `${at.lat.toFixed(3)},${at.lng.toFixed(3)}` : ''
  const [found, setFound] = useState<{ key: string; shops: EndShop[]; failed: boolean } | null>(null)
  // Shops for where the ride ends now; null while they load.
  const shops = !at ? [] : found?.key === key ? found.shops : null
  const failed = !!at && found?.key === key && found.failed

  useEffect(() => {
    if (!at) return
    let live = true
    const t = setTimeout(() => {
      getEndShops(at.lat, at.lng).then(
        (s) => { if (live) setFound({ key, shops: s, failed: false }) },
        () => { if (live) setFound({ key, shops: [], failed: true }) })
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickedElsewhere = !!value && shops != null && !shops.some((s) => s.location_id === value)

  return (
    <Card id="sec-coffee">
      <SectionTitle hint={fund
        ? `${fund.funder_name} buys everyone who checks in on Shift a ${money(fund.coffee_cents)} coffee at the shop where the ride ends.`
        : 'The shop where the ride ends. It shows on your ride page.'}>
        Coffee at the end
      </SectionTitle>

      <p className="mb-2 text-[15px] font-semibold text-(--ev-ink-85)">Where does the ride end?</p>
      {shops == null ? (
        <p className="text-[14px] text-(--ev-ink-75)">Finding shops near the end of the ride…</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Shop where the ride ends">
          {shops.slice(0, 6).map((s) => (
            <button key={s.location_id} type="button" role="radio" aria-checked={value === s.location_id}
              onClick={() => onChange(s.location_id)}
              className={cx('flex items-start gap-3 rounded-xl border p-3 text-left transition',
                value === s.location_id ? 'border-(--ev-accent-fill) bg-(--ev-panel) ring-1 ring-(--ev-accent-fill)' : 'border-(--ev-line-strong) bg-white hover:bg-(--ev-panel-faint)')}>
              <Coffee className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-(--ev-ink)">{s.name}</span>
                <span className="mt-0.5 block text-[14px] leading-snug text-(--ev-ink-75)">
                  {[s.street, away(s.distance_m)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(null)}
            className={cx('rounded-xl border p-3 text-left text-[15px] font-semibold transition',
              !value ? 'border-(--ev-accent-fill) bg-(--ev-panel) text-(--ev-ink) ring-1 ring-(--ev-accent-fill)' : 'border-(--ev-line-strong) bg-white text-(--ev-ink-85) hover:bg-(--ev-panel-faint)')}>
            No coffee stop
          </button>
        </div>
      )}

      {shops != null && shops.length === 0 && (
        <p className="mt-3 text-[14px] leading-snug text-(--ev-ink-75)">
          {failed
            ? "Couldn't load shops just now. Save the ride and try again later."
            : <>None of the shops we buy coffee from are near where this ride ends yet.{' '}
                <a href="mailto:info@gogreenstreets.org?subject=Coffee%20shop%20where%20our%20ride%20ends" className="font-semibold text-(--ev-accent) hover:underline">Tell us your shop</a>{' '}
                and we&rsquo;ll look at adding it.</>}
        </p>
      )}
      {pickedElsewhere && (
        <p className="mt-3 text-[14px] leading-snug text-(--ev-ink-75)">
          The shop you picked before isn&rsquo;t near the new end of the ride. Pick one above, or No coffee stop.
        </p>
      )}
    </Card>
  )
}
