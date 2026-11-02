import Link from 'next/link'
import { Coffee } from 'lucide-react'

/** get_ride_coffee (Shift 01596): the shop a ride ends at and, when a Ride Fund covers its next date, who buys the coffee. */
export interface RideCoffeeInfo {
  shop: { name: string; street: string | null; city: string | null; lat: number | null; lng: number | null; kind: string | null } | null
  fund: { slug: string; funder_name: string; funder_url: string | null; coffee_cents: number } | null
}

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`

/**
 * "Coffee at the end" on a ride page. With a fund: who buys it, how to get
 * it (check in on Shift at the start; the code comes to the phone), and a
 * link to the season's report. Without one: just where the ride ends.
 */
export default function RideCoffee({ info }: { info: RideCoffeeInfo }) {
  const { shop, fund } = info
  if (!shop) return null
  const where = [shop.street, shop.city].filter(Boolean).join(', ')
  return (
    <div className="flex gap-3 rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-accent)">
        <Coffee size={17} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-[16px] font-bold text-(--ev-ink)">
          {fund ? `Coffee at ${shop.name} after the ride, on ${fund.funder_name}` : `Ends at ${shop.name}`}
        </h2>
        {where && <p className="mt-0.5 text-[14px] text-(--ev-ink-75)">{where}</p>}
        {fund && (
          <p className="mt-2 text-[14px] leading-snug text-(--ev-ink-80)">
            Check in with the Shift app when you arrive, and a {money(fund.coffee_cents)} code for {shop.name} comes to your phone.{' '}
            <Link href={`/ride-fund/${fund.slug}`} className="font-semibold text-(--ev-accent) hover:underline">About the Ride Fund</Link>
          </p>
        )}
      </div>
    </div>
  )
}
