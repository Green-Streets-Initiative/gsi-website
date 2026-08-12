import EmployerCommuteAdvisor from '@/components/commute/EmployerCommuteAdvisor'
import type { EmployerGroup } from '@/lib/types/commute'

// Server component on purpose: reading `searchParams` via props makes the
// route dynamic, so the demo group is rendered into the initial HTML — the
// same proven pattern as the [slug] employer pages. The previous client-page
// version (useSearchParams inside Suspense) left Next 16's dev server stuck
// on the Suspense fallback forever, rendering a blank page.
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  const demoGroup: EmployerGroup = {
    id: 'demo',
    name: str(params.company) ?? 'Your Company',
    slug: 'demo',
    logo_url: str(params.logo) ?? null,
    tier: 'premium', // always show full premium features in demo
    employer_benefits: {
      destination_address: str(params.address) ?? null,
      destination_lat: parseFloat(str(params.lat) ?? '0') || null,
      destination_lng: parseFloat(str(params.lng) ?? '0') || null,
      transit_subsidy_monthly: 45,
      transit_subsidy_type: 'pre_tax',
      transit_subsidy_label: 'Pre-tax transit benefit',
      bluebikes_subsidized: true,
      bluebikes_subsidy_type: 'full',
      bluebikes_subsidy_label: 'Free Bluebikes annual membership',
      bike_parking: true,
      bike_parking_details: 'Secure bike storage on-site',
      showers: true,
      shower_details: 'Locker rooms with showers available',
    },
  }

  return <EmployerCommuteAdvisor group={demoGroup} isDemo />
}
