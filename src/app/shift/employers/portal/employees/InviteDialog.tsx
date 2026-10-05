'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Copy, Download, ExternalLink, Link as LinkIcon, Mail, Upload, X } from 'lucide-react'
import QRCode from 'qrcode'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import CodeChip from '@/components/employer/CodeChip'
import { useToast } from '@/components/employer/Toast'
import type { JoinPolicy } from '../_lib/portal-types'
import JoinPolicyLine from '../_components/JoinPolicyLine'
import TabStrip, { tabPanelProps } from '../_components/TabStrip'
import InviteEmailPreview from './InviteEmailPreview'

/** The most addresses one batch sends; paste the rest after these go out. */
export const INVITE_BATCH_CAP = 500

/** What the invite dialog tells the employee, in words. Also shown on InvitedCard. */
export const INVITE_NOTE =
  'We send one invitation now and one reminder a week later. Employees who join disappear from the list. Nobody gets a third email.'

const SHARE_KIT = '/shift/employers/portal/share-kit'

const EMAIL_RE = /^[^\s@<>()[\],;:"']+@[^\s@<>()[\],;:"']+\.[a-z]{2,}$/i

const REASONS: Record<string, string> = {
  forbidden: 'Only an admin on your team can send invitations.',
  no_access: 'Your plan is not active right now, so invitations are paused.',
}

export type ParsedEmails = { valid: string[]; wrong: string[] }

/**
 * Pull email addresses out of anything pasted or uploaded: commas, spaces,
 * newlines, semicolons and tabs all separate; "Name <email>" keeps the
 * address and drops the name; CSV cells that are not emails (headers,
 * names) are ignored. Tokens with an @ that still do not look like an
 * address are reported as "look wrong" so the admin can fix them.
 */
export function parseEmails(text: string): ParsedEmails {
  const seen = new Set<string>()
  const valid: string[] = []
  const wrong: string[] = []
  const bracketed: string[] = []
  const rest = text.replace(/<([^<>]*)>/g, (_m, inner: string) => {
    bracketed.push(inner)
    return ' '
  })
  const tokens = [...bracketed, ...rest.split(/[\s,;]+/)]
  for (const raw of tokens) {
    const t = raw
      .trim()
      .replace(/^["'([]+/, '')
      .replace(/["')\].,;:]+$/, '')
      .toLowerCase()
    if (!t || !t.includes('@')) continue
    if (seen.has(t)) continue
    seen.add(t)
    if (EMAIL_RE.test(t)) valid.push(t)
    else wrong.push(t)
  }
  return { valid, wrong }
}

type AddResult = {
  ok: boolean
  reason?: string
  added?: number
  already_invited?: number
  already_members?: number
  unsubscribed?: number
  invalid?: number
  total_pending?: number
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** "21 invitations are on their way. 2 were already on your team." */
export function summarize(r: AddResult, sentNow: boolean): string {
  const parts: string[] = []
  const added = r.added ?? 0
  if (added > 0) {
    parts.push(
      sentNow
        ? `${plural(added, 'invitation is', 'invitations are')} on their way.`
        : `${plural(added, 'invitation', 'invitations')} will go out within the hour.`,
    )
  } else {
    parts.push('Nobody new to invite.')
  }
  if (r.already_members) parts.push(`${r.already_members} ${r.already_members === 1 ? 'was' : 'were'} already on your team.`)
  if (r.already_invited) parts.push(`${r.already_invited} ${r.already_invited === 1 ? 'was' : 'were'} already invited.`)
  if (r.unsubscribed) parts.push(`${r.unsubscribed} asked not to be emailed.`)
  if (r.invalid) parts.push(`${r.invalid} ${r.invalid === 1 ? 'was not' : 'were not'} a valid address.`)
  return parts.join(' ')
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type InviteTab = 'email' | 'share'

const TABS: { id: InviteTab; label: string }[] = [
  { id: 'email', label: 'Email a list' },
  { id: 'share', label: 'Share a link, code or flyer' },
]

export type InvitePanelProps = {
  groupId: string
  groupName: string
  inviteCode: string
  joinPolicy: JoinPolicy
  sessionEmail: string | null
  /** Admins, managers and GSI staff can send invitations. */
  canSend: boolean
  /** Admins can change who can join. */
  canManageAccount: boolean
  /** Called after invitations were added, so the Invited list can reload. */
  onSent: () => void
  /** Called after a send goes through, so a dialog can close itself. */
  onDone?: () => void
  /** A Cancel control for the dialog's footer; the inline panel has none. */
  cancel?: ReactNode
  initialTab?: InviteTab
  /** Makes the tab ids unique when two panels are on the page. */
  prefix?: string
}

/**
 * Everything that gets people onto the team, in two tabs: "Email a list"
 * (paste and CSV upload side by side; GSI does the sending) and "Share a
 * link, code or flyer" (the join link, invite code and QR, with the full
 * Share kit a click away). Shown inline on Employees until the first person
 * joins, and in InviteDialog after that (Keith 2026-10-05: the CSV upload
 * was hidden under the roster, where new admins never found it).
 */
export function InvitePanel({
  groupId,
  groupName,
  inviteCode,
  joinPolicy,
  sessionEmail,
  canSend,
  canManageAccount,
  onSent,
  onDone,
  cancel,
  initialTab,
  prefix = 'invite',
}: InvitePanelProps) {
  const toast = useToast()
  const [tab, setTab] = useState<InviteTab>(initialTab ?? (canSend ? 'email' : 'share'))
  const [text, setText] = useState('')
  const [fileEmails, setFileEmails] = useState<string[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const joinUrl = `https://shift.gogreenstreets.org/join/${inviteCode}`

  const parsed = useMemo(() => parseEmails(`${text}\n${fileEmails.join('\n')}`), [text, fileEmails])
  const overCap = parsed.valid.length > INVITE_BATCH_CAP
  const toSend = overCap ? parsed.valid.slice(0, INVITE_BATCH_CAP) : parsed.valid
  const preview = parsed.valid.slice(0, 5)

  // The QR only once the Share tab is opened; the same one the Share kit draws.
  useEffect(() => {
    if (tab !== 'share' || qrDataUrl) return
    QRCode.toDataURL(joinUrl, { margin: 1, width: 200, color: { dark: '#191A2E', light: '#ffffff' } }).then(
      setQrDataUrl,
    )
  }, [tab, qrDataUrl, joinUrl])

  async function handleFile(file: File) {
    setFileError('')
    if (file.size > 2 * 1024 * 1024) {
      setFileError('That file is over 2 MB. Export just the email column and try again.')
      return
    }
    try {
      const content = await file.text()
      const found = parseEmails(content)
      if (found.valid.length === 0 && found.wrong.length === 0) {
        setFileError("We couldn't find any email addresses in that file. It should be a CSV with one address per row.")
        setFileEmails([])
        setFileName(null)
        return
      }
      setFileEmails([...found.valid, ...found.wrong])
      setFileName(file.name)
    } catch {
      setFileError("We couldn't read that file. Please try a CSV or plain text file.")
    }
  }

  async function send() {
    if (sending || toSend.length === 0) return
    setSending(true)
    setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('add_employer_invitations', {
        p_group_id: groupId,
        p_emails: toSend,
        p_invited_by: sessionEmail,
      })
      const result = (data ?? null) as AddResult | null
      if (rpcErr || !result) {
        setError("We couldn't save the list. Check your connection and try again.")
        return
      }
      if (!result.ok) {
        setError(REASONS[result.reason ?? ''] ?? "We couldn't save the list. Please try again.")
        return
      }

      // Ask the sender to run now. If it cannot, the hourly run picks these up.
      let sentNow = false
      if ((result.added ?? 0) > 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            const res = await fetch('/api/employer/invitations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ group_id: groupId }),
            })
            const json = (await res.json().catch(() => null)) as { queued?: boolean } | null
            sentNow = res.ok && !json?.queued
          }
        } catch {
          sentNow = false
        }
      }

      posthog.capture('portal_invitations_added', {
        employer_group_id: groupId,
        count: result.added ?? 0,
        already_invited: result.already_invited ?? 0,
        already_members: result.already_members ?? 0,
        via_file: fileEmails.length > 0,
        sent_now: sentNow,
      })
      toast(summarize(result, sentNow), { type: (result.added ?? 0) > 0 ? 'success' : 'default' })
      setText('')
      setFileEmails([])
      setFileName(null)
      onSent()
      onDone?.()
    } catch {
      setError("We couldn't save the list. Check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  function copy(value: string, field: string) {
    navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField((c) => (c === field ? null : c)), 2000)
  }

  async function shareLink() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${groupName} on Shift`,
          text: `Join ${groupName} on Shift and start tracking your team's active commutes.`,
          url: joinUrl,
        })
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    copy(joinUrl, 'link')
  }

  function downloadQr() {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `${groupName.toLowerCase().replace(/\s+/g, '-')}-shift-qr.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const count = parsed.valid.length
  const countLine =
    count === 0 && parsed.wrong.length === 0
      ? 'No addresses yet'
      : `${plural(count, 'address', 'addresses')} found${
          parsed.wrong.length > 0 ? ` · ${parsed.wrong.length} look${parsed.wrong.length === 1 ? 's' : ''} wrong` : ''
        }`

  const field = 'block text-[13px] font-semibold text-ink'
  const inputBox =
    'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent-soft'

  return (
    <div>
      <TabStrip tabs={TABS} value={tab} onChange={setTab} label="How to invite" prefix={prefix} />

      {/* Email a list */}
      <div {...tabPanelProps(prefix, 'email')} hidden={tab !== 'email'} className="pt-4 outline-none">
        <JoinPolicyLine policy={joinPolicy} canManage={canManageAccount} groupId={groupId} />

        {!canSend && (
          <p className="mt-4 text-[13.5px] leading-[1.5] text-ink-muted">
            Only portal admins and managers can send invitations. You can still share the link, code or flyer.
          </p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className={field}>Paste work emails</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              disabled={!canSend}
              placeholder={'sam@yourcompany.com, priya@yourcompany.com\nOne per line works too.'}
              className={`mt-1.5 resize-y ${inputBox} disabled:opacity-60`}
            />
            <span className="mt-1.5 block text-[12.5px] leading-[1.5] text-ink-muted">
              Commas, spaces, new lines or semicolons all work. Names next to addresses are dropped.
            </span>
          </label>

          <div>
            <span className={field}>Upload a CSV</span>
            <div className="mt-1.5 flex min-h-[158px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line bg-surface-2 px-4 py-5 text-center">
              <Upload size={20} strokeWidth={1.75} className="text-ink-muted" aria-hidden />
              {fileName ? (
                <>
                  <span className="break-all text-[13.5px] font-semibold text-ink">{fileName}</span>
                  <span className="text-[12.5px] text-ink-muted">{plural(fileEmails.length, 'address', 'addresses')}</span>
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={!canSend}>
                      Choose another file
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={X}
                      onClick={() => {
                        setFileEmails([])
                        setFileName(null)
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[13.5px] leading-[1.5] text-ink-muted">
                    An export from your HR system or a spreadsheet. One email per row; other columns are ignored.
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Upload}
                    onClick={() => fileRef.current?.click()}
                    disabled={!canSend}
                    className="mt-1"
                  >
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
            {fileError && <p className="mt-2 text-[12.5px] text-ep-danger">{fileError}</p>}
          </div>
        </div>

        <div className="mt-4 rounded-[12px] border border-line bg-surface-2 px-4 py-3">
          <div className="text-[13.5px] font-semibold text-ink" aria-live="polite">
            {countLine}
          </div>
          {preview.length > 0 && (
            <p className="mt-1 break-words text-[12.5px] leading-[1.5] text-ink-muted">
              {preview.join(', ')}
              {count > preview.length ? ` and ${count - preview.length} more` : ''}
            </p>
          )}
          {parsed.wrong.length > 0 && (
            <p className="mt-1.5 break-words text-[12.5px] leading-[1.5] text-ep-danger">
              Not sent, fix these: {parsed.wrong.slice(0, 5).join(', ')}
              {parsed.wrong.length > 5 ? ` and ${parsed.wrong.length - 5} more` : ''}
            </p>
          )}
          {overCap && (
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-muted">
              That is more than {INVITE_BATCH_CAP} addresses. We will send the first {INVITE_BATCH_CAP} now; paste the
              rest after these go out.
            </p>
          )}
        </div>

        <p className="mt-4 flex gap-2 text-[12.5px] leading-[1.55] text-ink-muted">
          <Mail size={15} strokeWidth={1.75} className="mt-[2px] shrink-0 text-ink-icon" />
          <span>{INVITE_NOTE}</span>
        </p>

        {/* What the employee receives */}
        <div className="mt-3 rounded-[10px] border border-line">
          <button
            type="button"
            aria-expanded={showEmail}
            onClick={() => setShowEmail(!showEmail)}
            className="flex w-full items-center justify-between rounded-[10px] px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          >
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
              <Mail size={15} strokeWidth={1.75} className="text-ink-muted" />
              How this looks to them
            </span>
            {showEmail ? (
              <ChevronUp size={16} className="text-ink-icon" />
            ) : (
              <ChevronDown size={16} className="text-ink-icon" />
            )}
          </button>
          {showEmail && (
            <div className="grid gap-3 border-t border-line px-4 py-4">
              <InviteEmailPreview groupId={groupId} />
              <p className="text-[12.5px] leading-[1.55] text-ink-muted">
                One reminder follows a week later for anyone who hasn&apos;t joined, then we leave them alone. Someone
                who opts out shows on the Invited list as &quot;Opted out&quot; and never gets the reminder.
              </p>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-[13px] text-ep-danger">{error}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {cancel}
          <Button
            variant="primary"
            icon={Mail}
            onClick={() => void send()}
            disabled={!canSend || sending || toSend.length === 0}
          >
            {sending
              ? 'Sending...'
              : toSend.length === 0
                ? 'Send invitations'
                : `Send ${plural(toSend.length, 'invitation', 'invitations')}`}
          </Button>
        </div>
      </div>

      {/* Share a link, code or flyer */}
      <div {...tabPanelProps(prefix, 'share')} hidden={tab !== 'share'} className="pt-4 outline-none">
        <p className="text-[13.5px] leading-[1.5] text-ink-muted">
          Whichever one an employee uses, they land in {groupName}&apos;s group with trip tracking on.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <span className={field}>Join link</span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={joinUrl}
                aria-label="Join link"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/40"
              />
              <Button variant="primary" size="sm" icon={LinkIcon} onClick={() => void shareLink()}>
                {copiedField === 'link' ? 'Copied!' : 'Share'}
              </Button>
            </div>

            <span className={`${field} mt-4`}>Invite code</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <CodeChip code={inviteCode} />
              <Button variant="secondary" size="sm" icon={Copy} onClick={() => copy(inviteCode, 'code')}>
                {copiedField === 'code' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-muted">
              Employees type it in the Shift app: Community, then Join a workplace.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex h-[128px] w-[128px] items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-line">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR code for the join link" className="h-full w-full" />
              ) : (
                <span className="text-[13px] text-ink-tertiary">Generating...</span>
              )}
            </div>
            <button
              type="button"
              onClick={downloadQr}
              disabled={!qrDataUrl}
              className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline disabled:opacity-60"
            >
              <Download size={13} strokeWidth={2} />
              Download QR
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-ink">Messages, flyers and more</div>
            <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-muted">
              A ready-to-send note for Slack or email, printable flyers and your office pages are in the Share kit.
            </p>
          </div>
          <Link href={SHARE_KIT} className="contents">
            <Button variant="secondary" size="sm" iconRight={ExternalLink}>
              Open the Share kit
            </Button>
          </Link>
        </div>

        {cancel && <div className="mt-5 flex flex-wrap justify-end gap-2">{cancel}</div>}
      </div>
    </div>
  )
}

/**
 * The InvitePanel in a modal, for the Invite button once people have
 * joined. Focus moves in, Tab stays inside, Escape closes, focus returns.
 */
export default function InviteDialog({
  onClose,
  ...panel
}: Omit<InvitePanelProps, 'cancel' | 'onDone' | 'prefix'> & { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const first =
      panelRef.current?.querySelector<HTMLElement>('textarea:not([disabled]), [role="tab"][aria-selected="true"]') ??
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest('[hidden]'),
      )
      if (items.length === 0) return
      const firstItem = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        className="max-h-[calc(100vh-32px)] w-full max-w-[680px] overflow-y-auto rounded-[16px] bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="invite-title" className="text-[17px] font-bold text-ink">
              Invite employees
            </h2>
            <p className="mt-1 text-[13.5px] leading-[1.5] text-ink-muted">
              Give us a list and we send the invitations, or share the link, code or a flyer yourself.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <InvitePanel
          {...panel}
          prefix="invite-dialog"
          onDone={onClose}
          cancel={
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          }
        />
      </div>
    </div>
  )
}
