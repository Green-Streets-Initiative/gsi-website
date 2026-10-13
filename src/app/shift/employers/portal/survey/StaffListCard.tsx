'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Mail, Search, Send, Trash2, Upload, X } from 'lucide-react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import Badge from '@/components/employer/Badge'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { longDate, weekLabel } from '@/lib/employer/survey-instrument'
import { parseStaff } from './staff-csv'
import { REASONS, type Person, type SurveyStatus } from './survey-types'

const PAGE_SIZE = 100

const field = 'block text-[13px] font-semibold text-ink'
const inputBox =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent-soft'

function statusWords(p: Person): { text: string; tone: 'success' | 'warn' | 'info' | 'neutral' } {
  if (p.responded) return { text: 'Answered', tone: 'success' }
  switch (p.status) {
    case 'reminded':
      return { text: 'Reminded', tone: 'info' }
    case 'sent':
      return { text: 'Link sent', tone: 'info' }
    case 'unsubscribed':
      return { text: 'Opted out', tone: 'neutral' }
    case 'bounced':
      return { text: 'Email bounced', tone: 'warn' }
    default:
      return { text: 'Not sent yet', tone: 'neutral' }
  }
}

function csvCell(v: string | null | undefined): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

// ── People ────────────────────────────────────────────────────────────────

/**
 * The staff list: who gets a personal link and who has answered (yes or
 * no). Adding people from a pasted list or a CSV with name, email,
 * department and site columns.
 */
