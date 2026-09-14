import SponsorLogos from '@/components/SponsorLogos'
import type { Sponsorship } from '@/lib/sponsors/roll'
import { Section, SectionHeading } from './Section'

export function SponsorSection({ sponsors, eventCampaign }: { sponsors: Sponsorship[]; eventCampaign: string }) {
  if (!sponsors.some((s) => s.sponsors)) return null
  return (
    <Section shape="wanderLeft">
      <SectionHeading title="Partners and sponsors" lede="Every prize was donated. These organizations made the challenge possible." />
      <SponsorLogos sponsorships={sponsors} utm={{ medium: 'event_page', campaign: eventCampaign }} />
    </Section>
  )
}
