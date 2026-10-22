'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Copy, Download, Minus, Plus, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import { useEmployerLocations, locationTitle } from '../_lib/use-employer-locations'
import PortalPageHead from '../_components/PortalPageHead'
import AskAssistantButton from '../_components/AskAssistantButton'
import PortalHeroPanel from '../_components/PortalHeroPanel'
import HeroReadouts, { type HeroReadout } from '../_components/HeroReadouts'
import TabStrip, { tabPanelProps } from '../_components/TabStrip'
import { Card, CardBody } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { longDate, weekLabel } from '@/lib/employer/survey-instrument'
import SurveyWizard from './SurveyWizard'
import SetupTab from './SetupTab'
import { PeopleCard, SendingCard } from './StaffListCard'
import ResponsesTab from './ResponsesTab'
import SummariesTab from './SummariesTab'
import { FILING_BY_ID, SURVEY_HINTS, massdepBandShort } from './survey-copy'
import { REASONS, SURVEY_LINK_BASE, SURVEY_PATH, ruleSetsOf, type SurveyRow, type SurveyStatus } from './survey-types'

type Tab = 'setup' | 'people' | 'sending' | 'responses' | 'summaries'
const TABS: { id: Tab; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'people', label: 'People' },
  { id: 'sending', label: 'Sending' },
  { id: 'responses', label: 'Responses' },
  { id: 'summaries', label: 'Summaries' },
]

const SELECT =
  'id, group_id, title, rule_set, rule_sets, week_start, closes_on, status, headcount, site_headcounts, departments, open_token, created_at, opened_at, closed_at'

const STATUS_BADGE: Record<SurveyRow['status'], { text: string; tone: 'success' | 'warn' | 'info' | 'neutral' }> = {
  draft: { text: 'Not sent yet', tone: 'neutral' },
  open: { text: 'Open', tone: 'success' },
  closed: { text: 'Closed', tone: 'info' },
}

/** Today in the portal's calendar, as YYYY-MM-DD. */
function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const end = new Date(y, m - 1, d, 23, 59, 59)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000))
}
function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function ratePct(n: number, d: number | null): number | null {
  return d ? Math.round((n / d) * 1000) / 10 : null
}

