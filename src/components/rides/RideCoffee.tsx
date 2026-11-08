import Link from 'next/link'
import { Store } from 'lucide-react'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

/** get_ride_coffee (Shift 01596): the shop a ride ends at and, when a Ride Fund covers its next date, who funds the $5 there. */
export interface RideCoffeeInfo {
  shop: { name: string; street: string | null; city: string | null; lat: number | null; lng: number | null; kind: string | null } | null
  fund: { slug: string; funder_name: string; funder_url: string | null; coffee_cents: number } | null
}

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`

/**
 * The stop at the end, on a ride page. With a fund: who funds the $5 to spend
 * there, how to get it (say Going and ride with Shift; it comes to the phone),
 * and a link to the season's report. Without one: just where the ride ends.
 */
export default function RideCoffee({ info, locale = 'en' }: { info: RideCoffeeInfo; locale?: SiteLocale }) {
  const t = translator(ridesStrings, locale)
  const { shop, fund } = info
  if (!shop) return null
  const where = [shop.street, shop.city].filter(Boolean).join(', ')
  return (
    <div className="flex gap-3 rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-accent)">
        <Store size={17} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-[16px] font-bold text-(--ev-ink)">
          {fund ? t('coffee.fund', { amount: money(fund.coffee_cents), shop: shop.name, funder: fund.funder_name }) : t('coffee.ends', { shop: shop.name })}
        </h2>
        {where && <p className="mt-0.5 text-[14px] text-(--ev-ink-75)">{where}</p>}
        {fund && (
          <p className="mt-2 text-[14px] leading-snug text-(--ev-ink-80)">
            {t('coffee.how', { amount: money(fund.coffee_cents), shop: shop.name })}{' '}
            <Link href={withLang(`/ride-fund/${fund.slug}`, locale)} className="font-semibold text-(--ev-accent) hover:underline">{t('coffee.about')}</Link>
          </p>
        )}
      </div>
    </div>
  )
}
