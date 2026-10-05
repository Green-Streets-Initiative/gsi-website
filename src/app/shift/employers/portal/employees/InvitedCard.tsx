'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Mail, Search, Trash2 } from 'lucide-react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import Badge from '@/components/employer/Badge'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { formatDate, formatDateShort } from '../_lib/portal-utils'
import { INVITE_NOTE } from './InviteDialog'

export type InvitationStatus = 'pending' | 'sent' | 'reminded' | 'joined' | 'unsubscribed' | 'bounced'

export type Invitation = {
  id: string
  email: string
  status: InvitationStatus
  created_at: string
  sent_at: string | null
  reminded_at: string | null
  joined_at: string | null
}

const PAGE_SIZE = 50

/** The status in words a person would use. */
function statusWords(row: Invitation): { text: string; tone: 'success' | 'warn' | 'info' | 'neutral' } {
  switch (row.status) {
    case 'joined':
      return { text: row.joined_at ? `Joined ${formatDateShort(row.joined_at)}` : 'Joined', tone: 'success' }
    case 'reminded':
      return { text: row.reminded_at ? `Reminder sent ${formatDateShort(row.reminded_at)}` : 'Reminder sent', tone: 'info' }
    case 'sent':
      return { text: row.sent_at ? `Invite sent ${formatDateShort(row.sent_at)}` : 'Invite sent', tone: 'info' }
    case 'unsubscribed':
      return { text: 'Opted out', tone: 'neutral' }
    case 'bounced':
      return { text: "Couldn't be delivered", tone: 'warn' }
    default:
      return { text: 'Going out within the hour', tone: 'neutral' }
  }
}

function csvCell(v: string | number | null): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

/**
 * "Invited, not joined yet": everyone the company asked GSI to invite, where
 * each one stands, and a way to take someone off the list before the
 * reminder goes out. `version` bumps after the invite dialog sends so the
 * list reloads. `embedded` draws it as the body of a tab (no card, no
 * heading) and `onCount` reports how many are still waiting, for the tab's
 * label. The email preview lives in the invite dialog's Email tab.
 */
