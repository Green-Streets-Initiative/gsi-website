'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, Mail, QrCode, Search, Send, Trash2, Upload, X } from 'lucide-react'
import QRCode from 'qrcode'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import Badge from '@/components/employer/Badge'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { parseStaff } from './staff-csv'
import { REASONS, SURVEY_LINK_BASE, type Person, type SurveyStatus } from './survey-types'

const PAGE_SIZE = 100

function statusWords(p: Person): { text: string; tone: 'success' | 'warn' | 'info' | 'neutral' } {
  if (p.responded) return { text: 'Responded', tone: 'success' }
  switch (p.status) {
    case 'reminded':
      return { text: 'Reminder sent', tone: 'info' }
    case 'sent':
      return { text: 'Link sent', tone: 'info' }
    case 'unsubscribed':
      return { text: 'Opted out', tone: 'neutral' }
    case 'bounced':
      return { text: "Couldn't be delivered", tone: 'warn' }
    default:
      return { text: 'Not sent yet', tone: 'neutral' }
  }
}

function csvCell(v: string | null | undefined): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

/** The survey email as staff receive it. */
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
            {k === 'invite' ? 'The survey email' : 'Reminder, three days later'}
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
 * The staff list: who gets a personal link, who has answered (yes or no,
 * never what), adding people from a CSV or a pasted list, sending and
 * reminders, and the open link and QR for staff without email.
 */
