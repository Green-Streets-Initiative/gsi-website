import Link from 'next/link'
import { withUtm } from '@/lib/utm'
import type { ClaimedWinner } from '../_lib/load'
import { SEGWAY_GRAND_PRIZE, SegwayFeatures } from './Prizes'
import { Section, SectionHeading } from './Section'
import { RULES_PUBLISHED } from './store'

/*
 * Ended state only. Claimed prize winners grouped Grand → Featured →
 * Standard. First names only, for privacy.
 */
function wonArticle(desc: string): string {
  return /^[aeiou$]/i.test(desc) ? 'won an' : 'won a'
}

export function WinnersSection({ winners, eventCampaign }: { winners: ClaimedWinner[]; eventCampaign: string }) {
  if (winners.length === 0) return null
  const grand = winners.filter((w) => w.prizeTier === 'grand')
  const featured = winners.filter((w) => w.prizeTier === 'featured')
  const standard = winners.filter((w) => w.prizeTier === 'standard')

  return (
    <Section shape="wanderLeft" tone="white" width="read">
      <SectionHeading
        title="Prize winners"
        lede={`${winners.length} ${winners.length === 1 ? 'prize' : 'prizes'} claimed. Winners were drawn by weighted lottery, one entry per active trip.`}
      />

      {grand.map((w, i) => {
        const taggedUrl = withUtm(w.productUrl, { medium: 'event_page', campaign: eventCampaign, content: 'winner_grand_card' })
        const isSegway = w.brandName === 'Segway'
        const card = (
          <div className={`mb-6 overflow-hidden rounded-[18px] border border-navy/10 bg-cream ${taggedUrl ? 'transition-colors hover:border-navy/30' : ''}`}>
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Grand prize</span>
              {isSegway && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={SEGWAY_GRAND_PRIZE.donorLogoUrl} alt="Segway" className="h-4 w-auto" />
              )}
            </div>
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:gap-6 sm:p-6">
              {w.prizeImageUrl && (
                <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white sm:h-[220px] sm:w-[260px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.prizeImageUrl} alt={w.prizeDescription} className="h-[160px] w-auto object-contain sm:h-[200px]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[1.5rem] leading-tight text-navy sm:text-[1.75rem]">
                  {w.winnerFirstName} {wonArticle(w.prizeDescription)} {w.prizeDescription}
                </p>
                {!isSegway && w.brandName && (
                  <p className="mt-2 text-sm text-ink-soft">From <span className="font-semibold text-navy">{w.brandName}</span></p>
                )}
                {isSegway && <div className="mt-4"><SegwayFeatures compact /></div>}
                {taggedUrl && <p className="mt-4 text-sm font-semibold text-forest">View product details &rarr;</p>}
              </div>
            </div>
          </div>
        )
        return taggedUrl ? (
          <a key={`grand-${i}`} href={taggedUrl} target="_blank" rel="noopener noreferrer" className="block">{card}</a>
        ) : (
          <div key={`grand-${i}`}>{card}</div>
        )
      })}

      {featured.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {featured.map((w, i) => {
            const taggedUrl = withUtm(w.productUrl, { medium: 'event_page', campaign: eventCampaign, content: 'winner_featured_card' })
            const card = (
              <div className={`flex items-center gap-3.5 rounded-[12px] border border-navy/10 bg-cream p-4 ${taggedUrl ? 'transition-colors hover:border-navy/30' : ''}`}>
                {w.prizeImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.prizeImageUrl} alt={w.prizeDescription} className="hidden h-12 w-12 shrink-0 rounded-lg bg-white object-cover sm:block" />
                )}
                <div className="min-w-0">
                  <p className="text-[15px] font-medium leading-snug text-navy">
                    {w.winnerFirstName} {wonArticle(w.prizeDescription)} {w.prizeDescription}
                  </p>
                  {taggedUrl && <p className="mt-0.5 text-[13px] font-semibold text-forest">View product &rarr;</p>}
                </div>
              </div>
            )
            return taggedUrl ? (
              <a key={`featured-${i}`} href={taggedUrl} target="_blank" rel="noopener noreferrer" className="block">{card}</a>
            ) : (
              <div key={`featured-${i}`}>{card}</div>
            )
          })}
        </div>
      )}

      {standard.length > 0 && (
        <ul className="border-t border-navy/15">
          {standard.map((w, i) => {
            const taggedUrl = withUtm(w.productUrl, { medium: 'event_page', campaign: eventCampaign, content: 'winner_standard_row' })
            const text = (
              <p className="text-[15px] text-navy">
                <span className="font-semibold">{w.winnerFirstName}</span> {wonArticle(w.prizeDescription)} {w.prizeDescription}
              </p>
            )
            return (
              <li key={`standard-${i}`} className="border-b border-navy/15 py-3">
                {taggedUrl ? (
                  <a href={taggedUrl} target="_blank" rel="noopener noreferrer" className="block hover:text-forest">{text}</a>
                ) : (
                  text
                )}
              </li>
            )
          })}
        </ul>
      )}

      {RULES_PUBLISHED && (
        <p className="mt-6 text-[13px] text-ink-soft">
          See the <Link href="/events/shift-your-summer/rules" className="font-semibold text-forest underline-offset-4 hover:underline">official rules</Link> for drawing details and eligibility.
        </p>
      )}
    </Section>
  )
}
