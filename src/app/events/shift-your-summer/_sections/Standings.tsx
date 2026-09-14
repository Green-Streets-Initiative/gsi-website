import RefreshButton from '@/components/RefreshButton'
import LeaderboardTabs from '../LeaderboardTabs'
import type { EventPageData } from '../_lib/load'
import { JoinCta } from './Hero'
import { Section, SectionHeading } from './Section'

type Props = Pick<
  EventPageData,
  'standings' | 'geoStandings' | 'corpStandings' | 'schoolStandings' | 'participantCount' | 'totalActiveTrips'
>

export function LiveStandings(d: Props) {
  const leader = d.standings[0]
  const joined = `${d.participantCount.toLocaleString()} ${d.participantCount === 1 ? 'person has' : 'people have'} joined`

  if (d.totalActiveTrips === 0) {
    return (
      <Section shape="straight" tone="white" width="read">
        <SectionHeading title={joined} lede="The first trips are being logged. Check back soon to see the board come alive." />
        <JoinCta state="active" />
      </Section>
    )
  }

  return (
    <Section shape="straight" tone="white" width="read">
      <SectionHeading
        title="Live standings"
        lede={
          <>
            {joined}. Updated every minute.
            {leader && leader.pct_non_car > 0 && (
              <>
                {' '}Leading right now: <span className="font-semibold text-navy">{leader.display_name || 'Shift user'}</span>,{' '}
                {Math.round(leader.pct_non_car)}% shift rate.
              </>
            )}
          </>
        }
        aside={<RefreshButton />}
      />
      <LeaderboardTabs
        geoStandings={d.geoStandings}
        corpStandings={d.corpStandings}
        schoolStandings={d.schoolStandings}
        individualStandings={d.standings}
        participantCount={d.participantCount}
      />
    </Section>
  )
}

export function FinalStandings(d: Props) {
  return (
    <Section shape="straight" tone="white" width="read">
      <SectionHeading title="Final standings" lede={`${d.participantCount.toLocaleString()} people joined the campaign.`} />
      <LeaderboardTabs
        geoStandings={d.geoStandings}
        corpStandings={d.corpStandings}
        schoolStandings={d.schoolStandings}
        individualStandings={d.standings}
        participantCount={d.participantCount}
        initialRowLimit={5}
      />
    </Section>
  )
}
