'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import { useEmployerLocations, locationTitle } from '../_lib/use-employer-locations'
import PortalPageHead from '../_components/PortalPageHead'
import { Card, CardBody } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { RULE_SET_LABEL, longDate, weekLabel } from '@/lib/employer/survey-instrument'
import SurveyEditor from './SurveyEditor'
import StaffListCard from './StaffListCard'
import ResponseRateCard from './ResponseRateCard'
import ExportsCard from './ExportsCard'
import { REASONS, SURVEY_PATH, type SurveyRow, type SurveyStatus } from './survey-types'

const STATUS_WORDS: Record<SurveyRow['status'], { text: string; tone: 'success' | 'warn' | 'info' | 'neutral' }> = {
  draft: { text: 'Draft', tone: 'neutral' },
  open: { text: 'Open', tone: 'success' },
  closed: { text: 'Closed', tone: 'info' },
}

/**
 * Survey week (Shift 01170): one commute survey per season for the rules
 * that require one (MassDEP, Cambridge, Boston) or for the company's own
 * emissions number. The admin sets the week and headcounts, uploads the
 * staff list, sends personal links, watches the response rate, and takes
 * the summary at close. Only totals and a responded / not-yet list are
 * ever shown.
 */
export default function SurveyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const { group, loading, canInviteEmployees } = usePortal()
  const canManage = canInviteEmployees
  const { locations } = useEmployerLocations(group?.id)
  const sites = useMemo(() => locations.map((l) => ({ id: l.id, name: locationTitle(l) })), [locations])

  const [surveys, setSurveys] = useState<SurveyRow[] | null>(null)
  const [status, setStatus] = useState<SurveyStatus | null>(null)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)

  const wanted = searchParams.get('survey')
  const selected = useMemo(() => {
    if (!surveys || surveys.length === 0) return null
    return surveys.find((s) => s.id === wanted) ?? surveys.find((s) => s.status === 'open') ?? surveys.find((s) => s.status === 'draft') ?? surveys[0]
  }, [surveys, wanted])

  const loadSurveys = useCallback(async () => {
    if (!group) return
    const { data } = await supabase
      .from('employer_surveys')
      .select('id, group_id, title, rule_set, week_start, closes_on, status, headcount, site_headcounts, departments, open_token, created_at, opened_at, closed_at')
      .eq('group_id', group.id)
      .order('week_start', { ascending: false })
      .limit(50)
    setSurveys((data ?? []) as SurveyRow[])
  }, [group])

  const loadStatus = useCallback(async (id: string) => {
    const { data } = await supabase.rpc('get_employer_survey_status', { p_survey_id: id })
    const res = (data ?? null) as SurveyStatus | { ok: false } | null
    setStatus(res && res.ok ? res : null)
  }, [])

  useEffect(() => {
    void loadSurveys()
  }, [loadSurveys])

  useEffect(() => {
    if (selected) void loadStatus(selected.id)
    else setStatus(null)
  }, [selected, loadStatus])

  const refresh = useCallback(() => {
    void loadSurveys()
    if (selected) void loadStatus(selected.id)
  }, [loadSurveys, loadStatus, selected])

  async function setSurveyStatus(id: string, next: 'open' | 'closed' | 'draft') {
    const words = next === 'open' ? 'Open the survey?' : next === 'closed' ? 'Close the survey?' : 'Back to draft?'
    const body =
      next === 'open'
        ? 'Links can be sent and answers accepted. The week and headcounts can still be edited.'
        : next === 'closed'
          ? 'No more answers are accepted and no reminders go out. You can reopen it if needed.'
          : 'Only possible while nobody has been emailed or has answered.'
    const ok = await confirm({ title: words, body, confirmLabel: next === 'open' ? 'Open' : next === 'closed' ? 'Close' : 'Back to draft' })
    if (!ok) return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('set_employer_survey_status', { p_id: id, p_status: next })
      const res = (data ?? null) as { ok?: boolean; reason?: string } | null
      if (error || !res?.ok) {
        toast(REASONS[res?.reason ?? ''] ?? "We couldn't change that. Please try again.", { type: 'error' })
        return
      }
      toast(next === 'open' ? 'Survey open' : next === 'closed' ? 'Survey closed' : 'Back to draft', { type: 'success' })
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function deleteSurvey(id: string) {
    const ok = await confirm({ title: 'Delete this survey?', body: 'The staff list goes with it. Only possible before anyone has answered.', confirmLabel: 'Delete', tone: 'danger' })
    if (!ok) return
    const { data, error } = await supabase.rpc('delete_employer_survey', { p_id: id })
    const res = (data ?? null) as { ok?: boolean; reason?: string } | null
    if (error || !res?.ok) {
      toast(REASONS[res?.reason ?? ''] ?? "We couldn't delete it. Please try again.", { type: 'error' })
      return
    }
    router.replace(SURVEY_PATH)
    void loadSurveys()
  }

  if (loading || !group) return null

  if (!group.commute_survey_enabled) {
    return (
      <>
        <PortalPageHead title="Commute survey" subtitle="The yearly employee commute survey, run through Shift." />
        <Card>
          <CardBody>
            <p className="text-[14.5px] leading-[1.55] text-ink">
              The commute survey is part of the Standard plan: staff get a two-minute survey by personal link or in the Shift app, you watch the response rate against your headcount, and at the end you get the summary MassDEP, Cambridge or Boston asks for, plus your staff commuting emissions.
            </p>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-muted">
              It is not switched on for your workplace yet. Email <a href="mailto:info@gogreenstreets.org" className="font-semibold text-accent underline">info@gogreenstreets.org</a> and we will set it up.
            </p>
          </CardBody>
        </Card>
      </>
    )
  }

  const showEditor = creating || (surveys !== null && surveys.length === 0) || (editing && selected)

  return (
    <>
      <PortalPageHead
        title="Commute survey"
        subtitle="One week a year, every employee, two minutes each. You see totals and who has answered, never anyone's answers."
        actions={
          canManage && surveys && surveys.length > 0 && !creating ? (
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => { setCreating(true); setEditing(false) }}>
              New survey
            </Button>
          ) : undefined
        }
      />

      {surveys && surveys.length > 1 && !creating && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <label htmlFor="survey-pick" className="text-[13px] font-semibold text-ink">
            Survey
          </label>
          <select
            id="survey-pick"
            value={selected?.id ?? ''}
            onChange={(e) => router.replace(`${SURVEY_PATH}?survey=${e.target.value}`)}
            className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
          >
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({STATUS_WORDS[s.status].text})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-5">
        {showEditor ? (
          <SurveyEditor
            groupId={group.id}
            sites={locations}
            existing={creating ? null : selected}
            onSaved={(id) => {
              setCreating(false)
              setEditing(false)
              router.replace(`${SURVEY_PATH}?survey=${id}`)
              void loadSurveys()
            }}
            onCancel={surveys && surveys.length > 0 ? () => { setCreating(false); setEditing(false) } : undefined}
          />
        ) : null}

        {selected && !creating && !editing && (
          <>
            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[17px] font-bold text-ink">{selected.title}</h2>
                    <Badge tone={STATUS_WORDS[selected.status].tone} dot>
                      {STATUS_WORDS[selected.status].text}
                    </Badge>
                    <Badge tone="neutral">{RULE_SET_LABEL[selected.rule_set]}</Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-ink-muted">
                    <CalendarDays size={14} strokeWidth={1.75} />
                    Survey week {weekLabel(selected.week_start)}. Answers until {longDate(selected.closes_on)}.
                    {selected.headcount ? ` Headcount ${selected.headcount.toLocaleString()}.` : ' No headcount yet.'}
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    {selected.status !== 'closed' && (
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
                        Edit details
                      </Button>
                    )}
                    {selected.status === 'draft' && (
                      <>
                        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => void deleteSurvey(selected.id)}>
                          Delete
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => void setSurveyStatus(selected.id, 'open')} disabled={busy}>
                          Open the survey
                        </Button>
                      </>
                    )}
                    {selected.status === 'open' && (
                      <Button variant="secondary" size="sm" onClick={() => void setSurveyStatus(selected.id, 'closed')} disabled={busy}>
                        Close the survey
                      </Button>
                    )}
                    {selected.status === 'closed' && (
                      <Button variant="secondary" size="sm" onClick={() => void setSurveyStatus(selected.id, 'open')} disabled={busy}>
                        Reopen
                      </Button>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            {status && selected.status !== 'draft' && <ResponseRateCard status={status} />}
            {status && <StaffListCard status={status} sites={sites} canManage={canManage} onChanged={refresh} />}
            {status && selected.status !== 'draft' && <ExportsCard survey={selected} responded={status.responded_total} />}
          </>
        )}
      </div>
    </>
  )
}
