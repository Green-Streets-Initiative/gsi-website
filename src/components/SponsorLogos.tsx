import { withUtm } from '@/lib/utm'
import { resolveSponsorTier, type Sponsor, type Sponsorship, type SponsorTier } from '@/lib/sponsors/roll'

/*
 * Sponsor logos by tier: Presenting (full width) → Champion (2-up) →
 * Community (4-up). Logos sit on white tiles with a hairline so dark and
 * light marks both read on cream. Empty tiers hide. Shared by the event page
 * and the public campaign report.
 */

const TIER_LABEL: Record<SponsorTier, string> = {
  presenting: 'Presenting sponsor',
  champion: 'Champion sponsors',
  community: 'Community sponsors and prize donors',
}

const TIER_COLS: Record<SponsorTier, string> = {
  presenting: 'grid-cols-1',
  champion: 'sm:grid-cols-2',
  community: 'grid-cols-2 sm:grid-cols-4',
}

export default function SponsorLogos({
  sponsorships,
  utm,
}: {
  sponsorships: Sponsorship[]
  /** Where the click came from, for the sponsor's analytics. */
  utm: { medium: string; campaign: string }
}) {
  const tiered = sponsorships
    .filter((s) => s.sponsors)
    .map((s) => ({ ...s, _tier: resolveSponsorTier(s) }))
    .sort((a, b) => a.display_order - b.display_order)
  if (tiered.length === 0) return null

  const tiers: SponsorTier[] = ['presenting', 'champion', 'community']

  return (
    <div className="flex flex-col gap-10">
      {tiers
        .map((tier) => ({ tier, items: tiered.filter((s) => s._tier === tier) }))
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.tier}>
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">{TIER_LABEL[g.tier]}</p>
            <div className={`grid gap-4 ${TIER_COLS[g.tier]}`}>
              {g.items.map((s) => (
                <SponsorTile key={s.id} sponsor={s.sponsors!} size={g.tier} utm={utm} />
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

function SponsorTile({ sponsor, size, utm }: { sponsor: Sponsor; size: SponsorTier; utm: { medium: string; campaign: string } }) {
  const tileHeight = size === 'presenting' ? 'h-[120px]' : size === 'champion' ? 'h-[88px]' : 'h-[72px]'
  const logoMax =
    size === 'presenting' ? 'max-h-[88px] max-w-[85%]' : size === 'champion' ? 'max-h-[56px] max-w-[85%]' : 'max-h-[44px] max-w-[85%]'
  const inner = sponsor.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={sponsor.logo_url} alt={sponsor.name} className={`${logoMax} object-contain`} />
  ) : (
    <span className="px-3 text-center text-sm font-semibold text-navy">{sponsor.name}</span>
  )
  const tile = (
    <div className={`${tileHeight} flex items-center justify-center rounded-[14px] border border-navy/10 bg-white px-4 py-3 transition-colors hover:border-navy/30`}>
      {inner}
    </div>
  )
  const taggedUrl = withUtm(sponsor.website_url, { medium: utm.medium, campaign: utm.campaign, content: `sponsor_${size}` })
  return taggedUrl ? (
    <a href={taggedUrl} target="_blank" rel="noopener noreferrer" aria-label={sponsor.name}>
      {tile}
    </a>
  ) : (
    tile
  )
}
