import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getQualifyingTowns } from '@/lib/towns/queries'
import { SITE_URL } from '@/lib/seo'

// Served at /llms.txt. Generated (not a static file) so the guide and town
// inventories stay in sync with the database the same way the sitemap does.
// See https://llmstxt.org for the convention.
export const revalidate = 3600

interface GuideLite {
  slug: string
  title: string
  summary: string | null
}

export async function GET() {
  let guides: GuideLite[] = []
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from('content_items')
      .select('slug, title, summary')
      .eq('content_type', 'micro_guide')
      .eq('status', 'approved')
      .contains('surfaces', ['guide_library'])
      .not('slug', 'is', null)
      .order('title')
    guides = (data as GuideLite[] | null) ?? []
  } catch {
    // DB unreachable — still serve the rest of the file.
  }

  let towns: { town_name: string; slug: string }[] = []
  try {
    towns = await getQualifyingTowns()
  } catch {
    // DB unreachable — skip the towns section.
  }

  const L: string[] = []
  L.push('# Green Streets Initiative')
  L.push('')
  L.push(
    '> Green Streets Initiative (GSI) is a Boston-area 501(c)(3) nonprofit that helps people walk, bike, and ride transit more often — and measures the impact, trip by trip, community by community. Our free Shift app turns everyday active trips into local rewards, status, and friendly competition, and our tools help people find the best way to get around Greater Boston.',
  )
  L.push('')
  L.push('## Start here')
  L.push(`- [Shift app](${SITE_URL}/shift): Free app that logs walking, biking, and transit trips and rewards active transportation with local perks and competitions.`)
  L.push(`- [Commute Advisor](${SITE_URL}/commute-advisor): See how many minutes a drive would take walking, biking, or on transit — and what each option costs per day and per year.`)
  L.push(`- [What's near you](${SITE_URL}/nearby): A live snapshot of the T stops, buses, and Bluebikes docks near any Greater Boston address, with bike-lane comfort and nearby destinations.`)
  L.push(`- [Guides](${SITE_URL}/guides): Practical how-to guides for getting around by bike, on foot, and by transit in the Boston area.`)
  L.push(`- [Town pages](${SITE_URL}/shift/towns): Live community stats on how each town walks, bikes, and rides transit.`)
  L.push('')

  if (guides.length > 0) {
    L.push('## Guides')
    for (const g of guides) {
      const summary = g.summary ? `: ${g.summary}` : ''
      L.push(`- [${g.title}](${SITE_URL}/guides/${g.slug})${summary}`)
    }
    L.push('')
  }

  if (towns.length > 0) {
    L.push('## Town pages')
    for (const t of towns) {
      L.push(`- [Walking, biking & transit in ${t.town_name}](${SITE_URL}/shift/towns/${t.slug})`)
    }
    L.push('')
  }

  L.push('## For organizations')
  L.push(`- [For employers](${SITE_URL}/shift/employers): Commute programs, workplace challenges, and aggregate impact reporting for HR and sustainability teams.`)
  L.push(`- [For schools](${SITE_URL}/shift/schools): A no-app, no-student-data school wellness program for Massachusetts schools.`)
  L.push(`- [Rewards Partners](${SITE_URL}/shift/rewards-partners): Free program for local businesses to reach people who walk, bike, and ride transit nearby.`)
  L.push('')
  L.push('## About')
  L.push(`- [About Green Streets Initiative](${SITE_URL}/about)`)
  L.push(`- [Programs](${SITE_URL}/programs): Walk/Ride Days, the Corporate Challenge, and the What Moves Us community program.`)
  L.push(`- [Community events](${SITE_URL}/events): Group rides, walking tours, e-bike demos, and transit meetups across Greater Boston.`)
  L.push(`- [Contact](${SITE_URL}/contact) · info@gogreenstreets.org`)
  L.push('')

  return new Response(L.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
