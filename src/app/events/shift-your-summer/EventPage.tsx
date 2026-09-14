import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { slugify } from '@/lib/utm'
import CampaignDataViz from './CampaignDataViz'
import type { EventPageData } from './_lib/load'
import { Closing } from './_sections/Closing'
import { ComingSoonHero, EventHero } from './_sections/Hero'
import { HowToJoin } from './_sections/HowToJoin'
import { ImpactSection, highlightsFor } from './_sections/Impact'
import { PrizeSection } from './_sections/Prizes'
import { Section, SectionHeading } from './_sections/Section'
import { SponsorSection } from './_sections/Sponsors'
import { FinalStandings, LiveStandings } from './_sections/Standings'
import { WinnersSection } from './_sections/Winners'

/*
 * The Shift Your Summer page body for all four states. Rendered by the
 * production route and by /preview/shift-your-summer/<state>, so what Keith
 * reviews is exactly what ships.
 */

// The 2026 wrap has a written story; a future year falls back to the
// competition's own description until its report is written.
const WRAP_LEDE: Record<string, string> = {
  'shift-your-summer-2026':
    'Shift Your Summer 2026 challenged people across Massachusetts to walk, bike, and ride transit from June 15 through August 15. Every active trip earned a sweepstakes entry, towns and workplaces competed on the board, and more than $5,000 in prizes from 17 brands went home with participants.',
}

export default function EventPage(d: EventPageData) {
  const { state, competition } = d
  const campaignSlug = competition ? slugify(competition.name) : 'shift-your-summer'

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream">
        {state === 'coming-soon' || !competition ? (
          <>
            <ComingSoonHero />
            <Section shape="wanderRight" tone="white" width="read">
              <SectionHeading title="What a flagship challenge is" />
              <p className="max-w-[620px] text-[1.0625rem] leading-[1.65] text-ink-soft">
                A multi-month, statewide challenge where people across Massachusetts shift everyday trips to walking, biking, and transit. Local sponsors put up real prizes, awarded in drawings throughout the challenge, and every active trip is an entry.
              </p>
            </Section>
            <HowToJoin />
            <Closing state="coming-soon" />
          </>
        ) : state === 'upcoming' ? (
          <>
            <EventHero competition={competition} state="upcoming" lede={competition.description} fakeNow={d.fakeNow} />
            <PrizeSection prizes={d.prizes} eventCampaign={campaignSlug} aggregateLabel={d.aggregateLabel} />
            <SponsorSection sponsors={d.sponsors} eventCampaign={campaignSlug} />
            <HowToJoin />
            <Closing state="upcoming" />
          </>
        ) : state === 'active' ? (
          <>
            <EventHero competition={competition} state="active" lede={competition.description} />
            <LiveStandings {...d} />
            <PrizeSection prizes={d.prizes} eventCampaign={campaignSlug} aggregateLabel={d.aggregateLabel} />
            <SponsorSection sponsors={d.sponsors} eventCampaign={campaignSlug} />
            <HowToJoin />
            <Closing state="active" />
          </>
        ) : (
          <>
            <EventHero
              competition={competition}
              state="ended"
              lede={(d.report && WRAP_LEDE[d.report.slug]) ?? competition.description}
            />
            <ImpactSection report={d.report} />
            {highlightsFor(d.report) && <CampaignDataViz />}
            <WinnersSection winners={d.claimedWinners} eventCampaign={campaignSlug} />
            <FinalStandings {...d} />
            <SponsorSection sponsors={d.sponsors} eventCampaign={campaignSlug} />
            <Closing state="ended" />
          </>
        )}
      </main>
      <Footer variant="light" />
    </>
  )
}