export default function StaffListCard({
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
  const [sending, setSending] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [showEmail, setShowEmail] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const openLink = `${SURVEY_LINK_BASE}/${survey.open_token}`
  const siteName = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s.name])), [sites])
  const parsed = useMemo(() => parseStaff(`${text}\n${fileText}`, sites), [text, fileText, sites])

  const pending = people.filter((p) => p.status === 'pending').length
  const waiting = people.filter((p) => !p.responded && (p.status === 'sent' || p.status === 'reminded')).length
  const responded = people.filter((p) => p.responded).length

  useEffect(() => {
    QRCode.toDataURL(openLink, { margin: 1, width: 240, color: { dark: '#191A2E', light: '#ffffff' } }).then(setQr)
  }, [openLink])

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

  async function sendNow(kind: 'links' | 'reminders') {
    const n = kind === 'links' ? pending : waiting
    const ok = await confirm({
      title: kind === 'links' ? `Send the survey to ${n} ${n === 1 ? 'person' : 'people'}?` : `Send a reminder to everyone who hasn't answered?`,
      body:
        kind === 'links'
          ? 'Each person gets their own link by email, in your name. People who have not answered after three days get one reminder.'
          : `${waiting} ${waiting === 1 ? 'person has' : 'people have'} a link and no answer yet. Reminders only go to people who were emailed at least three days ago and have not had one.`,
      confirmLabel: kind === 'links' ? 'Send the survey' : 'Send reminders',
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
    const header = ['Name', 'Email', 'Department', 'Site', 'Responded', 'Status']
    const lines = filtered.map((p) => [p.name, p.email, p.department, p.location_id ? siteName[p.location_id] : '', p.responded ? 'Yes' : 'No', statusWords(p).text])
    const csv = [header, ...lines].map((l) => l.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `survey-responded-list.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copy(v: string) {
    navigator.clipboard.writeText(v)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const field = 'block text-[13px] font-semibold text-ink'
  const inputBox =
    'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent-soft'

  return (
    <Card id="staff">
      <CardHead
        title="Staff list and sending"
        sub="Everyone on the list gets their own link by email. You see who has answered, never what anyone said."
        action={
          canManage && survey.status !== 'closed' ? (
            <Button variant="secondary" size="sm" icon={Upload} onClick={() => setAdding((v) => !v)}>
              {adding ? 'Hide' : 'Add people'}
            </Button>
          ) : undefined
        }
      />

      {adding && canManage && survey.status !== 'closed' && (
        <CardBody className="border-b border-line">
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
                Name, department and site are optional; email is what the link goes to. A Shift user on the list is matched to their account.
              </span>
            </label>
            <div>
              <span className={field}>Upload a CSV</span>
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
                      An HR export with columns for email and name; department and site or office columns are read too.
                    </span>
                    <Button variant="secondary" size="sm" icon={Upload} onClick={() => fileRef.current?.click()} className="mt-1">
                      Choose a CSV file
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
          <div className="mt-4 rounded-[12px] border border-line bg-surface-2 px-4 py-3">
            <div className="text-[13.5px] font-semibold text-ink" aria-live="polite">
              {parsed.rows.length === 0 && parsed.wrong.length === 0
                ? 'No addresses yet'
                : `${parsed.rows.length} ${parsed.rows.length === 1 ? 'person' : 'people'} found${parsed.wrong.length ? ` · ${parsed.wrong.length} look${parsed.wrong.length === 1 ? 's' : ''} wrong` : ''}`}
            </div>
            {parsed.rows.length > 0 && (
              <p className="mt-1 break-words text-[12.5px] leading-[1.5] text-ink-muted">
                {parsed.rows.slice(0, 4).map((r) => (r.name ? `${r.name} (${r.email})` : r.email)).join(', ')}
                {parsed.rows.length > 4 ? ` and ${parsed.rows.length - 4} more` : ''}
                {parsed.rows.some((r) => r.department) ? ' · departments read' : ''}
                {parsed.rows.some((r) => r.location_id) ? ' · sites matched' : ''}
              </p>
            )}
            {parsed.wrong.length > 0 && (
              <p className="mt-1.5 break-words text-[12.5px] leading-[1.5] text-ep-danger">
                Not added, fix these: {parsed.wrong.slice(0, 5).join(', ')}
                {parsed.wrong.length > 5 ? ` and ${parsed.wrong.length - 5} more` : ''}
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="primary" onClick={() => void addPeople()} disabled={saving || parsed.rows.length === 0}>
              {saving ? 'Saving...' : `Add ${parsed.rows.length || ''} to the list`}
            </Button>
          </div>
        </CardBody>
      )}

      {/* Sending */}
      {people.length > 0 && (
        <div className="grid gap-3 border-b border-line-2 px-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="text-[13.5px] leading-[1.5] text-ink-muted">
            {survey.status === 'draft' && 'Open the survey (top of the page) and the links can go out.'}
            {survey.status === 'open' && pending > 0 && `${pending} ${pending === 1 ? 'person has' : 'people have'} not been sent a link yet.`}
            {survey.status === 'open' && pending === 0 && waiting > 0 && `${waiting} ${waiting === 1 ? 'person has' : 'people have'} a link and no answer yet. A reminder goes out on its own three days after the first email.`}
            {survey.status === 'open' && pending === 0 && waiting === 0 && `${responded} of ${people.length} answered.`}
            {survey.status === 'closed' && `Closed. ${responded} of ${people.length} answered.`}
          </div>
          {canManage && survey.status === 'open' && (
            <div className="flex flex-wrap gap-2">
              {pending > 0 && (
                <Button variant="primary" size="sm" icon={Send} onClick={() => void sendNow('links')} disabled={sending}>
                  {sending ? 'Sending...' : `Send the survey to ${pending}`}
                </Button>
              )}
              {pending === 0 && waiting > 0 && (
                <Button variant="secondary" size="sm" icon={Mail} onClick={() => void sendNow('reminders')} disabled={sending}>
                  {sending ? 'Sending...' : 'Send reminders now'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* The email */}
      <div className="border-b border-line-2 px-6 py-3">
        <button
          type="button"
          aria-expanded={showEmail}
          onClick={() => setShowEmail((v) => !v)}
          className="flex items-center gap-2 text-[13.5px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Mail size={15} strokeWidth={1.75} className="text-ink-muted" />
          How the email looks to them
        </button>
        {showEmail && (
          <div className="mt-3">
            <EmailPreview surveyId={survey.id} />
          </div>
        )}
      </div>

      {/* People */}
      {people.length === 0 ? (
        <CardBody>
          <p className="text-[14px] text-ink-muted">Nobody on the list yet. Add names and work emails above, or share the open link below with staff who have no email.</p>
        </CardBody>
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
              {([['all', `All ${people.length}`], ['yes', `Responded ${responded}`], ['no', `Not yet ${people.length - responded}`]] as const).map(([v, l]) => (
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
                  <th className="px-3 py-2">Answered</th>
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

      {/* Open link */}
      <CardBody className="border-t border-line">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <QrCode size={16} strokeWidth={1.75} className="text-ink-muted" />
              Open link for staff without email
            </div>
            <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted">
              Print the QR for a break room or shift board. Answers through it count toward the totals as unmatched responses; they do not tick anyone off the list.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input type="text" readOnly value={openLink} aria-label="Open survey link" onFocus={(e) => e.currentTarget.select()} className={`${inputBox} min-w-0 flex-1 bg-surface-2 text-[13px]`} />
              <Button variant="secondary" size="sm" icon={Copy} onClick={() => copy(openLink)}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex h-[128px] w-[128px] items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-line">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR code for the open survey link" className="h-full w-full" />
              ) : (
                <span className="text-[13px] text-ink-tertiary">Generating...</span>
              )}
            </div>
            <a href={qr ?? '#'} download="commute-survey-qr.png" className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline">
              <Download size={13} strokeWidth={2} />
              Download QR
            </a>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