/** The open link and QR, white tile on the green panel. */
function LinkTile({ token, title }: { token: string; title: string }) {
  const toast = useToast()
  const url = `${SURVEY_LINK_BASE}/${token}`
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#191A2E', light: '#ffffff' } }).then(setQr)
  }, [url])
  return (
    <div className="grid gap-3 md:w-[300px]">
      <div className="text-[14px] font-semibold text-ink">Link for staff without email</div>
      <div className="flex items-start gap-3">
        <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-lg ring-1 ring-line">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code for the survey link" className="h-full w-full" />
          ) : (
            <span className="text-[14px] text-ink-tertiary">...</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-[1.45] text-ink-muted">For a break room QR or a shift channel. Answers count in the totals and are not tied to a name.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Copy}
              onClick={() => {
                navigator.clipboard.writeText(url)
                toast('Link copied', { type: 'success' })
              }}
            >
              Copy link
            </Button>
            <a href={qr ?? '#'} download={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`} className="contents">
              <Button variant="ghost" size="sm" icon={Download} disabled={!qr}>
                Download QR
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Draft tile: what is done and what is left before opening. */
function BeforeYouOpenTile({ survey, people, onGo }: { survey: SurveyRow; people: number; onGo: (t: Tab) => void }) {
  const rows: { ok: boolean; text: string; tab: Tab }[] = [
    { ok: ruleSetsOf(survey).length > 0, text: 'Filings chosen', tab: 'setup' },
    { ok: true, text: `Survey week ${weekLabel(survey.week_start).replace(/, \d{4}$/, '')}`, tab: 'setup' },
    { ok: !!survey.headcount, text: survey.headcount ? `Headcount ${survey.headcount.toLocaleString()}` : 'Headcount', tab: 'setup' },
    { ok: people > 0, text: people > 0 ? `Staff list, ${people.toLocaleString()} ${people === 1 ? 'person' : 'people'}` : 'Staff list', tab: 'people' },
  ]
  return (
    <div className="md:w-[280px]">
      <div className="text-[14px] font-semibold text-ink">Before you open</div>
      <ul className="mt-2 grid gap-1.5">
        {rows.map((r) => (
          <li key={r.text} className="flex items-center gap-2 text-[15px] text-ink">
            <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${r.ok ? 'bg-accent text-white' : 'bg-ink/15 text-ink'}`}>
              {r.ok ? <Check size={11} strokeWidth={3} /> : <Minus size={11} strokeWidth={3} />}
            </span>
            {r.ok ? (
              r.text
            ) : (
              <button type="button" onClick={() => onGo(r.tab)} className="font-semibold text-accent hover:underline">
                {r.text}: add it
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Closed tile: each filing and whether its summary is ready. */
function FilingsTile({ survey, status, onGo }: { survey: SurveyRow; status: SurveyStatus | null; onGo: () => void }) {
  const rate = status && survey.headcount ? (status.responded_total / survey.headcount) * 100 : null
  return (
    <div className="md:w-[300px]">
      <div className="text-[14px] font-semibold text-ink">Your filings</div>
      <ul className="mt-2 grid gap-2">
        {ruleSetsOf(survey).map((f) => {
          const filing = FILING_BY_ID[f]
          const badge =
            f === 'cambridge'
              ? { tone: 'info' as const, text: 'City runs the survey' }
              : !survey.headcount
                ? { tone: 'warn' as const, text: 'Needs a headcount' }
                : f === 'massdep' && rate != null && rate < 50
                  ? { tone: 'warn' as const, text: 'Below 50%' }
                  : { tone: 'success' as const, text: 'Ready' }
          return (
            <li key={f}>
              <button type="button" onClick={onGo} className="flex w-full items-start justify-between gap-3 text-left hover:underline">
                <span>
                  <span className="block text-[15px] font-semibold text-ink">{filing.title}</span>
                  <span className="block text-[14px] text-ink-muted">{filing.due}</span>
                </span>
                <Badge tone={badge.tone}>{badge.text}</Badge>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Commute survey (survey week, Shift 01170). The yearly employee commute
 * survey an employer owes MassDEP or Boston, or wants for an emissions
 * number: set it up, send personal links, watch the response rate, take the
 * summary at close. The employer sees totals and who has answered.
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
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('setup')
  const [peopleFilter, setPeopleFilter] = useState<'all' | 'yes' | 'no'>('all')

  const wanted = searchParams.get('survey')
  const selected = useMemo(() => {
    if (!surveys || surveys.length === 0) return null
    return surveys.find((s) => s.id === wanted) ?? surveys.find((s) => s.status === 'open') ?? surveys.find((s) => s.status === 'draft') ?? surveys[0]
  }, [surveys, wanted])

  const loadSurveys = useCallback(async () => {
    if (!group) return
    const { data } = await supabase.from('employer_surveys').select(SELECT).eq('group_id', group.id).order('week_start', { ascending: false }).limit(50)
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

  // The tab for the moment: a draft opens on People (or Sending once the list
  // is in), an open survey on Responses, a closed one on Summaries.
  const [autoTabbed, setAutoTabbed] = useState<string | null>(null)
  useEffect(() => {
    if (!selected || !status || autoTabbed === selected.id) return
    setAutoTabbed(selected.id)
    if (selected.status === 'draft') setTab(status.people.length > 0 ? 'sending' : 'people')
    else if (selected.status === 'open') setTab('responses')
    else setTab('summaries')
  }, [selected, status, autoTabbed])

  const refresh = useCallback(() => {
    void loadSurveys()
    if (selected) void loadStatus(selected.id)
  }, [loadSurveys, loadStatus, selected])

  function goTo(t: Tab, filter?: 'all' | 'yes' | 'no') {
    setTab(t)
    if (filter) setPeopleFilter(filter)
    document.querySelector('[data-portal-main]')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function setSurveyStatus(id: string, next: 'open' | 'closed') {
    const pending = status?.people.filter((p) => p.status === 'pending').length ?? 0
    const ok = await confirm({
      title: next === 'open' ? 'Open the survey?' : 'Close the survey?',
      body:
        next === 'open'
          ? pending > 0
            ? `${pending} ${pending === 1 ? 'person' : 'people'} on the list get their link by email within the hour, in your name. Answers are accepted from then on.`
            : 'Answers are accepted from now on. People you add to the list get their link within the hour.'
          : 'Answers stop and no more reminders go out. You can reopen it.',
      confirmLabel: next === 'open' ? (pending > 0 ? 'Open and send' : 'Open') : 'Close',
    })
    if (!ok) return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('set_employer_survey_status', { p_id: id, p_status: next })
      const res = (data ?? null) as { ok?: boolean; reason?: string } | null
      if (error || !res?.ok) {
        toast(REASONS[res?.reason ?? ''] ?? "We couldn't change that. Please try again.", { type: 'error' })
        return
      }
      toast(next === 'open' ? 'Survey open' : 'Survey closed', { type: 'success' })
      setAutoTabbed(null)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function sendNow(kind: 'links' | 'reminders') {
    if (!selected || !status) return
    const pending = status.people.filter((p) => p.status === 'pending').length
    const waiting = status.people.filter((p) => !p.responded && (p.status === 'sent' || p.status === 'reminded')).length
    const ok = await confirm({
      title: kind === 'links' ? `Send links to ${pending} ${pending === 1 ? 'person' : 'people'} now?` : 'Send the reminder now?',
      body:
        kind === 'links'
          ? 'Each person gets their own link by email, in your name. Anyone who has not answered after three days gets one reminder.'
          : `${waiting} ${waiting === 1 ? 'person has' : 'people have'} a link and no answer yet. The reminder goes to those whose first email was at least three days ago and who have not had one.`,
      confirmLabel: kind === 'links' ? 'Send' : 'Send reminder',
    })
    if (!ok) return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/employer/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ survey_id: selected.id }),
      })
      const json = (await res.json().catch(() => null)) as { queued?: boolean; invites?: number; reminders?: number } | null
      if (!res.ok) {
        toast("We couldn't send right now. The hourly run will pick these up.", { type: 'error' })
        return
      }
      if (json?.queued) toast('Queued. Emails go out within the hour.', { type: 'success' })
      else toast(`${json?.invites ?? 0} survey ${json?.invites === 1 ? 'email' : 'emails'} and ${json?.reminders ?? 0} ${json?.reminders === 1 ? 'reminder' : 'reminders'} sent.`, { type: 'success' })
      refresh()
    } catch {
      toast("We couldn't send right now. The hourly run will pick these up.", { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function deleteSurvey(id: string) {
    const ok = await confirm({ title: 'Delete this survey?', body: 'The staff list goes with it. Possible only before anyone has answered.', confirmLabel: 'Delete', tone: 'danger' })
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

  if (loading || !group || surveys === null) {
    return (
      <>
        <PortalPageHead title="Commute survey" subtitle="The yearly commute survey for MassDEP or Boston, or for your staff commuting emissions." />
        <div className="py-24 text-center text-[14px] text-ink-tertiary">Loading...</div>
      </>
    )
  }

  if (!group.commute_survey_enabled) {
    return (
      <>
        <PortalPageHead title="Commute survey" subtitle="The yearly commute survey for MassDEP or Boston, or for your staff commuting emissions." />
        <Card>
          <CardBody>
            <p className="text-[14px] leading-[1.55] text-ink">
              Part of the Standard plan. Staff get a two-minute survey by personal link or in the Shift app, you watch the response rate against your headcount, and at the end you get the summary MassDEP or Boston asks for, plus your staff commuting emissions.
            </p>
            <p className="mt-3 text-[15px] leading-[1.55] text-ink-muted">
              To switch it on, email{' '}
              <a href="mailto:info@gogreenstreets.org" className="font-semibold text-accent hover:underline">
                info@gogreenstreets.org
              </a>
              .
            </p>
          </CardBody>
        </Card>
      </>
    )
  }

  const people = status?.people ?? []
  const pending = people.filter((p) => p.status === 'pending').length
  const waiting = people.filter((p) => !p.responded && (p.status === 'sent' || p.status === 'reminded')).length
  const answered = status?.responded_total ?? 0
  const notYet = people.filter((p) => !p.responded).length
  const showWizard = creating || surveys.length === 0

  // ── Hero by state ──
  let lede = ''
  let readouts: HeroReadout[] = []
  let primary: { label: string; onClick: () => void } | null = null
  let ghosts: { label: string; onClick: () => void; icon?: typeof Trash2 }[] = []
  let tile: React.ReactNode = undefined
  if (selected) {
    const s = selected
    const sets = ruleSetsOf(s)
    const isMassdep = sets.includes('massdep')
    const rate = ratePct(answered, s.headcount)
    const ofList = status && status.invited ? ratePct(status.responded_matched, status.invited) : null
    const rateSub = s.headcount
      ? isMassdep && rate != null
        ? massdepBandShort(rate)
        : `of ${s.headcount.toLocaleString()} headcount`
      : 'Add a headcount under Setup'
    const pastClose = todayIso() > s.closes_on
    if (s.status === 'draft') {
      lede = `Not sent yet. Staff will answer about ${weekLabel(s.week_start)}; answers close ${longDate(s.closes_on)}. ${
        people.length > 0 ? `Next: open the survey and ${people.length.toLocaleString()} ${people.length === 1 ? 'person gets their' : 'people get their'} link by email.` : 'Next: add your staff list, then open the survey.'
      }`
      readouts = [
        { label: 'On the list', value: people.length.toLocaleString(), hint: SURVEY_HINTS.onList, sub: status ? `${status.people.filter((p) => p.has_app).length} with a Shift account` : '' },
        { label: 'Headcount', value: s.headcount?.toLocaleString() ?? '—', hint: SURVEY_HINTS.headcount, sub: s.headcount ? 'From Setup' : 'Not given yet' },
        { label: 'Survey week', value: shortDate(s.week_start), hint: SURVEY_HINTS.surveyWeek, sub: 'Monday to Friday' },
        { label: 'Last day to answer', value: shortDate(s.closes_on), hint: SURVEY_HINTS.lastDay, sub: `${daysUntil(s.closes_on)} days from now` },
      ]
      primary = people.length > 0 ? { label: `Open and send to ${people.length}`, onClick: () => void setSurveyStatus(s.id, 'open') } : { label: 'Add your staff list', onClick: () => goTo('people') }
      ghosts = [{ label: 'Delete', onClick: () => void deleteSurvey(s.id), icon: Trash2 }]
      tile = <BeforeYouOpenTile survey={s} people={people.length} onGo={(t) => goTo(t)} />
    } else if (s.status === 'open') {
      lede = pastClose
        ? `Past ${longDate(s.closes_on)}. Answers are still accepted until you close it. ${answered.toLocaleString()}${s.headcount ? ` of ${s.headcount.toLocaleString()}` : ''} have answered.`
        : `Open until ${longDate(s.closes_on)}. ${answered.toLocaleString()}${s.headcount ? ` of ${s.headcount.toLocaleString()}` : ''} have answered.`
      readouts = [
        { label: 'Answered', value: answered.toLocaleString(), hint: SURVEY_HINTS.answered, sub: status ? `${status.responded_matched} by link or app, ${status.responded_unmatched} by open link` : '' },
        { label: 'Response rate', value: rate != null ? `${rate}%` : '—', hint: SURVEY_HINTS.responseRate, sub: rateSub },
        { label: 'Of the list', value: ofList != null ? `${ofList}%` : '—', hint: SURVEY_HINTS.ofList, sub: `${notYet.toLocaleString()} still to answer` },
        { label: 'Days left', value: daysUntil(s.closes_on).toLocaleString(), hint: SURVEY_HINTS.daysLeft, sub: pastClose ? 'Close it when you are ready' : `Closes ${shortDate(s.closes_on)}` },
      ]
      if (pending > 0) primary = { label: `Send links to ${pending}`, onClick: () => void sendNow('links') }
      else if (waiting > 0 && !pastClose) primary = { label: `Remind ${waiting} who haven't answered`, onClick: () => void sendNow('reminders') }
      else primary = { label: 'Close the survey', onClick: () => void setSurveyStatus(s.id, 'closed') }
      if (primary.label !== 'Close the survey') ghosts = [{ label: 'Close the survey', onClick: () => void setSurveyStatus(s.id, 'closed') }]
      tile = <LinkTile token={s.open_token} title={s.title} />
    } else {
      lede = `Closed ${s.closed_at ? new Date(s.closed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : longDate(s.closes_on)}. ${answered.toLocaleString()}${s.headcount ? ` of ${s.headcount.toLocaleString()}` : ''} answered${rate != null ? ` (${rate}%)` : ''}.`
      readouts = [
        { label: 'Answered', value: answered.toLocaleString(), hint: SURVEY_HINTS.answered, sub: status ? `${status.responded_unmatched} by open link` : '' },
        { label: 'Response rate', value: rate != null ? `${rate}%` : '—', hint: SURVEY_HINTS.responseRate, sub: rateSub },
        { label: 'Of the list', value: ofList != null ? `${ofList}%` : '—', hint: SURVEY_HINTS.ofList, sub: `${notYet.toLocaleString()} did not answer` },
        isMassdep
          ? { label: 'Applicable commuters', value: (status?.applicable ?? 0).toLocaleString(), hint: SURVEY_HINTS.applicable, sub: 'Counted in the MassDEP summary' }
          : { label: 'Open-link answers', value: (status?.responded_unmatched ?? 0).toLocaleString(), hint: SURVEY_HINTS.openLink, sub: 'Not tied to a name' },
      ]
      primary = { label: 'Get your filing', onClick: () => goTo('summaries') }
      ghosts = [{ label: 'Reopen', onClick: () => void setSurveyStatus(s.id, 'open') }]
      tile = <FilingsTile survey={s} status={status} onGo={() => goTo('summaries')} />
    }
  }

  return (
    <>
      <PortalPageHead
        title="Commute survey"
        subtitle="The yearly commute survey for MassDEP or Boston, or for your staff commuting emissions."
        actions={
          <div className="flex flex-wrap gap-2">
            <AskAssistantButton label="Ask about the survey" prompt="Where does our commute survey stand, and what should I do next?" />
            {canManage && surveys.length > 0 && !creating && (
              <Button variant="secondary" icon={Plus} onClick={() => setCreating(true)}>
                New survey
              </Button>
            )}
          </div>
        }
      />

      {surveys.length > 1 && !creating && (
        <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Which survey">
          {surveys.map((s) => {
            const on = selected?.id === s.id
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setAutoTabbed(null)
                  router.replace(`${SURVEY_PATH}?survey=${s.id}`)
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${on ? 'border-accent bg-accent-softer text-ink' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
              >
                {weekLabel(s.week_start).replace(/, \d{4}$/, '')}
                <Badge tone={STATUS_BADGE[s.status].tone}>{STATUS_BADGE[s.status].text}</Badge>
              </button>
            )
          })}
        </div>
      )}

      <div className="grid gap-6">
        {showWizard && (
          <div>
            {surveys.length === 0 && (
              <div className="mb-4">
                <h2 className="text-[17px] font-bold text-ink">Set up your commute survey</h2>
                <p className="mt-1 text-[15px] text-ink-muted">Four short steps. You can change any of it until the survey opens.</p>
              </div>
            )}
            <SurveyWizard
              groupId={group.id}
              groupName={group.name}
              locations={locations}
              existing={null}
              takenWeeks={surveys.map((s) => s.week_start)}
              onSaved={(id) => {
                setCreating(false)
                setAutoTabbed(null)
                router.replace(`${SURVEY_PATH}?survey=${id}`)
                void loadSurveys()
              }}
              onCancel={surveys.length > 0 ? () => setCreating(false) : undefined}
            />
          </div>
        )}

        {selected && !creating && (
          <>
            <PortalHeroPanel
              className="min-w-0"
              title={selected.title}
              lede={lede}
              below={<HeroReadouts readouts={readouts} />}
              actions={
                canManage ? (
                  <>
                    {primary && (
                      <Button variant="secondary" onClick={primary.onClick} disabled={busy}>
                        {primary.label}
                      </Button>
                    )}
                    {ghosts.map((g) => (
                      <Button key={g.label} variant="ghost" icon={g.icon} onClick={g.onClick} disabled={busy} className="text-white hover:bg-white/10 hover:text-white">
                        {g.label}
                      </Button>
                    ))}
                  </>
                ) : undefined
              }
              tile={tile}
            />

            <Card className="min-w-0">
              <TabStrip
                tabs={TABS.map((t) => (t.id === 'people' && people.length > 0 ? { ...t, count: people.length } : t))}
                value={tab}
                onChange={(t) => setTab(t)}
                label="Survey"
                prefix="survey"
                className="px-4"
              />
              <div {...tabPanelProps('survey', 'setup')} hidden={tab !== 'setup'} className="outline-none">
                <SetupTab survey={selected} groupId={group.id} groupName={group.name} locations={locations} canManage={canManage} onChanged={refresh} />
              </div>
              <div {...tabPanelProps('survey', 'people')} hidden={tab !== 'people'} className="outline-none">
                {status && <PeopleCard status={status} sites={sites} canManage={canManage} onChanged={refresh} initialFilter={peopleFilter} />}
              </div>
              <div {...tabPanelProps('survey', 'sending')} hidden={tab !== 'sending'} className="outline-none">
                {status && (
                  <SendingCard
                    status={status}
                    action={
                      canManage && primary && (selected.status !== 'closed') && primary.label !== 'Add your staff list' && primary.label !== 'Close the survey' ? (
                        <Button variant="primary" size="sm" onClick={primary.onClick} disabled={busy}>
                          {primary.label}
                        </Button>
                      ) : undefined
                    }
                  />
                )}
              </div>
              <div {...tabPanelProps('survey', 'responses')} hidden={tab !== 'responses'} className="outline-none">
                {status && <ResponsesTab status={status} onGoToSending={() => goTo('sending')} onGoToPeople={() => goTo('people', 'no')} />}
              </div>
              <div {...tabPanelProps('survey', 'summaries')} hidden={tab !== 'summaries'} className="outline-none">
                {status && <SummariesTab status={status} sitesCount={sites.length} />}
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
