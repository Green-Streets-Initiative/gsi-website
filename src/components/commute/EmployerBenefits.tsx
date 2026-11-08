'use client'

import { bikeShareBenefitLine } from '@/lib/employer/bike-share'
import type { EmployerBenefits as Benefits } from '@/lib/types/commute'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

interface EmployerBenefitsProps {
  companyName: string
  benefits: Benefits
  locale?: SiteLocale
}

/** The employer's own words (labels, details, shuttle names) stay as written; only our framing is translated. */
export default function EmployerBenefits({ companyName, benefits, locale = 'en' }: EmployerBenefitsProps) {
  const t = translator(advisorStrings, locale)
  const items: string[] = []

  if (benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0) {
    items.push(benefits.transit_subsidy_label || t('emp.benefit_transit', { amount: benefits.transit_subsidy_monthly }))
  }
  if (benefits.bikeshare_subsidized) {
    items.push(locale === 'en' || benefits.bikeshare_subsidy_label?.trim()
      ? bikeShareBenefitLine(benefits, companyName)
      : t(benefits.bikeshare_subsidy_type === 'partial' ? 'drawer.bikeshare_partial' : 'drawer.bikeshare_full', {
          company: companyName,
          system: benefits.bikeshare_system?.trim() || t('drawer.bikeshare_generic'),
        }))
  }
  if (benefits.bike_parking) {
    items.push(benefits.bike_parking_details ? t('emp.benefit_bike_parking_details', { details: benefits.bike_parking_details }) : t('emp.benefit_bike_parking'))
  }
  if (benefits.showers) {
    items.push(benefits.shower_details ? t('emp.benefit_showers_details', { details: benefits.shower_details }) : t('emp.benefit_showers'))
  }
  if (benefits.shuttle_routes && benefits.shuttle_routes.length > 0) {
    for (const route of benefits.shuttle_routes) {
      items.push(t('emp.benefit_shuttle', { name: route.name, from: route.from_stop }))
    }
  }
  if (benefits.other_benefits && benefits.other_benefits.trim()) {
    items.push(t('emp.benefit_other', { company: companyName, text: benefits.other_benefits.trim() }))
  }

  if (items.length === 0) return null

  return (
    <div className="rounded-[14px] border border-[rgba(25,26,46,0.06)] bg-[#FAFBF8] p-6">
      <div className="mb-3 text-[0.8125rem] font-bold uppercase tracking-[0.14em] text-[#5A5C6E]">
        {t('emp.benefits_title', { company: companyName })}
      </div>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[0.9375rem] text-[#191A2E]">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
