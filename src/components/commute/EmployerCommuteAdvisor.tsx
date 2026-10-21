'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import AdvisorFlow, { PLAN_STEP, type AdvisorLocation } from '@/components/commute/AdvisorFlow'
import EmployerBenefits from '@/components/commute/EmployerBenefits'
import type { AdvisorDraftPayload } from '@/app/shift/employers/portal/advisor/advisor-draft'
import type { EmployerGroup } from '@/lib/types/commute'

interface Props {
  group: EmployerGroup
  isDemo?: boolean
  /** From ?location=<id>: a per-location link opens at that location. */
  initialLocationId?: string | null
  /** Each office's usual start ("HH:MM"), when the column exists. */
  startTimes?: Record<string, string>
  /** Portal preview of unsaved benefits and offices (?draft=). Nothing is logged. */
  draft?: AdvisorDraftPayload | null
}

/**
 * The employer's branded Commute Advisor: the shared flow (AdvisorFlow)
 * with the company's header, its benefits on step 1 and the HR contact
 * line under the plan. The plan's "Keep this plan" card carries the
 * join-on-Shift link and the team code.
 */
export default function EmployerCommuteAdvisor({ group, isDemo, initialLocationId, startTimes = {}, draft = null }: Props) {
  const benefits = draft?.benefits ?? group.employer_benefits
  const locations = useMemo<AdvisorLocation[]>(() => {
    if (draft) {
      return draft.locations.map((l, i) => ({
        id: l.id ?? `draft-${i}`,
        name: l.name,
        address: l.address,
        lat: l.lat,
        lng: l.lng,
        typical_start_time: l.typical_start_time,
      }))
    }
    return (group.locations ?? []).map((l) => ({ ...l, typical_start_time: startTimes[l.id] ?? null }))
  }, [draft, group.locations, startTimes])
  const trackProps = useMemo(() => ({ employer_slug: group.slug, is_demo: !!isDemo, is_draft: !!draft }), [group.slug, isDemo, draft])
  // On the plan (step 3) the co-branded header shrinks to one line so the
  // headline, the grid and the map sit above the fold (Keith 2026-10-15).
  const [step, setStep] = useState(1)
  const onPlan = step === PLAN_STEP
  const logo = group.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={group.logo_url} alt={group.name} className={`${onPlan ? 'h-8' : 'mx-auto h-12'} w-auto object-contain`} />
  ) : (
    <div className={`${onPlan ? 'text-[1.05rem]' : 'text-[1.5rem]'} font-bold text-[#191A2E]`}>{group.name}</div>
  )

  const afterPlan = benefits.hr_contact_name && benefits.hr_contact_email ? (
    <div className="text-center text-[0.9375rem] text-[#5A5C6E]">
      Questions about your commute benefits? Contact {benefits.hr_contact_name} at{' '}
      <a href={`mailto:${benefits.hr_contact_email}`} className="text-[#2D6A4F] underline">{benefits.hr_contact_email}</a>
    </div>
  ) : null

  return (
    <div className="advisor-root">
      <Nav />
      <main className="bg-[#F4F6F1]" style={{ paddingTop: '60px' }}>
        {draft && (
          <div className="bg-[#8A5A00] px-6 py-2.5 text-center text-[0.9375rem] font-semibold text-white">
            Preview of unsaved changes. Nothing here is published.
          </div>
        )}
        {isDemo && (
          <div className="bg-[#2D6A4F] px-6 py-2.5 text-center">
            <span className="text-[0.9375rem] font-semibold text-white">This is a personalized preview for {group.name}</span>
            <span className="mx-2 text-white/75">·</span>
            <Link href="/contact?inquiry=employer" className="text-[0.9375rem] font-semibold text-white underline">Contact us to get started</Link>
          </div>
        )}

        {/* Co-branded header: full on the way in, one line on the plan */}
        {onPlan ? (
          <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 pt-4 sm:px-8">
            {logo}
            <span className="text-[0.9375rem] text-[#5A5C6E]">
              Commute Advisor · powered by <span className="font-semibold text-[#2D6A4F]">Green Streets</span> Initiative
            </span>
            <h1 className="sr-only">Find your best commute</h1>
          </div>
        ) : (
          <div className="mx-auto max-w-[640px] px-4 pb-4 pt-7 text-center sm:px-8">
            <div className="mb-3">
              {logo}
              <div className="mt-1.5 text-[0.875rem] tracking-[0.3px] text-[#5A5C6E]">
                powered by <span className="font-semibold text-[#2D6A4F]">Green Streets</span> Initiative
              </div>
            </div>
            <h1 className="mb-1.5 text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold leading-[1.15] tracking-tighter text-[#191A2E]">
              Find your <em className="not-italic text-[#2D6A4F]">best commute</em>
            </h1>
            <p className="text-[0.9375rem] text-[#5A5C6E]">Commute Advisor for {group.name} staff</p>
          </div>
        )}

        <AdvisorFlow
          variant="employer"
          group={group}
          benefits={benefits}
          locations={locations}
          initialLocationId={initialLocationId}
          isDemo={isDemo}
          isDraft={!!draft}
          persistSession={!draft}
          trackProps={trackProps}
          companyName={group.name}
          step1Extra={!isDemo ? <EmployerBenefits companyName={group.name} benefits={benefits} /> : null}
          afterPlan={afterPlan}
          onStepChange={setStep}
        />

        <div className="h-16" />
      </main>
      <Footer />
    </div>
  )
}
