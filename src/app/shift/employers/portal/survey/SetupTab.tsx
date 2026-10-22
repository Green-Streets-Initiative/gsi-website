'use client'

import { useState } from 'react'
import LivePagePreview from '@/components/employer/LivePagePreview'
import type { EmployerLocation } from '../_lib/use-employer-locations'
import { locationTitle } from '../_lib/use-employer-locations'
import SurveyWizard, { ReviewRow, surveyReviewRows, type WizardStep } from './SurveyWizard'
import { ruleSetsOf, type SurveyRow } from './survey-types'

/**
 * Setup tab: how this survey is set up, as review rows with Change, and
 * the survey as staff see it. Change opens the wizard in place on that step.
 */
export default function SetupTab({
  survey,
  groupId,
  groupName,
  locations,
  canManage,
  onChanged,
}: {
  survey: SurveyRow
  groupId: string
  groupName: string
  locations: EmployerLocation[]
  canManage: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<WizardStep | null>(null)
  const sites = locations.map((l) => ({ id: l.id, name: locationTitle(l) }))
  const rows = surveyReviewRows({
    filings: ruleSetsOf(survey),
    weekStart: survey.week_start,
    closesOn: survey.closes_on,
    title: survey.title,
    sites,
    siteHeadcounts: survey.site_headcounts ?? {},
    headcount: survey.headcount,
    departments: survey.departments ?? [],
  })
  const canEdit = canManage && survey.status !== 'closed'

  if (editing) {
    return (
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <SurveyWizard
          groupId={groupId}
          groupName={groupName}
          locations={locations}
          existing={survey}
          initialStep={editing}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-[18px]">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">How this survey is set up</h3>
          <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-muted">
            {survey.status === 'closed'
              ? 'This survey is closed, so its setup is fixed.'
              : survey.status === 'open'
                ? 'Headcounts and departments can still change. The week stays fixed once answers are in.'
                : 'Change anything until the survey opens.'}
          </p>
        </div>
      </div>
      <div className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <dl className="divide-y divide-line-2 rounded-[12px] border border-line">
          {rows.map((r) => (
            <ReviewRow key={r.term} term={r.term} value={r.value} onChange={canEdit ? () => setEditing(r.step) : undefined} />
          ))}
        </dl>
        <div>
          <div className="mb-2 text-[14px] font-semibold text-ink-muted">What staff see</div>
          <LivePagePreview
            src={`/survey/${survey.open_token}?preview=1`}
            title="The survey as staff see it"
            pageWidth={390}
            pageHeight={844}
            fallback={<p className="p-4 text-[14px] text-ink-muted">Preview unavailable. Open the page to see it.</p>}
          />
        </div>
      </div>
    </div>
  )
}
