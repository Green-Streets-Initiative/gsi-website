'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Mail, Send } from 'lucide-react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { usePortal } from '../_lib/portal-context'
import ChampionEmailPreview from './ChampionEmailPreview'

/** Same shape as the portal's EmployerChampion; declared here on purpose. */
type ChampionRow = { name: string; email: string }

type WelcomeRow = { email: string; welcomed_at: string | null; unsubscribed_at: string | null }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

function shortDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

function who(c: ChampionRow): string {
  return c.name.trim() || c.email.trim()
}

function listWords(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Under the champion list on Setup: who has had the welcome email, a button
 * that sends it to everyone who hasn't (after a confirmation naming them),
 * and the email itself. Saving Setup never sends; only this button does,
 * and each champion gets the welcome once (employer_champions, 01080).
 */
export default function ChampionWelcome({ champions }: { champions: ChampionRow[] }) {
  const { group, setGroup } = usePortal()
  const toast = useToast()
  const confirm = useConfirm()
  const [rows, setRows] = useState<WelcomeRow[]>([])
  const [sending, setSending] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const groupId = group?.id

  const load = useCallback(async () => {
    if (!groupId) return
    const { data, error } = await supabase
      .from('employer_champions')
      .select('email,welcomed_at,unsubscribed_at')
      .eq('group_id', groupId)
      .limit(500)
    // Before migration 01080 the table does not exist: nobody welcomed yet.
    if (!error) setRows((data ?? []) as WelcomeRow[])
  }, [groupId])

  useEffect(() => {
    void load()
  }, [load])

  const byEmail = useMemo(() => new Map(rows.map((r) => [r.email.toLowerCase(), r])), [rows])

  const { toSend, welcomed, optedOut, noEmail, badEmail } = useMemo(() => {
    const out = {
      toSend: [] as ChampionRow[],
      welcomed: [] as { c: ChampionRow; at: string }[],
      optedOut: [] as ChampionRow[],
      noEmail: [] as ChampionRow[],
      badEmail: [] as ChampionRow[],
    }
    const seen = new Set<string>()
    for (const raw of champions) {
      const c = { name: raw.name.trim(), email: raw.email.trim() }
      if (!c.name && !c.email) continue
      if (!c.email) {
        out.noEmail.push(c)
        continue
      }
      if (!EMAIL_RE.test(c.email)) {
        out.badEmail.push(c)
        continue
      }
      const key = c.email.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const row = byEmail.get(key)
      if (row?.unsubscribed_at) out.optedOut.push(c)
      else if (row?.welcomed_at) out.welcomed.push({ c, at: row.welcomed_at })
      else out.toSend.push(c)
    }
    return out
  }, [champions, byEmail])

  if (!group) return null
  const sampleName = (toSend[0]?.name || champions.find((c) => c.name.trim())?.name || '').trim().split(/\s+/)[0] ?? ''

  async function send() {
    if (!group || toSend.length === 0) return
    const n = toSend.length
    const ok = await confirm({
      title: `Send the welcome email to ${n} champion${n === 1 ? '' : 's'}?`,
      body: (
        <div className="grid gap-2">
          <ul className="grid gap-1">
            {toSend.map((c) => (
              <li key={c.email} className="text-[14px] text-ink">
                {c.name ? (
                  <>
                    <span className="font-semibold">{c.name}</span>{' '}
                    <span className="text-ink-muted">{c.email}</span>
                  </>
                ) : (
                  c.email
                )}
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-[1.5] text-ink-muted">
            Each person gets it once. Anyone you add later gets it the next time you press the button.
          </p>
        </div>
      ),
      confirmLabel: n === 1 ? 'Send it' : `Send ${n} emails`,
    })
    if (!ok) return
    setSending(true)
    try {
      // Keep the saved champion list in step with who was emailed. Only the
      // champions are saved here; the rest of the form saves with its button.
      const cleaned = champions
        .map((c) => ({ name: c.name.trim(), email: c.email.trim() }))
        .filter((c) => c.name || c.email)
      const onboarding = { ...(group.onboarding ?? {}), champions: cleaned }
      const { error: saveErr } = await supabase.from('groups').update({ onboarding }).eq('id', group.id)
      if (saveErr) {
        toast("We couldn't save your champions, so nothing was sent. Please try again.", { type: 'error' })
        return
      }
      setGroup({ ...group, onboarding })

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('signed out')
      const res = await fetch('/api/employer/champions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ group_id: group.id, champions: toSend }),
      })
      const json = (await res.json().catch(() => null)) as
        | { sent?: string[]; failed?: string[]; already?: string[]; opted_out?: string[]; error?: string }
        | null
      if (!res.ok) {
        toast(
          json?.error === 'not_ready'
            ? "Champion emails aren't switched on yet. Nothing was sent."
            : "We couldn't send the welcome email. Nothing was sent; please try again.",
          { type: 'error' },
        )
        return
      }
      const sent = json?.sent?.length ?? 0
      const failed = json?.failed?.length ?? 0
      posthog.capture('portal_champion_welcome_sent', {
        employer_group_id: group.id,
        sent,
        failed,
        already: json?.already?.length ?? 0,
        opted_out: json?.opted_out?.length ?? 0,
      })
      if (sent > 0 && failed === 0) {
        toast(`Welcome email sent to ${sent} champion${sent === 1 ? '' : 's'}`, { type: 'success' })
      } else if (sent > 0) {
        toast(`Sent to ${sent}. ${failed} didn't go through; press the button again to retry them.`, { type: 'error' })
      } else if (failed > 0) {
        toast("The welcome email didn't go through. Please try again.", { type: 'error' })
      } else {
        toast('Everyone on the list already has the welcome email.', { type: 'success' })
      }
    } catch {
      toast("We couldn't send the welcome email. Please try again.", { type: 'error' })
    } finally {
      setSending(false)
      void load()
    }
  }

  const named = welcomed.length + optedOut.length + toSend.length + noEmail.length + badEmail.length
  if (named === 0) return null

  return (
    <div className="mt-3 grid gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3.5">
      <p className="text-[13.5px] leading-[1.55] text-ink">
        Each champion can get one welcome email from us: what a champion does, your invite link, ready-to-post
        messages and the printable flyer. Nothing goes out until you press the button.
      </p>

      <ul className="grid gap-1 text-[13px] leading-[1.5] text-ink-muted">
        {welcomed.length > 0 && (
          <li>
            <span className="font-semibold text-ink">Welcome sent:</span>{' '}
            {listWords(welcomed.map(({ c, at }) => `${who(c)} (${shortDate(at)})`))}
          </li>
        )}
        {toSend.length > 0 && (
          <li>
            <span className="font-semibold text-ink">Not sent yet:</span> {listWords(toSend.map(who))}
          </li>
        )}
        {optedOut.length > 0 && (
          <li>
            <span className="font-semibold text-ink">Opted out of champion emails:</span>{' '}
            {listWords(optedOut.map(who))}
          </li>
        )}
        {noEmail.length > 0 && (
          <li>
            <span className="font-semibold text-ink">Add an email to send to:</span> {listWords(noEmail.map(who))}
          </li>
        )}
        {badEmail.length > 0 && (
          <li>
            <span className="font-semibold text-ink">Check the email for:</span> {listWords(badEmail.map(who))}
          </li>
        )}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" icon={Send} onClick={() => void send()} disabled={sending || toSend.length === 0}>
          {sending ? 'Sending…' : 'Send the welcome email'}
        </Button>
        {toSend.length === 0 && welcomed.length > 0 && (
          <span className="text-[13px] text-ink-muted">Every champion with an email has it.</span>
        )}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showEmail}
          onClick={() => setShowEmail(!showEmail)}
          className="flex items-center gap-2 rounded-[8px] py-1 text-left text-[13.5px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Mail size={15} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
          How this looks to them
          {showEmail ? (
            <ChevronUp size={16} className="text-ink-muted" aria-hidden="true" />
          ) : (
            <ChevronDown size={16} className="text-ink-muted" aria-hidden="true" />
          )}
        </button>
        {showEmail && (
          <div className="mt-3">
            <ChampionEmailPreview groupId={group.id} sampleName={sampleName} />
          </div>
        )}
      </div>
    </div>
  )
}
