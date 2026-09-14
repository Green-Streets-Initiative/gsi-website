import { DeviceMobile, Lightning, Package, Path } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import { withUtm } from '@/lib/utm'
import { formatDollars } from '../_lib/load'
import { brandLabel, EntryTypePill, type Prize } from '../_lib/prizes'
import { Section, SectionHeading } from './Section'

/*
 * "What's at stake": Grand (image cards) → Featured (2-up) → Standard (rows).
 * Empty tiers hide. The aggregate value subhead is sum(value × quantity)
 * rounded down to the nearest $100, hidden when nothing is valued.
 */
export function PrizeSection({ prizes, eventCampaign, aggregateLabel }: { prizes: Prize[]; eventCampaign: string; aggregateLabel: string | null }) {
  const grand = prizes.filter((p) => p.tier === 'grand').sort(sortPrizesByDisplay)
  const featured = prizes.filter((p) => p.tier === 'featured').sort(sortPrizesByDisplay)
  const standard = prizes.filter((p) => p.tier === 'standard').sort(sortPrizesByDisplay)
  if (prizes.length === 0) return null

  if (grand.length > 4) {
    // 4+ Grand prizes is a misconfiguration; the layout copes but admin should re-tier.
    console.warn(`[shift-your-summer] ${grand.length} Grand prizes — UI scales to 3-up; admin should re-tier.`)
  }
  const grandCols = grand.length === 1 ? 'grid-cols-1' : grand.length === 2 ? 'sm:grid-cols-2' : 'lg:grid-cols-3'

  return (
    <Section shape="wanderLeft" tone="white">
      <SectionHeading title="What's at stake" lede={aggregateLabel ?? undefined} />
      {grand.length > 0 && (
        <div className={`mb-8 grid gap-5 ${grandCols}`}>
          {grand.map((p) => (
            <GrandPrizeCard key={p.id} prize={p} layout={grand.length} eventCampaign={eventCampaign} />
          ))}
        </div>
      )}
      {featured.length > 0 && (
        <div className="mb-8 grid gap-5 sm:grid-cols-2">
          {featured.map((p) => (
            <FeaturedPrizeCard key={p.id} prize={p} eventCampaign={eventCampaign} />
          ))}
        </div>
      )}
      {standard.length > 0 && (
        <ul className="grid border-t border-navy/15 sm:grid-cols-2 sm:gap-x-10">
          {standard.map((p) => (
            <StandardPrizeRow key={p.id} prize={p} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function sortPrizesByDisplay(a: Prize, b: Prize): number {
  if (a.display_order !== b.display_order) return a.display_order - b.display_order
  return (b.value_amount ?? -1) - (a.value_amount ?? -1)
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">{children}</span>
}

/* ── Segway MUXI: enriched grand-prize content ──────────────
 * Hardcoded because the Prize schema doesn't carry feature specs, accessory
 * bundles, or donor logos. Any other grand prize gets the simple card.
 */
export const SEGWAY_GRAND_PRIZE = {
  description:
    'Segway’s compact short-tail utility e-bike — a step-through commuter that’s part beach cruiser, part Dutch cargo. Pull up to work on schedule, coffee in style, and hit the bike path on Saturday. One bike, every kind of trip.',
  valueSubtext: 'Bike + bundle',
  heroTagline: 'Plus a 3-piece accessory bundle',
  features: [
    { icon: Path, label: 'Up to 80-mi range', sub: '716Wh removable battery' },
    { icon: Lightning, label: '20 mph top speed', sub: '750W rear hub motor' },
    { icon: Package, label: '418 lb payload', sub: 'Cargo, passenger, both' },
    { icon: DeviceMobile, label: 'Apple Find My', sub: 'AirLock + GPS tracking' },
  ] as { icon: Icon; label: string; sub: string }[],
  accessories: [
    { name: 'Middle basket', blurb: 'Frame-mounted storage between the knees', img: '/assets/prizes/acc-middle-basket.png' },
    { name: 'Passenger kit', blurb: 'Cushioned rear seat with foot pegs', img: '/assets/prizes/acc-passenger-kit.png' },
    { name: 'Fender kit', blurb: 'Front + rear fenders for rain and road spray', img: '/assets/prizes/acc-fender.png' },
  ],
  donorLogoUrl: '/assets/prizes/segway-logo.png',
}

export function SegwayFeatures({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${compact ? '' : 'md:grid-cols-4 md:gap-3'}`}>
      {SEGWAY_GRAND_PRIZE.features.map((f) => (
        <div key={f.label} className="flex flex-col gap-1 rounded-[10px] border border-navy/10 bg-cream p-3.5">
          <f.icon size={20} className="text-forest" aria-hidden />
          <div className="text-[14px] font-semibold tracking-tight text-navy">{f.label}</div>
          <div className="text-[12px] leading-snug text-ink-soft">{f.sub}</div>
        </div>
      ))}
    </div>
  )
}

function GrandPrizeCard({ prize, layout, eventCampaign }: { prize: Prize; layout: number; eventCampaign: string }) {
  const brand = brandLabel(prize)
  const taggedUrl = withUtm(prize.product_url, { medium: 'event_page', campaign: eventCampaign, content: 'grand_prize_card' })

  if (brand !== 'Segway') {
    const card = (
      <div className="overflow-hidden rounded-[16px] border border-navy/10 bg-white transition-colors hover:border-navy/30">
        <div className="relative flex items-center justify-center bg-cream p-6" style={{ minHeight: layout === 1 ? 220 : layout === 2 ? 180 : 160 }}>
          {prize.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={prize.image_url} alt={prize.description} className="max-h-[260px] w-auto max-w-full object-contain" />
          )}
          <span className="absolute left-4 top-4"><Label>Grand prize</Label></span>
        </div>
        <div className="space-y-2 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-serif text-[1.25rem] leading-tight text-navy">{prize.description}</p>
            {prize.value_amount != null && <span className="shrink-0 text-sm font-semibold text-green-deep">~{formatDollars(prize.value_amount)} value</span>}
          </div>
          {brand && <p className="text-sm text-ink-soft">From <span className="font-semibold text-navy">{brand}</span></p>}
          <div className="pt-1"><EntryTypePill prize={prize} tone="light" /></div>
          {taggedUrl && <p className="pt-1 text-sm font-semibold text-forest">View product details &rarr;</p>}
        </div>
      </div>
    )
    return taggedUrl ? <a href={taggedUrl} target="_blank" rel="noopener noreferrer" className="block">{card}</a> : card
  }

  const gp = SEGWAY_GRAND_PRIZE
  return (
    <article className="overflow-hidden rounded-[20px] border border-navy/10 bg-white">
      <div className="relative h-[280px] overflow-hidden bg-cream md:h-[420px]">
        <div className="absolute left-4 top-4 z-10 md:left-6 md:top-6"><Label>Grand prize</Label></div>
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 md:right-6 md:top-6">
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft md:inline">Donated by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gp.donorLogoUrl} alt="Segway" className="h-3 w-auto md:h-4" />
        </div>
        {prize.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={prize.image_url} alt={prize.description} className="absolute left-1/2 top-[46%] h-auto w-[92%] max-w-[720px] -translate-x-1/2 -translate-y-1/2 md:w-[70%]" />
        )}
        <div className="absolute bottom-4 left-4 z-10 text-[12px] font-semibold text-ink-soft md:bottom-6 md:left-6 md:text-[13px]">{gp.heroTagline}</div>
      </div>

      <div className="px-5 pt-6 md:flex md:items-end md:justify-between md:gap-6 md:px-8 md:pt-7">
        <div>
          <h3 className="font-serif text-[1.75rem] leading-[1.05] text-navy md:text-[2.25rem]">{prize.description}</h3>
          <p className="mt-1.5 text-sm text-ink-soft md:text-base">From <span className="font-semibold text-navy">Segway</span></p>
        </div>
        {prize.value_amount != null && (
          <div className="mt-3 shrink-0 md:mt-0 md:text-right">
            <div className="font-serif text-[1.75rem] leading-none text-green-deep">~{formatDollars(prize.value_amount)} value</div>
            <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{gp.valueSubtext}</div>
          </div>
        )}
      </div>

      <p className="mx-5 mt-4 max-w-[880px] text-[15px] leading-relaxed text-ink-soft md:mx-8 md:mt-5 md:text-[17px]" style={{ textWrap: 'pretty' }}>
        {gp.description}
      </p>

      <div className="mx-5 mt-5 md:mx-8 md:mt-6"><SegwayFeatures /></div>

      <div className="mx-5 mt-6 md:mx-8 md:mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h4 className="font-serif text-[1.25rem] text-navy">Includes a 3-piece accessory bundle</h4>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">All three, free</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {gp.accessories.map((a) => (
            <div key={a.name} className="flex items-center gap-3.5 rounded-[10px] border border-navy/10 p-2.5 md:block md:p-0">
              <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-md bg-cream md:h-[160px] md:w-full md:rounded-b-none md:rounded-t-[10px] md:p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.img} alt={a.name} loading="lazy" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 md:p-3">
                <div className="text-sm font-semibold text-navy">{a.name}</div>
                <div className="mt-0.5 text-xs leading-snug text-ink-soft">{a.blurb}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-navy/10 bg-cream px-5 py-5 md:px-8">
        <EntryTypePill prize={prize} tone="light" />
        {taggedUrl && (
          <a href={taggedUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline-offset-4 hover:underline">
            View product details &rarr;
          </a>
        )}
      </div>
    </article>
  )
}

function FeaturedPrizeCard({ prize, eventCampaign }: { prize: Prize; eventCampaign: string }) {
  const brand = brandLabel(prize)
  const taggedUrl = withUtm(prize.product_url, { medium: 'event_page', campaign: eventCampaign, content: 'featured_prize_card' })
  const card = (
    <div className="flex gap-4 rounded-[14px] border border-navy/10 bg-white p-4 transition-colors hover:border-navy/30">
      {prize.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={prize.image_url} alt={prize.description} className="h-20 w-20 shrink-0 rounded-[10px] bg-cream object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Label>Featured</Label>
          {prize.quantity > 1 && <span className="rounded-full border border-navy/20 px-2 py-0.5 text-xs font-semibold text-navy">×{prize.quantity}</span>}
        </div>
        <p className="font-serif text-[1.125rem] leading-snug text-navy">{prize.description}</p>
        {brand && <p className="mt-1 text-sm text-ink-soft">Donated by <span className="font-semibold text-navy">{brand}</span></p>}
        <div className="mt-2"><EntryTypePill prize={prize} tone="light" /></div>
        {taggedUrl && <p className="mt-1.5 text-sm font-semibold text-forest">View product details &rarr;</p>}
      </div>
    </div>
  )
  return taggedUrl ? <a href={taggedUrl} target="_blank" rel="noopener noreferrer" className="block">{card}</a> : card
}

function StandardPrizeRow({ prize }: { prize: Prize }) {
  const brand = brandLabel(prize)
  return (
    <li className="flex items-center gap-3 border-b border-navy/15 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-navy">{prize.description}</p>
        {brand && <p className="mt-0.5 text-[13px] text-ink-soft">{brand}</p>}
      </div>
      {prize.quantity > 1 && <span className="shrink-0 text-[13px] font-semibold text-navy">×{prize.quantity}</span>}
    </li>
  )
}
