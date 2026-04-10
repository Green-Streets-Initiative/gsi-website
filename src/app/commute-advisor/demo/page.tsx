'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import EmployerCommuteAdvisor from '@/components/commute/EmployerCommuteAdvisor'
import type { EmployerGroup } from '@/lib/types/commute'

function DemoContent() {
  const searchParams = useSearchParams()

  const demoGroup: EmployerGroup = {
    id: 'demo',
    name: searchParams.get('company') ?? 'Your Company',
    slug: 'demo',
    logo_url: searchParams.get('logo') ?? null,
    tier: 'premium', // always show full premium features in demo
    employer_benefits: {
      destination_address: searchParams.get('address') ?? null,
      destination_lat: parseFloat(searchParams.get('lat') ?? '0') || null,
      destination_lng: parseFloat(searchParams.get('lng') ?? '0') || null,
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

export default function DemoPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#191A2E]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#BAF14D]" />
    </div>}>
      <DemoContent />
    </Suspense>
  )
}