export default function InvitedCard({
  groupId,
  groupName,
  canManage,
  version,
  onInvite,
  embedded = false,
  onCount,
}: {
  groupId: string
  groupName: string
  canManage: boolean
  version: number
  onInvite: () => void
  embedded?: boolean
  onCount?: (waiting: number) => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [rows, setRows] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [q, setQ] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    supabase
      .from('employer_invitations')
      .select('id,email,status,created_at,sent_at,reminded_at,joined_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (cancelled) return
        // Before migration 01044 lands the table does not exist; that is
        // "nothing invited yet" for the admin, not an error.
        const notThereYet = error && /PGRST205|PGRST204|42P01|does not exist|schema cache/i.test(`${error.code} ${error.message}`)
        if (error && !notThereYet) {
          setLoadError("We couldn't load your invitations. Refresh the page to try again.")
        } else {
          setRows((data ?? []) as Invitation[])
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [groupId, version])

  const counts = useMemo(() => {
    let joined = 0
    let waiting = 0
    let optedOut = 0
    for (const r of rows) {
      if (r.status === 'joined') joined++
      else if (r.status === 'unsubscribed') optedOut++
      else if (r.status === 'pending' || r.status === 'sent' || r.status === 'reminded') waiting++
    }
    return { invited: rows.length, joined, waiting, optedOut }
  }, [rows])

  useEffect(() => {
    onCount?.(counts.waiting)
  }, [counts.waiting, onCount])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? rows.filter((r) => r.email.toLowerCase().includes(needle)) : rows
  }, [rows, q])
  const shown = filtered.slice(0, visible)

  async function remove(row: Invitation) {
    const ok = await confirm({
      title: `Remove ${row.email}?`,
      body:
        row.status === 'joined'
          ? 'This only takes them off the invitation list. They stay on your team.'
          : 'They will not get the reminder. You can invite them again later.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setRemoving(row.id)
    try {
      const { data, error } = await supabase.rpc('remove_employer_invitation', { p_id: row.id })
      const res = (data ?? null) as { ok?: boolean; reason?: string } | null
      if (error || !res?.ok) {
        toast(
          res?.reason === 'forbidden'
            ? 'Only an admin on your team can do that.'
            : "We couldn't remove that invitation. Please try again.",
          { type: 'error' },
        )
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      posthog.capture('portal_invitation_removed', { employer_group_id: groupId, status: row.status })
      toast('Removed from the list', { type: 'success' })
    } catch {
      toast("We couldn't remove that invitation. Please try again.", { type: 'error' })
    } finally {
      setRemoving(null)
    }
  }

  function exportCsv() {
    if (filtered.length === 0) return
    const header = ['Email', 'Status', 'Invited', 'Invite sent', 'Reminder sent', 'Joined']
    const lines = filtered.map((r) => [
      r.email,
      statusWords(r).text,
      r.created_at.split('T')[0],
      r.sent_at ? r.sent_at.split('T')[0] : '',
      r.reminded_at ? r.reminded_at.split('T')[0] : '',
      r.joined_at ? r.joined_at.split('T')[0] : '',
    ])
    const csv = [header, ...lines].map((l) => l.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${groupName.replace(/\s+/g, '-').toLowerCase() || 'team'}-invitations.csv`
    a.click()
    URL.revokeObjectURL(url)
    posthog.capture('portal_invitations_exported', { employer_group_id: groupId, count: filtered.length })
  }

  const stat = (label: string, value: number) => (
    <div className="min-w-0">
      <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-tertiary">{label}</div>
      <div className="text-[20px] font-bold leading-tight text-ink">{value}</div>
    </div>
  )

  const body = loading ? (
    <div className="px-6 py-10 text-center text-[14px] text-ink-tertiary">Loading...</div>
  ) : loadError ? (
    <div className="px-6 py-10 text-center text-[14px] text-ink-muted">{loadError}</div>
  ) : rows.length === 0 ? (
    <CardBody>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="text-[14px] text-ink-muted">Nobody invited yet. Paste a list and we do the sending.</p>
        {canManage ? (
          <Button variant="secondary" size="sm" icon={Mail} onClick={onInvite}>
            Invite employees
          </Button>
        ) : (
          <p className="text-[12.5px] text-ink-tertiary">Only portal admins can send invitations.</p>
        )}
      </div>
      <p className="mt-2 text-center text-[12.5px] leading-[1.55] text-ink-tertiary">{INVITE_NOTE}</p>
    </CardBody>
  ) : (
    <>
      {/* Counts */}
      <div className="grid grid-cols-2 gap-4 border-b border-line-2 px-6 py-4 sm:grid-cols-4">
        {stat('Invited', counts.invited)}
        {stat('Joined', counts.joined)}
        {stat('Waiting', counts.waiting)}
        {stat('Opted out', counts.optedOut)}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 border-b border-line-2 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-[240px]">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-icon"
          />
          <input
            type="search"
            aria-label="Search invitations"
            placeholder="Search by email"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setVisible(PAGE_SIZE)
            }}
            className="h-[34px] w-full rounded-[10px] border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-tertiary outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={filtered.length === 0}>
          Export CSV
        </Button>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="px-6 py-10 text-center text-[14px] text-ink-tertiary">No invitations match your search.</div>
      ) : (
        <>
          <ul className="divide-y divide-line-2">
            {shown.map((r) => {
              const s = statusWords(r)
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-ink">{r.email}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={s.tone}>{s.text}</Badge>
                      <span className="text-[12px] text-ink-tertiary">Added {formatDate(r.created_at)}</span>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      aria-label={`Remove ${r.email}`}
                      onClick={() => void remove(r)}
                      disabled={removing === r.id}
                    >
                      Remove
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          {filtered.length > shown.length && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-2 px-6 py-3">
              <span className="text-[12.5px] text-ink-tertiary">
                Showing {shown.length} of {filtered.length}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
      <div className="border-t border-line-2 px-6 py-3">
        <p className="text-[12.5px] leading-[1.55] text-ink-muted">{INVITE_NOTE}</p>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div>
        <p className="px-6 pt-4 text-[13.5px] leading-[1.5] text-ink-muted">
          People you asked us to invite, and where each one stands.
        </p>
        {body}
      </div>
    )
  }

  return (
    <Card id="invite" className="scroll-mt-6">
      <CardHead
        title="Invited, not joined yet"
        sub="People you asked us to invite, and where each one stands."
        action={
          canManage ? (
            <Button variant="primary" size="sm" icon={Mail} onClick={onInvite}>
              Invite employees
            </Button>
          ) : undefined
        }
      />
      {body}
    </Card>
  )
}
