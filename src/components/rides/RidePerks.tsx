'use client'

import posthog from 'posthog-js'
import { Beer, Bike, Coffee, Croissant, Dumbbell, ExternalLink, IceCreamCone, Landmark, ShoppingBag, ShoppingBasket, Store, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { BLOCK_M, type PerkKind, type PerkStop } from '@/lib/bike-perks'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { ridesStrings, type RideKey } from '@/lib/site-strings/rides'

export const KIND_ICON: Record<PerkKind, LucideIcon> = {
  cafe: Coffee, bakery: Croissant, food: UtensilsCrossed, bar: Beer, sweets: IceCreamCone, market: ShoppingBasket,
  bike_shop: Bike, shop: ShoppingBag, fitness: Dumbbell, attraction: Landmark, other: Store,
}

/**
 * "Bike perks near this ride": Bicycle Benefits members within a block of the
 * meeting spot or the route (src/lib/bike-perks.ts). Each row is the place
 * (its kind as the icon), its perk as a chip, and where it is. The program is
 * named up top (Keith 2026-10-23: credit it wherever one shows), and the
 * sticker the perk needs is said once, with one place that sells it.
 */
export default function RidePerks({ stops, code, locale = 'en' }: { stops: PerkStop[]; code: string; locale?: SiteLocale }) {
  const t = translator(ridesStrings, locale)
  // Same words as perkWhere() in src/lib/bike-perks.ts, in the page's language.
  const where = (p: PerkStop) =>
    p.at === 'start' ? t('pwhere.start') : p.at === 'route' ? t('pwhere.route')
      : p.meters <= BLOCK_M ? t('pwhere.block') : t('pwhere.mi', { mi: Math.max(0.1, p.meters / 1609).toFixed(1) })
  const seller = stops.find((p) => p.stickers)
  const track = (target: string) => posthog.capture('ride_perk_link_clicked', { code, target })
  return (
    <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4">
      <h2 className="text-[16px] font-bold text-(--ev-ink)">{t('perks.title')}</h2>
      <p className="mt-0.5 text-[14px] text-(--ev-ink-75)">{t('perks.sub')}</p>
      <ul className="mt-3 space-y-3">
        {stops.map((p) => {
          const Icon = KIND_ICON[p.kind]
          return (
            <li key={`${p.name}|${p.lat}|${p.lng}`} className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-accent)"
                title={t(`pk.${p.kind}` as RideKey)}>
                <Icon size={17} aria-label={t(`pk.${p.kind}` as RideKey)} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-(--ev-ink)">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={() => track('business')} className="hover:underline">{p.name}</a>
                  ) : p.name}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-(--ev-ink-75)">
                  <span className="rounded-lg bg-(--ev-accent-tint-14) px-2.5 py-0.5 font-semibold text-(--ev-ink)">{p.perk}</span>
                  {where(p)}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[14px] text-(--ev-ink-75)">
        {seller ? t('perks.no_sticker_seller', { name: seller.name }) : t('perks.no_sticker')}{' '}
        <a href="https://bicyclebenefits.org" target="_blank" rel="noopener noreferrer" onClick={() => track('program')}
          className="inline-flex items-center gap-1 font-semibold text-(--ev-accent) hover:underline">
          {t('perks.about')} <ExternalLink size={12} />
        </a>
      </p>
    </div>
  )
}
