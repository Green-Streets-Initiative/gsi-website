import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import TrailIndex, { type Region } from '@/components/trails/TrailIndex'
import { getTrails, type TrailSummary } from '@/lib/trails/queries'
import { getNetworkLines } from '@/lib/trails/geometry'

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'

export const metadata: Metadata = {
  title: 'Trails and paths in Massachusetts: where to get on, how long, what is closed',
  description:
    'Rail trails, river paths and greenways across Massachusetts, with where to get on, parking, transit, bike share and current closures for each.',
  alternates: { canonical: `${SITE_URL}/trails` },
  // Staged until the roam page title test ends (2026-10-26).
  robots: { index: false, follow: false },
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
  const [trails, network] = await Promise.all([getTrails(), getNetworkLines()])
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

  return (
    <>
      <Nav variant="light" />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-20 pt-6 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[1120px]">
            <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">Trails and paths</h1>
            <p className="mt-2.5 max-w-[62ch] text-[1.0625rem] leading-[1.55] text-ink-soft">
              {trails.length} rail trails, river paths and greenways, each with where to get on and how to get there.
              {closedCount > 0 ? ` ${closedCount === 1 ? 'One is' : `${closedCount} are`} partly closed today.` : ''}
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
