import type { Metadata } from 'next'
import EventPage from './EventPage'
import { formatDateRange, loadCompetition, loadEventPage, stateOf } from './_lib/load'
import { campaigns } from '@/content/sponsor-reports'
import { highlightsFor } from './_sections/Impact'

// Live leaderboard, but the standings queries are expensive: serve a cached
// page and regenerate it at most once a minute. Visitors always load
// instantly; the data is never more than ~60s old.
export const revalidate = 60

const SUFFIX = ' | Green Streets Initiative'

/**
 * The title and description follow the page's state. The old title said
 * "Live Leaderboard" year-round, including for a challenge that ended in
 * August; search results should say what the page actually holds.
 */
export async function generateMetadata(): Promise<Metadata> {
  const nowMs = Date.now()
  const competition = await loadCompetition(nowMs)
  const state = stateOf(competition, nowMs)

  if (!competition || state === 'coming-soon') {
    return {
      title: 'Shift Your Summer: Massachusetts’s Statewide Walk, Bike, and Transit Challenge' + SUFFIX,
      description:
        'Shift Your Summer is Green Streets Initiative’s statewide challenge: walk, bike, and ride transit across Massachusetts, earn prize entries with every trip, and see your town on the board.',
    }
  }

  const name = competition.name
  const range = formatDateRange(competition.starts_at, competition.ends_at)
  const startDay = new Date(competition.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' })

  if (state === 'upcoming') {
    return {
      title: `${name} Starts ${startDay}: Massachusetts’s Walk, Bike, and Transit Challenge` + SUFFIX,
      description: `${name} runs ${range}. Walk, bike, or ride transit anywhere in Massachusetts and every active trip earns a prize entry. Get Shift and join before day one.`,
    }
  }
  if (state === 'active') {
    return {
      title: `${name} Live Standings: Towns, Workplaces, and Individuals` + SUFFIX,
      description: `Live standings for ${name}, ${range}. See which Massachusetts towns and workplaces are shifting the most trips to walking, biking, and transit, updated every minute.`,
    }
  }

  const report = campaigns.find((c) => c.competitionId === competition.id) ?? null
  const h = highlightsFor(report)
  if (h) {
    return {
      title: `${name} Results: ${h[0].value} Active Trips Across Massachusetts` + SUFFIX,
      description: `What ${name} added up to, ${range}: ${h[0].value} walking, biking, and transit trips, ${h[1].value} miles, ${h[2].value} metric tons of CO₂ avoided, and ${h[5].value} prizes awarded.`,
    }
  }
  return {
    title: `${name} Results` + SUFFIX,
    description: `Final standings and prize winners for ${name}, ${range}: Massachusetts’s statewide walk, bike, and transit challenge.`,
  }
}

export default async function ShiftYourSummerPage() {
  const data = await loadEventPage()
  return <EventPage {...data} />
}
