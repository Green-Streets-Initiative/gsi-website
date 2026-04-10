'use client'

import type { EmployerBenefits as Benefits } from '@/lib/types/commute'

interface EmployerBenefitsProps {
  companyName: string
  benefits: Benefits
}

export default function EmployerBenefits({ companyName, benefits }: EmployerBenefitsProps) {
  const items: string[] = []

  if (benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0) {
    items.push(benefits.transit_subsidy_label || `$${benefits.transit_subsidy_monthly}/month transit benefit`)
  }
  if (benefits.bluebikes_subsidized) {
    items.push(benefits.bluebikes_subsidy_label || 'Subsidized Bluebikes membership')
  }
  if (benefits.bike_parking) {
    items.push(benefits.bike_parking_details ? `Bike parking: ${benefits.bike_parking_details}` : 'Bike parking available')
  }
  if (benefits.showers) {
    items.push(benefits.shower_details ? `Showers: ${benefits.shower_details}` : 'Showers available')
  }
  if (benefits.shuttle_routes && benefits.shuttle_routes.length > 0) {
    for (const route of benefits.shuttle_routes) {
      items.push(`Free shuttle: ${route.name} from ${route.from_stop}`)
    }
  }
  if (benefits.other_benefits) {
    items.push(benefits.other_benefits)
  }

  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
        Your {companyName} benefits
      </div>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[0.9375rem] text-white">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#BAF14D]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
