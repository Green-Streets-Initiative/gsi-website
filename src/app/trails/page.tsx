import type { Metadata } from 'next'
import Link from 'next/link'
import { Snowflake } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import TrailIndex, { type Region } from '@/components/trails/TrailIndex'
import { getTrails, type TrailSummary } from '@/lib/trails/queries'
import { getNetworkLines } from '@/lib/trails/geometry'
import JsonLd from '@/components/JsonLd'
import { cache } from 'react'

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'

// /trails owns the general trail searches ("bike paths boston", "rail trails
// massachusetts"); the roams hub is titled for self-guided routes (Keith 2026-11-04).
const SEARCH_TITLE = 'Bike paths and rail trails in Boston and Massachusetts'

const trailsOnce = cache(getTrails)

export async function generateMetadata(): Promise<Metadata> {
  const trails = await trailsOnce()
  const description = `${trails.length} bike paths, rail trails and greenways around Boston and across Massachusetts, each with a map, places to get on, parking, transit and closures.`
  return {
    title: SEARCH_TITLE,
    description,
    alternates: { canonical: `${SITE_URL}/trails` },
    openGraph: { title: SEARCH_TITLE, description, url: `${SITE_URL}/trails`, siteName: 'Green Streets Initiative', type: 'website' },
  }
}

/** Areas by where each trail sits: Greater Boston first, where most people are. */
function regionOf(lat: number, lng: number): string {
  if (lng < -71.4) return 'central-west'
  if (lat < 42.2) return 'south'
  // The coast from Salem and Marblehead up to Newburyport. The Northern Strand
  // (Everett to Lynn) averages just west of this line, so it stays in Greater Boston.
  if (lat > 42.42 && lng > -71.0) return 'north-shore'
  return 'boston'
}

const REGION_LABELS: Record<string, string> = {
  boston: 'Greater Boston',
  'north-shore': 'North Shore',
  'central-west': 'Central and West',
  south: 'South and the Cape',
}

export default async function TrailsPage() {
  const [trails, network] = await Promise.all([trailsOnce(), getNetworkLines()])
  const shown = new Set(trails.map((t) => t.id))
  const lines = network.filter((n) => shown.has(n.id) && n.lines.length > 0)

  // A trail's area comes from the average of its access points (a long trail's
  // line midpoint can sit at one end: the Mass Central's is in Waltham).
  const groups = new Map<string, TrailSummary[]>()
  for (const t of trails) {
    const key = t.center ? regionOf(t.center[0], t.center[1]) : 'boston'
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const regions: Region[] = ['boston', 'north-shore', 'central-west', 'south']
    .filter((k) => (groups.get(k)?.length ?? 0) > 0)
    .map((k) => ({ id: k, label: REGION_LABELS[k], trails: groups.get(k)! }))

  const closedCount = trails.filter((t) => t.closed).length

  // The trails as a list search engines can read, in the order the page shows them.
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: SEARCH_TITLE,
    numberOfItems: trails.length,
    itemListElement: regions.flatMap((r) => r.trails).map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      url: `${SITE_URL}/trails/${t.id}`,
    })),
  }

  return (
    <>
      <JsonLd data={itemList} />
      <Nav variant="light" />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-20 pt-6 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[1120px]">
            <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">Bike paths and rail trails</h1>
            <p className="mt-2.5 max-w-[62ch] text-[1.0625rem] leading-[1.55] text-ink-soft">
              {trails.length} rail trails, river paths and greenways, each with where to get on and how to get there.
              {closedCount > 0 ? ` ${closedCount === 1 ? 'One is' : `${closedCount} are`} partly closed today.` : ''}
            </p>
            <p className="mt-2 text-[0.9375rem]">
              <Link href="/trails/conditions" className="inline-flex items-center gap-1.5 font-semibold text-forest underline-offset-4 hover:underline">
                <Snowflake size={14} aria-hidden /> Path and bike lane conditions after snow
              </Link>
            </p>
            <div className="mt-6">
              <TrailIndex regions={regions} network={lines} />
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