export function PeopleCard({
  status,
  sites,
  canManage,
  onChanged,
}: {
  status: SurveyStatus
  sites: { id: string; name: string }[]
  canManage: boolean
  onChanged: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const survey = status.survey
  const people = status.people
  const [adding, setAdding] = useState(people.length === 0)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileText, setFileText] = useState('')
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const fileRef = useRef<HTMLInputElement>(null)

  const siteName = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s.name])), [sites])
  const parsed = useMemo(() => parseStaff(`${text}\n${fileText}`, sites), [text, fileText, sites])
  const responded = people.filter((p) => p.responded).length

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return people.filter((p) => {
      if (filter === 'yes' && !p.responded) return false
      if (filter === 'no' && p.responded) return false
      if (!needle) return true
      return (p.name ?? '').toLowerCase().includes(needle) || p.email.includes(needle) || (p.department ?? '').toLowerCase().includes(needle)
    })
  }, [people, q, filter])
  const shown = filtered.slice(0, visible)

  async function handleFile(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast('That file is over 4 MB. Export just the name and email columns and try again.', { type: 'error' })
      return
    }
    setFileText(await file.text())
    setFileName(file.name)
  }

  async function addPeople() {
    if (saving || parsed.rows.length === 0) return
    setSaving(true)
    try {
      const { data, error } = await supabase.rpc('add_employer_survey_recipients', { p_survey_id: survey.id, p_rows: parsed.rows })
      const res = (data ?? null) as { ok?: boolean; reason?: string; added?: number; already_listed?: number; invalid?: number } | null
      if (error || !res?.ok) {
        toast(REASONS[res?.reason ?? ''] ?? "We couldn't save the list. Please try again.", { type: 'error' })
        return
      }
      const parts = [`${res.added ?? 0} ${res.added === 1 ? 'person' : 'people'} added.`]
      if (res.already_listed) parts.push(`${res.already_listed} already on the list.`)
      if (res.invalid) parts.push(`${res.invalid} ${res.invalid === 1 ? 'was not' : 'were not'} a valid address.`)
      if (survey.status === 'open' && (res.added ?? 0) > 0) parts.push('Their links go out within the hour.')
      toast(parts.join(' '), { type: 'success' })
      posthog.capture('portal_survey_people_added', { survey_id: survey.id, count: res.added ?? 0 })
      setText('')
      setFileText('')
      setFileName(null)
      setAdding(false)
      onChanged()
    } catch {
      toast("We couldn't save the list. Please try again.", { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function remove(p: Person) {
    const ok = await confirm({ title: `Remove ${p.name ?? p.email}?`, body: 'They will not get the survey or a reminder.', confirmLabel: 'Remove', tone: 'danger' })
    if (!ok) return
    const { data, error } = await supabase.rpc('remove_employer_survey_recipient', { p_id: p.id })
    const res = (data ?? null) as { ok?: boolean; reason?: string } | null
    if (error || !res?.ok) {
      toast(res?.reason === 'responded' ? 'They already answered, so they stay on the list.' : "We couldn't remove them. Please try again.", { type: 'error' })
      return
    }
    onChanged()
  }

  function exportList() {
    const header = ['Name', 'Email', 'Department', 'Site', 'Answered', 'Status']
    const lines = filtered.map((p) => [p.name, p.email, p.department, p.location_id ? siteName[p.location_id] : '', p.responded ? 'Yes' : 'No', statusWords(p).text])
    const csv = [header, ...lines].map((l) => l.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'commute-survey-people.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-[18px]">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Who gets the survey</h3>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-muted">
            Each person on this list gets their own link by email. You see who has answered.
          </p>
        </div>
        {canManage && survey.status !== 'closed' && (
          <Button variant={people.length === 0 ? 'primary' : 'secondary'} size="sm" icon={Upload} onClick={() => setAdding((v) => !v)}>
            {adding ? 'Hide' : 'Add people'}
          </Button>
        )}
      </div>

      {adding && canManage && survey.status !== 'closed' && (
        <div className="border-b border-line px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="block">
              <span className={field}>Paste names and work emails</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder={'Jane Doe <jane@yourcompany.com>\nsam@yourcompany.com, Sam Lee, Finance\nOne person per line.'}
                className={`mt-1.5 resize-y ${inputBox}`}
              />
              <span className="mt-1.5 block text-[12.5px] leading-[1.5] text-ink-muted">
                Email is what the link goes to. Name, department and site are optional and show in the lists here.
              </span>
            </label>
            <div>
              <span className={field}>Or upload a CSV</span>
              <div className="mt-1.5 flex min-h-[158px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line bg-surface-2 px-4 py-5 text-center">
                <Upload size={20} strokeWidth={1.75} className="text-ink-muted" aria-hidden />
                {fileName ? (
                  <>
                    <span className="break-all text-[13.5px] font-semibold text-ink">{fileName}</span>
                    <Button variant="ghost" size="sm" icon={X} onClick={() => { setFileText(''); setFileName(null) }}>
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-[13.5px] leading-[1.5] text-ink-muted">
                      An HR export with an email column. Name, department and site or office columns are read too.
                    </span>
                    <Button variant="secondary" size="sm" icon={Upload} onClick={() => fileRef.current?.click()} className="mt-1">
                      Choose a file
                    </Button>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleFile(f)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink" aria-live="polite">
                {parsed.rows.length === 0 && parsed.wrong.length === 0
                  ? 'No addresses yet'
                  : `${parsed.rows.length} ${parsed.rows.length === 1 ? 'person' : 'people'} found${parsed.wrong.length ? `, ${parsed.wrong.length} ${parsed.wrong.length === 1 ? 'address looks' : 'addresses look'} wrong` : ''}`}
              </div>
              {parsed.rows.length > 0 && (
                <p className="mt-1 break-words text-[12.5px] leading-[1.5] text-ink-muted">
                  {parsed.rows.slice(0, 4).map((r) => (r.name ? `${r.name} (${r.email})` : r.email)).join(', ')}
                  {parsed.rows.length > 4 ? ` and ${parsed.rows.length - 4} more` : ''}
                </p>
              )}
              {parsed.wrong.length > 0 && (
                <p className="mt-1 break-words text-[12.5px] leading-[1.5] text-ep-danger">
                  Fix these: {parsed.wrong.slice(0, 5).join(', ')}
                  {parsed.wrong.length > 5 ? ` and ${parsed.wrong.length - 5} more` : ''}
                </p>
              )}
            </div>
            <Button variant="primary" onClick={() => void addPeople()} disabled={saving || parsed.rows.length === 0}>
              {saving ? 'Saving...' : parsed.rows.length > 0 ? `Add ${parsed.rows.length}` : 'Add to the list'}
            </Button>
          </div>
        </div>
      )}

      {people.length === 0 ? (
        <div className="px-6 py-8 text-center text-[14px] text-ink-muted">
          Nobody on the list yet. Paste names and work emails above, or upload the list from HR.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-6 py-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-icon" />
              <input
                type="search"
                value={q}
                onChange={(e) => { setQ(e.target.value); setVisible(PAGE_SIZE) }}
                placeholder="Search names, emails, departments"
                aria-label="Search the list"
                className={`${inputBox} pl-9`}
              />
            </div>
            <div role="radiogroup" aria-label="Show" className="inline-flex rounded-[10px] bg-surface-2 p-[3px]">
              {([['all', `All ${people.length}`], ['yes', `Answered ${responded}`], ['no', `Not yet ${people.length - responded}`]] as const).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={filter === v}
                  onClick={() => { setFilter(v); setVisible(PAGE_SIZE) }}
                  className={`rounded-[8px] px-3 py-[6px] text-[13px] font-medium leading-none transition-all ${filter === v ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" icon={Download} onClick={exportList} disabled={filtered.length === 0}>
              CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13.5px]">
              <thead>
                <tr className="border-y border-line-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-tertiary">
                  <th className="px-6 py-2">Person</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const s = statusWords(p)
                  return (
                    <tr key={p.id} className="border-b border-line-2 last:border-b-0">
                      <td className="px-6 py-2.5">
                        <div className="font-semibold text-ink">{p.name ?? p.email}</div>
                        {p.name && <div className="text-[12.5px] text-ink-muted">{p.email}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">{p.department ?? ''}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{p.location_id ? siteName[p.location_id] ?? '' : ''}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={s.tone} dot>
                          {s.text}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {canManage && !p.responded && survey.status !== 'closed' && (
                          <button type="button" onClick={() => void remove(p)} aria-label={`Remove ${p.name ?? p.email}`} className="rounded-md p-1.5 text-ink-icon hover:bg-surface-2 hover:text-ep-danger">
                            <Trash2 size={15} strokeWidth={1.75} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > visible && (
            <div className="px-6 py-3">
              <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Email and reminders ───────────────────────────────────────────────────

/** The survey email and its reminder, as staff get them. */
function EmailPreview({ surveyId }: { surveyId: string }) {
  const [mails, setMails] = useState<{ invite: { html: string }; reminder: { html: string } } | null>(null)
  const [failed, setFailed] = useState(false)
  const [which, setWhich] = useState<'invite' | 'reminder'>('invite')
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(640)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('signed out')
        const res = await fetch(`/api/employer/survey?survey_id=${encodeURIComponent(surveyId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.invite?.html) throw new Error('no preview')
        if (!cancelled) setMails(json)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [surveyId])

  if (failed) return <p className="text-[13px] text-ink-muted">We couldn&apos;t load the email preview. Refresh the page to try again.</p>
  if (!mails) return <p className="text-[13px] text-ink-muted">Loading the email...</p>
  const html = mails[which].html.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">')
  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Which email" className="flex w-fit rounded-[10px] border border-line bg-surface-2 p-0.5">
        {(['invite', 'reminder'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={which === k}
            onClick={() => setWhich(k)}
            className={`rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${which === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
          >
            {k === 'invite' ? 'The survey email' : 'The reminder'}
          </button>
        ))}
      </div>
      <iframe
        ref={frameRef}
        title="Email preview"
        srcDoc={html}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        className="w-full rounded-[10px] border border-line bg-white"
        style={{ height }}
        onLoad={() => {
          const doc = frameRef.current?.contentDocument
          if (doc?.body) setHeight(Math.min(Math.max(doc.documentElement.scrollHeight, 320), 1400))
        }}
      />
    </div>
  )
}

/**
 * When the emails go and to whom, in plain words, with the buttons that
 * send now, and the email itself.
 */
export function SendingCard({
  status,
  canManage,
  onChanged,
  onOpen,
}: {
  status: SurveyStatus
  canManage: boolean
  onChanged: () => void
  onOpen: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const survey = status.survey
  const people = status.people
  const [sending, setSending] = useState(false)
  const pending = people.filter((p) => p.status === 'pending').length
  const waiting = people.filter((p) => !p.responded && (p.status === 'sent' || p.status === 'reminded')).length
  const sent = people.filter((p) => p.status !== 'pending').length
  const responded = people.filter((p) => p.responded).length

  async function sendNow(kind: 'links' | 'reminders') {
    const n = kind === 'links' ? pending : waiting
    const ok = await confirm({
      title: kind === 'links' ? `Send the survey to ${n} ${n === 1 ? 'person' : 'people'} now?` : 'Send a reminder now?',
      body:
        kind === 'links'
          ? 'Each person gets their own link by email, in your name. Anyone who has not answered after three days gets one reminder.'
          : `${waiting} ${waiting === 1 ? 'person has' : 'people have'} a link and no answer yet. The reminder goes to those whose first email was at least three days ago and who have not had one.`,
      confirmLabel: kind === 'links' ? 'Send' : 'Send reminders',
    })
    if (!ok) return
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/employer/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ survey_id: survey.id }),
      })
      const json = (await res.json().catch(() => null)) as { queued?: boolean; invites?: number; reminders?: number } | null
      if (!res.ok) {
        toast("We couldn't send right now. The hourly run will pick these up.", { type: 'error' })
        return
      }
      if (json?.queued) toast('Queued. Emails go out within the hour.', { type: 'success' })
      else toast(`${json?.invites ?? 0} survey ${json?.invites === 1 ? 'email' : 'emails'} and ${json?.reminders ?? 0} ${json?.reminders === 1 ? 'reminder' : 'reminders'} sent.`, { type: 'success' })
      posthog.capture('portal_survey_sent', { survey_id: survey.id, kind, invites: json?.invites ?? 0, reminders: json?.reminders ?? 0 })
      onChanged()
    } catch {
      toast("We couldn't send right now. The hourly run will pick these up.", { type: 'error' })
    } finally {
      setSending(false)
    }
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Survey email', value: survey.status === 'draft' ? 'Goes out when you open the survey, to everyone on the list.' : `Sent to ${sent} of ${people.length}. New people on the list get theirs within the hour.` },
    { label: 'Reminder', value: 'One, three days after the first email, to anyone who has not answered. Nothing after the last day to answer.' },
    { label: 'In the Shift app', value: `Staff who use Shift also get a card on the Friday of survey week with their week filled in from their trips, and a nudge the Tuesday after.` },
    { label: 'From', value: 'Your name, sent by Shift. Replies and opt-outs come to Green Streets Initiative.' },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-[18px]">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Email and reminders</h3>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-muted">
            {survey.status === 'draft'
              ? `Staff answer about ${weekLabel(survey.week_start)}. Open the survey when you want the emails to go.`
              : survey.status === 'open'
                ? `${responded} of ${people.length} on the list have answered. Answers close ${longDate(survey.closes_on)}.`
                : `Closed. ${responded} of ${people.length} on the list answered.`}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {survey.status === 'draft' && (
              <Button variant="primary" size="sm" icon={Send} onClick={onOpen}>
                {pending > 0 ? `Open and send to ${pending}` : 'Open the survey'}
              </Button>
            )}
            {survey.status === 'open' && pending > 0 && (
              <Button variant="primary" size="sm" icon={Send} onClick={() => void sendNow('links')} disabled={sending}>
                {sending ? 'Sending...' : `Send to ${pending} now`}
              </Button>
            )}
            {survey.status === 'open' && pending === 0 && waiting > 0 && (
              <Button variant="secondary" size="sm" icon={Mail} onClick={() => void sendNow('reminders')} disabled={sending}>
                {sending ? 'Sending...' : 'Send the reminder now'}
              </Button>
            )}
          </div>
        )}
      </div>

      <dl className="grid gap-x-8 gap-y-4 px-6 py-5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-[12.5px] font-semibold text-ink-tertiary">{r.label}</dt>
            <dd className="mt-0.5 text-[14px] leading-[1.5] text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-line px-6 py-5">
        <h4 className="text-[14px] font-bold text-ink">What staff receive</h4>
        <div className="mt-3">
          <EmailPreview surveyId={survey.id} />
        </div>
      </div>
    </div>
  )
}
