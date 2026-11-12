import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getQualifyingTowns } from '@/lib/towns/queries'
import { getActiveRoams } from '@/lib/roams/queries'
import { getTrails, type TrailSummary } from '@/lib/trails/queries'
import { getTourTrails } from '@/lib/trails/tours'
import { SCHOOLS } from '@/lib/semester/schools'
import { loadEventsListing } from '@/app/events/_lib/load'
import { SITE_URL } from '@/lib/seo'
import { eventUrl } from '@/lib/events-url'
import { VENUES } from '@/lib/venues'

// Served at /llms.txt. Generated (not a static file) so the guide and town
// inventories stay in sync with the database the same way the sitemap does.
// See https://llmstxt.org for the convention.
export const revalidate = 3600

interface GuideLite {
  id: string
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
      .select('id, slug, title, summary')
      .eq('content_type', 'micro_guide')
      .eq('status', 'approved')
      .contains('surfaces', ['guide_library'])
      .not('slug', 'is', null)
      .order('title')
    guides = (data as GuideLite[] | null) ?? []
  } catch {
    // DB unreachable — still serve the rest of the file.
  }

  // The guides in Spanish, Portuguese and Chinese (84 pages, live since
  // 2026-10-17) were in the sitemap with hreflang but missing here. SEO play 8
  // of 2026-11-08.
  let translated: { content_item_id: string; locale: string; title: string; summary: string | null }[] = []
  if (guides.length > 0) {
    try {
      const { data } = await createServerSupabaseClient()
        .from('content_item_translations')
        .select('content_item_id, locale, title, summary')
        .in('content_item_id', guides.map((g) => g.id))
        .order('title')
      translated = (data as typeof translated | null) ?? []
    } catch {
      // Skip the translated sections.
    }
  }

  let towns: { town_name: string; slug: string }[] = []
  try {
    towns = await getQualifyingTowns()
  } catch {
    // DB unreachable — skip the towns section.
  }

  // Roams are the same page class the sitemap lists, from the same source. They
  // were missing here until 2026-09-14, while being the site's best-converting
  // pages — 852 impressions and 57% of its clicks in the week to 2026-09-11.
  let events: Awaited<ReturnType<typeof loadEventsListing>> = []
  try {
    events = await loadEventsListing()
  } catch {
    // DB unreachable — the rest of the file still renders.
  }

  let roams: Awaited<ReturnType<typeof getActiveRoams>> = []
  let trails: TrailSummary[] = []
  try {
    // Roams that tour a whole trail forward to its trail page, listed under Trails.
    const [all, tours] = await Promise.all([getActiveRoams(), getTourTrails()])
    roams = all.filter((r) => !tours.has(r.id))
  } catch {
    // DB unreachable — skip the roams section.
  }
  try {
    trails = await getTrails()
  } catch {
    // DB unreachable — skip the trails section.
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
  L.push(`- [Plan a trip](${SITE_URL}/trip): Compare walking, biking, transit and driving to any Greater Boston address side by side: times, the calmest bike route with its share of protected lanes, transit leaving now, weekly costs, and help for a first try. Get directions opens the route in Google Maps. Link a destination with ?to=<lat>,<lng>&toName=<name>.`)
  L.push(`- [What's near you](${SITE_URL}/nearby): A live snapshot of the T stops, buses, and Bluebikes docks near any Greater Boston address, with bike-lane comfort and nearby destinations.`)
  L.push(`- [Guides](${SITE_URL}/guides): Practical how-to guides for getting around by bike, on foot, and by transit in the Boston area.`)
  L.push(`- [Town pages](${SITE_URL}/shift/towns): Live community stats on how each town walks, bikes, and rides transit.`)
  L.push(`- [What's new with Shift](${SITE_URL}/shift/whats-new): The newest Shift features, newest first, each with its date and where to try it.`)
  L.push(`- [Trails](${SITE_URL}/trails): Bike paths, rail trails and greenways around Boston and across Massachusetts, each with its length, surface, places to get on, parking, transit and current closures.`)
  L.push(`- [Path and bike lane conditions](${SITE_URL}/trails/conditions): After snow, how each trail and protected bike lane is, from people who used it today, and who clears it. Open data: [conditions.json](${SITE_URL}/trails/conditions.json) (GeoJSON, CC BY).`)
  L.push(`- [Roams](${SITE_URL}/shift/roams): Self-guided walking, biking and transit routes around Massachusetts, each with its distance, time, and stops.`)
  L.push('')

  if (guides.length > 0) {
    L.push('## Guides')
    for (const g of guides) {
      const summary = g.summary ? `: ${g.summary}` : ''
      L.push(`- [${g.title}](${SITE_URL}/guides/${g.slug})${summary}`)
    }
    L.push('')
  }

  const slugById = new Map(guides.map((g) => [g.id, g.slug]))
  for (const [locale, heading] of [
    ['es', '## Guías en español'],
    ['pt-BR', '## Guias em português'],
    ['zh-Hans', '## 中文指南'],
  ] as const) {
    const rows = translated.filter((t) => t.locale === locale && slugById.has(t.content_item_id))
    if (rows.length === 0) continue
    L.push(heading)
    for (const t of rows) {
      const summary = t.summary ? `: ${t.summary}` : ''
      L.push(`- [${t.title}](${SITE_URL}/${locale}/guides/${slugById.get(t.content_item_id)})${summary}`)
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

  if (trails.length > 0) {
    L.push('## Trails')
    for (const t of trails) {
      const facts = [
        t.full_miles ? `${Math.round(t.full_miles * 10) / 10} ${Math.round(t.full_miles * 10) / 10 === 1 ? 'mile' : 'miles'}` : null,
        t.from_label && t.to_label ? `${t.from_label} to ${t.to_label}` : t.towns.length > 0 ? t.towns.join(', ') : null,
      ]
        .filter(Boolean)
        .join(', ')
      const detail = [facts, t.summary].filter(Boolean).join(' — ')
      L.push(`- [${t.name}](${SITE_URL}/trails/${t.id})${detail ? `: ${detail}` : ''}`)
    }
    L.push('')
  }

  if (roams.length > 0) {
    L.push('## Routes to walk and ride')
    for (const r of roams) {
      // Lead with the facts someone asking "how long is the Fresh Pond loop"
      // wants, then the hook — same order as the page title and meta description.
      const facts = [
        r.distance_miles != null && r.distance_miles > 0
          ? `${Math.round(r.distance_miles * 10) / 10} miles`
          : null,
        r.estimated_minutes != null && r.estimated_minutes > 0
          ? `about ${r.estimated_minutes} min`
          : null,
        r.region,
      ]
        .filter(Boolean)
        .join(', ')
      const detail = [facts, r.hook].filter(Boolean).join(' — ')
      L.push(
        `- [${r.name}](${SITE_URL}/shift/roams/${encodeURIComponent(r.id)})${detail ? `: ${detail}` : ''}`,
      )
    }
    L.push('')
  }

  // Campus pages. Thirteen URLs are in the sitemap and, until this section
  // existed, none were in llms.txt — a whole page class invisible to the
  // answer engines that read this file. They answer the campus transportation
  // questions students actually search: the MBTA semester pass subsidy, campus
  // bike co-ops and repair stands, Bluebikes student discounts, and late-night
  // shuttles. Static, so no DB call and nothing to fail open on.
  L.push('## Campus pages')
  L.push(`- [Shift Your Semester](${SITE_URL}/shift-your-semester): How students at ${SCHOOLS.length} Greater Boston campuses get around — MBTA pass subsidies, campus bike shops, Bluebikes discounts, and shuttles.`)
  for (const s of SCHOOLS) {
    const summary = s.seoDescription ? `: ${s.seoDescription}` : ''
    L.push(`- [Getting around ${s.name}](${SITE_URL}/shift-your-semester/${s.slug})${summary}`)
  }
  L.push('')

  // Venue parking pages (exp-2026-11-3): where to park for a game or show,
  // with each garage's walk and published price, then the train. The prices
  // are re-checked every Monday, so the date tells an answer engine how fresh
  // the page is.
  L.push('## Parking at big venues')
  for (const v of Object.values(VENUES)) {
    L.push(
      v.airport
        ? `- [Parking at ${v.name}](${SITE_URL}/parking/${v.slug}): ${v.lede} Massport's rates for the Central, Terminal B and Economy garages (checked ${v.checked}), the free Silver Line SL1 from South Station, the Blue Line and Massport shuttle, Logan Express buses with their fares, and Bluebikes by Airport station.`
        : v.noParking
        ? `- [Parking at ${v.name}](${SITE_URL}/parking/${v.slug}): ${v.lede} The City's game-day travel plan with the team: satellite lots, shuttle stops, bike valet, Bluebikes and walks (checked ${v.checked}).${v.notice ? ` ${v.notice.text}` : ''}`
        : `- [Parking at ${v.name}](${SITE_URL}/parking/${v.slug}): ${v.lede} Garages and lots with walk times and published prices (checked ${v.checked}), and how to get there by train.`,
    )
  }
  L.push('')

  // What's on. These pages rank at positions 3.6-7.7 and convert better than
  // anything else on the site, and the file said only that /events exists. An
  // answer engine asked "is there a learn-to-ride class in Cambridge this
  // month" can now answer from the list rather than from the hub. Upcoming
  // events only, soonest first, so the section empties itself as they pass.
  if (events.length > 0) {
    L.push('## What is on')
    for (const e of events.slice(0, 60)) {
      const when = [e.event_date, e.event_time].filter(Boolean).join(' ')
      const detail = [when, e.location_name].filter(Boolean).join(' — ')
      L.push(
        `- [${e.title}](${eventUrl(e, SITE_URL)})${detail ? `: ${detail}` : ''}`,
      )
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
  L.push(`- [Group bike rides in Boston](${SITE_URL}/events/group-rides): Upcoming group rides anyone can join, with pace, no-drop and where each starts.`)
  L.push(`- [Walking groups near Boston](${SITE_URL}/events/walking-groups): Weekly walking groups, nature walks and walking tours, with meeting points and hosts.`)
  L.push(`- [Free bike repair near Boston](${SITE_URL}/events/bike-repair): Open shops and repair workshops where you fix your bike with tools and help on hand.`)
  L.push(`- [This weekend around Boston](${SITE_URL}/events/this-weekend): Group walks, bike rides and community events this Saturday and Sunday.`)
  L.push(`- [Contact](${SITE_URL}/contact) · info@gogreenstreets.org`)
  L.push('')

  return new Response(L.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
