'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Copy, Download, Plus, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import { useEmployerLocations, locationTitle } from '../_lib/use-employer-locations'
import PortalPageHead from '../_components/PortalPageHead'
import PortalHeroPanel from '../_components/PortalHeroPanel'
import TabStrip, { tabPanelProps } from '../_components/TabStrip'
import { Card, CardBody } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { RULE_SET_LABEL, longDate, weekLabel } from '@/lib/employer/survey-instrument'
import SurveyEditor from './SurveyEditor'
import { PeopleCard, SendingCard } from './StaffListCard'
import ResponseRateCard from './ResponseRateCard'
import ExportsCard from './ExportsCard'
import { REASONS, SURVEY_LINK_BASE, SURVEY_PATH, ruleSetsOf, type SurveyRow, type SurveyStatus } from './survey-types'

type Tab = 'responses' | 'people' | 'sending' | 'summaries' | 'details'

const SELECT =
  'id, group_id, title, rule_set, rule_sets, week_start, closes_on, status, headcount, site_headcounts, departments, open_token, created_at, opened_at, closed_at'

function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const end = new Date(y, m - 1, d, 23, 59, 59)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000))
}

/** "Open until Wednesday, October 28. 2 of 12 have answered." */
function statusLine(s: SurveyRow, st: SurveyStatus | null): string {
  const answered = st ? `${st.responded_total.toLocaleString()}${s.headcount ? ` of ${s.headcount.toLocaleString()}` : ''} ${st.responded_total === 1 ? 'person has' : 'people have'} answered.` : ''
  if (s.status === 'draft') return `Not sent yet. Staff will answer about ${weekLabel(s.week_start)}.`
  if (s.status === 'closed') return `Closed ${s.closed_at ? new Date(s.closed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''}. ${answered}`
  return `Open until ${longDate(s.closes_on)}. ${answered}`
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
    <div className="grid gap-3">
      <div className="text-[13px] font-semibold text-ink">Link for staff without email</div>
      <div className="flex items-start gap-3">
        <div className="flex h-[96px] w-[96px] shrink-0 items-center justify-center rounded-lg ring-1 ring-line">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code for the survey link" className="h-full w-full" />
          ) : (
            <span className="text-[12px] text-ink-tertiary">...</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] leading-[1.5] text-ink-muted">Print it for a break room or post the link in a shift channel. Answers here count in the totals but are not tied to a name.</p>
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
                QR
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Commute survey (survey week, Shift 01170). The yearly employee commute
 * survey an employer owes MassDEP, Cambridge or Boston, or wants for an
 * emissions number: set it up, send personal links, watch the response rate,
 * take the summaries at close. The employer sees totals and who has
 * answered.
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
  const [tab, setTab] = useState<Tab>('responses')

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

  // A draft opens on People (the next thing to do); an open survey on Responses.
  useEffect(() => {
    if (selected) setTab(selected.status === 'draft' ? 'people' : 'responses')
  }, [selected?.id, selected?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    void loadSurveys()
    if (selected) void loadStatus(selected.id)
  }, [loadSurveys, loadStatus, selected])

  async function setSurveyStatus(id: string, next: 'open' | 'closed') {
    const pending = status?.people.filter((p) => p.status === 'pending').length ?? 0
    const ok = await confirm({
      title: next === 'open' ? 'Open the survey?' : 'Close the survey?',
      body:
        next === 'open'
          ? pending > 0
            ? `${pending} ${pending === 1 ? 'person' : 'people'} on the list will get their link by email within the hour, in your name. Answers are accepted from then on.`
            : 'Answers are accepted from now on. Add people to the list and they get their link by email.'
          : 'No more answers are accepted and no reminders go out. You can reopen it.',
      confirmLabel: next === 'open' ? 'Open and send' : 'Close',
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
      refresh()
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

  if (loading || !group) return null

  if (!group.commute_survey_enabled) {
    return (
      <>
        <PortalPageHead title="Commute survey" subtitle="The yearly employee commute survey, run through Shift." />
        <Card>
          <CardBody>
            <p className="text-[14.5px] leading-[1.55] text-ink">
              Part of the Standard plan. Staff get a two-minute survey by personal link or in the Shift app, you watch the response rate against your headcount, and at the end you get the summary MassDEP, Cambridge or Boston asks for, plus your staff commuting emissions.
            </p>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-muted">
              To switch it on, email <a href="mailto:info@gogreenstreets.org" className="font-semibold text-accent underline">info@gogreenstreets.org</a>.
            </p>
          </CardBody>
        </Card>
      </>
    )
  }

  const showEditor = creating || (surveys !== null && surveys.length === 0)
  const people = status?.people ?? []
  const pending = people.filter((p) => p.status === 'pending').length
  const notYet = people.filter((p) => !p.responded).length
  const tabs: { id: Tab; label: string; count?: number }[] = selected
    ? [
        ...(selected.status !== 'draft' ? [{ id: 'responses' as Tab, label: 'Responses' }] : []),
        { id: 'people' as Tab, label: 'People', count: people.length || undefined },
        { id: 'sending' as Tab, label: 'Email and reminders' },
        ...(selected.status !== 'draft' ? [{ id: 'summaries' as Tab, label: 'Summaries' }] : []),
        { id: 'details' as Tab, label: 'Details' },
      ]
    : []
  const activeTab: Tab = tabs.some((t) => t.id === tab) ? tab : (tabs[0]?.id ?? 'people')

  return (
    <>
      <PortalPageHead
        title="Commute survey"
        subtitle="The yearly employee commute survey, done in one week: staff answer in two minutes, you get the response rate as it happens and the summaries at the end."
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
                {s.title} ({s.status === 'draft' ? 'not sent yet' : s.status})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-5">
        {showEditor && (
          <SurveyEditor
            groupId={group.id}
            sites={locations}
            existing={null}
            onSaved={(id) => {
              setCreating(false)
              router.replace(`${SURVEY_PATH}?survey=${id}`)
              void loadSurveys()
            }}
            onCancel={surveys && surveys.length > 0 ? () => setCreating(false) : undefined}
          />
        )}

        {selected && !creating && (
          <>
            <PortalHeroPanel
              title={selected.title}
              lede={
                <>
                  {statusLine(selected, status)}{' '}
                  {ruleSetsOf(selected).map((r) => RULE_SET_LABEL[r]).join(', ')}.
                </>
              }
              readouts={
                selected.status === 'draft'
                  ? [
                      { label: 'On the list', value: people.length.toLocaleString() },
                      { label: 'Headcount', value: selected.headcount?.toLocaleString() ?? '—' },
                      { label: 'Survey week', value: weekLabel(selected.week_start).replace(/, \d{4}$/, '').replace(/ to .*$/, '') },
                      { label: 'Last day to answer', value: new Date(`${selected.closes_on}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
                    ]
                  : [
                      { label: 'Answered', value: (status?.responded_total ?? 0).toLocaleString() },
                      { label: 'Of headcount', value: selected.headcount && status ? `${Math.round((status.responded_total / selected.headcount) * 1000) / 10}%` : '—' },
                      { label: 'Of the list', value: status && status.invited ? `${Math.round((status.responded_matched / status.invited) * 1000) / 10}%` : '—' },
                      selected.status === 'open'
                        ? { label: 'Days left', value: daysUntil(selected.closes_on).toLocaleString() }
                        : { label: 'Still to answer', value: notYet.toLocaleString() },
                    ]
              }
              actions={
                canManage ? (
                  <>
                    {selected.status === 'draft' && (
                      <Button variant="secondary" size="sm" onClick={() => void setSurveyStatus(selected.id, 'open')} disabled={busy}>
                        {pending > 0 ? `Open and send to ${pending}` : 'Open the survey'}
                      </Button>
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
                    {selected.status === 'draft' && (
                      <Button variant="ghost" size="sm" icon={Trash2} onClick={() => void deleteSurvey(selected.id)} className="text-white hover:bg-white/10 hover:text-white">
                        Delete
                      </Button>
                    )}
                  </>
                ) : undefined
              }
              tile={selected.status === 'open' ? <LinkTile token={selected.open_token} title={selected.title} /> : undefined}
            />

            <Card>
              <TabStrip tabs={tabs} value={activeTab} onChange={(t) => { setTab(t); setEditing(false) }} label="Survey" prefix="survey" className="px-4" />

              {selected.status !== 'draft' && (
                <div {...tabPanelProps('survey', 'responses')} hidden={activeTab !== 'responses'} className="outline-none">
                  {status && <ResponseRateCard status={status} />}
                </div>
              )}
              <div {...tabPanelProps('survey', 'people')} hidden={activeTab !== 'people'} className="outline-none">
                {status && <PeopleCard status={status} sites={sites} canManage={canManage} onChanged={refresh} />}
              </div>
              <div {...tabPanelProps('survey', 'sending')} hidden={activeTab !== 'sending'} className="outline-none">
                {status && <SendingCard status={status} canManage={canManage} onChanged={refresh} onOpen={() => void setSurveyStatus(selected.id, 'open')} />}
              </div>
              {selected.status !== 'draft' && (
                <div {...tabPanelProps('survey', 'summaries')} hidden={activeTab !== 'summaries'} className="outline-none">
                  {status && <ExportsCard survey={selected} responded={status.responded_total} />}
                </div>
              )}
              <div {...tabPanelProps('survey', 'details')} hidden={activeTab !== 'details'} className="outline-none">
                {editing ? (
                  <SurveyEditor
                    groupId={group.id}
                    sites={locations}
                    existing={selected}
                    onSaved={() => {
                      setEditing(false)
                      refresh()
                    }}
                    onCancel={() => setEditing(false)}
                  />
                ) : (
                  <CardBody>
                    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-[12.5px] font-semibold text-ink-tertiary">Filings</dt>
                        <dd className="mt-0.5 text-[14.5px] text-ink">{ruleSetsOf(selected).map((r) => RULE_SET_LABEL[r]).join(', ')}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] font-semibold text-ink-tertiary">Survey week</dt>
                        <dd className="mt-0.5 text-[14.5px] text-ink">{weekLabel(selected.week_start)}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] font-semibold text-ink-tertiary">Last day to answer</dt>
                        <dd className="mt-0.5 text-[14.5px] text-ink">{longDate(selected.closes_on)}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] font-semibold text-ink-tertiary">Headcount</dt>
                        <dd className="mt-0.5 text-[14.5px] text-ink">
                          {selected.headcount?.toLocaleString() ?? 'not given'}
                          {sites.length > 1 && Object.keys(selected.site_headcounts ?? {}).length > 0 && (
                            <span className="text-ink-muted">
                              {' '}
                              ({sites.map((s) => `${s.name} ${selected.site_headcounts?.[s.id] ?? '—'}`).join(', ')})
                            </span>
                          )}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-[12.5px] font-semibold text-ink-tertiary">Departments or tenants</dt>
                        <dd className="mt-0.5 text-[14.5px] text-ink">
                          {selected.departments.length > 0
                            ? selected.departments.map((d) => (d.headcount != null ? `${d.name} (${d.headcount})` : d.name)).join(', ')
                            : 'none'}
                        </dd>
                      </div>
                    </dl>
                    {canManage && selected.status !== 'closed' && (
                      <div className="mt-5">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                          Edit
                        </Button>
                      </div>
                    )}
                  </CardBody>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
