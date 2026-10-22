'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ClipboardList, Download, Search, Trash2, Upload, X } from 'lucide-react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import Badge from '@/components/employer/Badge'
import SegmentedControl from '@/components/employer/SegmentedControl'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { longDate, weekLabel } from '@/lib/employer/survey-instrument'
import { parseStaff } from './staff-csv'
import { REASONS, type Person, type SurveyStatus } from './survey-types'

const PAGE_SIZE = 50

const field = 'mb-1.5 block text-[14px] font-semibold text-ink-muted'
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

/** The in-tab header every survey tab uses: 16px title, 13px sub, action on the right. */
export function TabHead({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-[18px]">
      <div className="min-w-0">
        <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-[14px] leading-[1.5] text-ink-muted">{sub}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  )
}

// ── People ────────────────────────────────────────────────────────────────

type Filter = 'all' | 'yes' | 'no'

/**
 * People tab: who gets a personal link, and who has answered (yes or no).
 * Adding people from a pasted list or an HR export.
 */
export function PeopleCard({
  status,
  sites,
  canManage,
  onChanged,
  initialFilter = 'all',
}: {
  status: SurveyStatus
  sites: { id: string; name: string }[]
  canManage: boolean
  onChanged: () => void
  initialFilter?: Filter
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const survey = status.survey
  const people = status.people
  const [adding, setAdding] = useState<'paste' | 'upload' | null>(null)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileText, setFileText] = useState('')
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setFilter(initialFilter), [initialFilter])

  const siteName = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s.name])), [sites])
  const parsed = useMemo(() => parseStaff(`${text}\n${fileText}`, sites), [text, fileText, sites])
  const responded = people.filter((p) => p.responded).length
  const notYet = people.length - responded

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
      setAdding(null)
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

  function downloadList() {
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

  const canAdd = canManage && survey.status !== 'closed'
  const nextLine =
    survey.status === 'draft'
      ? people.length > 0
        ? 'Next: open the survey under Sending and these people get their link.'
        : null
      : survey.status === 'open'
        ? 'People added now get their link within the hour.'
        : null

  const addPanel = (
    <div className="border-b border-line px-6 py-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="block">
          <span className={field}>Paste names and work emails</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            autoFocus={adding === 'paste'}
            placeholder={'Jane Doe <jane@yourcompany.com>\nsam@yourcompany.com, Sam Lee, Finance\nOne person per line.'}
            className={`resize-y ${inputBox}`}
          />
          <span className="mt-1.5 block text-[14px] leading-[1.5] text-ink-muted">
            The email is what the link goes to. Name, department and site are optional and show in the list here.
          </span>
        </label>
        <div>
          <span className={field}>Or upload a CSV</span>
          <div className="flex min-h-[158px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line bg-surface-2 px-4 py-5 text-center">
            <Upload size={20} strokeWidth={1.75} className="text-ink-muted" aria-hidden />
            {fileName ? (
              <>
                <span className="break-all text-[15px] font-semibold text-ink">{fileName}</span>
                <Button variant="ghost" size="sm" icon={X} onClick={() => { setFileText(''); setFileName(null) }}>
                  Remove
                </Button>
              </>
            ) : (
              <>
                <span className="text-[15px] leading-[1.5] text-ink-muted">An HR export with an email column. Name, department and site or office columns are read too.</span>
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
          <div className="text-[15px] font-semibold text-ink" aria-live="polite">
            {parsed.rows.length === 0 && parsed.wrong.length === 0
              ? 'No addresses yet'
              : `${parsed.rows.length} ${parsed.rows.length === 1 ? 'person' : 'people'} found${parsed.wrong.length ? `, ${parsed.wrong.length} ${parsed.wrong.length === 1 ? 'address looks' : 'addresses look'} wrong` : ''}`}
          </div>
          {parsed.rows.length > 0 && (
            <p className="mt-1 break-words text-[14px] leading-[1.5] text-ink-muted">
              {parsed.rows.slice(0, 4).map((r) => (r.name ? `${r.name} (${r.email})` : r.email)).join(', ')}
              {parsed.rows.length > 4 ? ` and ${parsed.rows.length - 4} more` : ''}
            </p>
          )}
          {parsed.wrong.length > 0 && (
            <p className="mt-1 break-words text-[14px] leading-[1.5] text-ep-danger">
              Fix these: {parsed.wrong.slice(0, 5).join(', ')}
              {parsed.wrong.length > 5 ? ` and ${parsed.wrong.length - 5} more` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {people.length > 0 && (
            <Button variant="ghost" onClick={() => setAdding(null)}>
              Cancel
            </Button>
          )}
          <Button variant="primary" onClick={() => void addPeople()} disabled={saving || parsed.rows.length === 0}>
            {saving ? 'Saving...' : parsed.rows.length > 0 ? `Add ${parsed.rows.length}` : 'Add to the list'}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <TabHead
        title="Who gets a personal link"
        sub={
          people.length === 0
            ? 'Each person on the list gets their own link by email and shows here as answered or not yet.'
            : survey.status === 'draft'
              ? `${people.length.toLocaleString()} on the list. Each gets their own link by email when the survey opens.`
              : `${responded.toLocaleString()} answered, ${notYet.toLocaleString()} not yet. You see who answered, not what they said.`
        }
        action={
          canAdd && people.length > 0 && !adding ? (
            <Button variant="secondary" size="sm" icon={Upload} onClick={() => setAdding('paste')}>
              Add people
            </Button>
          ) : undefined
        }
      />

      {people.length === 0 ? (
        adding ? (
          addPanel
        ) : (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <ClipboardList size={26} strokeWidth={1.75} />
            </div>
            <h4 className="mt-4 text-[16px] font-bold text-ink">Add your staff list</h4>
            <p className="mt-1 max-w-[44ch] text-[14px] leading-[1.5] text-ink-muted">
              Paste names and work emails, or upload the list from HR. One person per line; the email is what the link goes to.
            </p>
            {canAdd ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => setAdding('paste')}>
                  Paste a list
                </Button>
                <Button variant="secondary" icon={Upload} onClick={() => { setAdding('upload'); setTimeout(() => fileRef.current?.click(), 0) }}>
                  Upload a CSV
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-[14px] text-ink-tertiary">An admin or manager on your team adds the list.</p>
            )}
            <p className="mt-4 text-[14px] leading-[1.5] text-ink-tertiary">Staff you can&apos;t email can use the open link and QR once the survey is open.</p>
            {/* The hidden input lives in the panel; mount it for the upload shortcut. */}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setAdding('upload')
                  void handleFile(f)
                }
                e.target.value = ''
              }}
            />
          </div>
        )
      ) : (
        <>
          {adding && addPanel}
          <div className="flex flex-wrap items-center gap-3 border-b border-line-2 px-6 py-3.5">
            <SegmentedControl<Filter>
              options={[
                { value: 'all', label: `All ${people.length}` },
                { value: 'yes', label: `Answered ${responded}` },
                { value: 'no', label: `Not yet ${notYet}` },
              ]}
              value={filter}
              onChange={(v) => { setFilter(v); setVisible(PAGE_SIZE) }}
            />
            <div className="relative ml-auto md:w-[240px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-icon" />
              <input
                type="search"
                value={q}
                onChange={(e) => { setQ(e.target.value); setVisible(PAGE_SIZE) }}
                placeholder="Search the list"
                aria-label="Search the list"
                className="h-[34px] w-full rounded-[9px] border border-line bg-surface pl-8 pr-3 text-[14px] text-ink outline-none placeholder:text-ink-tertiary focus:border-accent"
              />
            </div>
            <Button variant="secondary" size="sm" icon={Download} onClick={downloadList} disabled={filtered.length === 0}>
              Download list
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line-2 bg-surface-2">
                  <th scope="col" className="py-2.5 pl-6 pr-3 text-[14px] font-semibold text-ink-tertiary">Person</th>
                  <th scope="col" className="py-2.5 pr-3 text-[14px] font-semibold text-ink-tertiary">Department</th>
                  <th scope="col" className="py-2.5 pr-3 text-[14px] font-semibold text-ink-tertiary">Site</th>
                  <th scope="col" className="py-2.5 pr-3 text-[14px] font-semibold text-ink-tertiary">Status</th>
                  <th scope="col" className="py-2.5 pr-6"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-[14px] text-ink-tertiary">Nobody matches.</td>
                  </tr>
                )}
                {shown.map((p) => {
                  const s = statusWords(p)
                  return (
                    <tr key={p.id} className="border-b border-line-2 transition-colors last:border-0 hover:bg-accent-softer">
                      <td className="py-3 pl-6 pr-3">
                        <span className="block text-[14px] font-semibold text-ink">{p.name ?? p.email}</span>
                        {p.name && <span className="block text-[14px] text-ink-tertiary">{p.email}</span>}
                      </td>
                      <td className="py-3 pr-3 text-[14px] text-ink-muted">{p.department ?? ''}</td>
                      <td className="py-3 pr-3 text-[14px] text-ink-muted">{p.location_id ? siteName[p.location_id] ?? '' : ''}</td>
                      <td className="py-3 pr-3">
                        <Badge tone={s.tone} dot>
                          {s.text}
                        </Badge>
                      </td>
                      <td className="py-3 pr-6 text-right">
                        {canAdd && !p.responded && (
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
          {filtered.length > shown.length && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-2 px-6 py-3">
              <span className="text-[14px] text-ink-tertiary">
                Showing {shown.length} of {filtered.length}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show more
              </Button>
            </div>
          )}
          {nextLine && <p className="px-6 py-3 text-[14px] text-ink-muted">{nextLine}</p>}
        </>
      )}
    </div>
  )
}

// ── Sending ───────────────────────────────────────────────────────────────

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

  if (failed) return <p className="py-6 text-center text-[14px] text-ink-muted">We couldn&apos;t load the email preview. Refresh the page to try again.</p>
  if (!mails) return <p className="py-6 text-center text-[14px] text-ink-muted">Loading the email...</p>
  const html = mails[which].html.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">')
  return (
    <div className="grid gap-3">
      <SegmentedControl<'invite' | 'reminder'>
        options={[
          { value: 'invite', label: 'The survey email' },
          { value: 'reminder', label: 'The reminder' },
        ]}
        value={which}
        onChange={setWhich}
        className="w-fit"
      />
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
 * Sending tab: when the emails go and to whom, in a short list, with the
 * one action for the state and the email itself.
 */
export function SendingCard({ status, action }: { status: SurveyStatus; action?: ReactNode }) {
  const survey = status.survey
  const people = status.people
  const sent = people.filter((p) => p.status !== 'pending' && p.status !== 'unsubscribed').length
  const responded = people.filter((p) => p.responded).length

  const rows: { label: string; value: string }[] = [
    {
      label: 'First email',
      value: survey.status === 'draft' ? 'Goes out when you open the survey, to everyone on the list. People added later get theirs within the hour.' : `Sent to ${sent} of ${people.length} on the list. People added later get theirs within the hour.`,
    },
    { label: 'Reminder', value: 'One, three days after the first email, to people who have not answered. Reminders stop on the last day to answer.' },
    { label: 'Open link and QR', value: 'For staff you cannot email. Shown at the top of this page while the survey is open; answers count in the totals and are not tied to a name.' },
    { label: 'In the Shift app', value: 'Staff who use Shift also get the survey in the app on the Friday of survey week, with their days filled in from their trips to confirm or change.' },
    { label: 'From', value: 'Your name, sent by Shift. Replies and opt-outs go to Green Streets Initiative.' },
  ]

  return (
    <div>
      <TabHead
        title="Emails, reminders and the open link"
        sub={
          survey.status === 'draft'
            ? `Open the survey when you want the first email to go. Staff answer about ${weekLabel(survey.week_start)}.`
            : survey.status === 'open'
              ? `${sent} of ${people.length} have their link; ${responded} ${responded === 1 ? 'has' : 'have'} answered. Answers close ${longDate(survey.closes_on)}.`
              : `Closed. ${responded} of ${people.length} on the list answered.`
        }
        action={action}
      />
      <dl className="grid gap-x-8 gap-y-4 px-6 py-5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-[14px] font-semibold text-ink-muted">{r.label}</dt>
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
