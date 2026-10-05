'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, UserCheck, X } from 'lucide-react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import { formatDate } from '../_lib/portal-utils'
import type { JoinPolicy } from '../_lib/portal-types'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import Avatar from '@/components/employer/Avatar'
import { useToast } from '@/components/employer/Toast'

type JoinRequest = {
  id: string
  user_id: string
  name: string | null
  email: string | null
  requested_at: string
}

const REASONS: Record<string, string> = {
  forbidden: 'Only an admin on your team can do that.',
  not_found: 'That request is no longer waiting. Someone else may have handled it.',
  already_decided: 'That request was already handled.',
}

/**
 * "Waiting for approval": people who entered the invite code while the
 * join policy is "an admin approves". Shown whenever the policy needs it
 * or a request is still waiting from before the policy changed. `embedded`
 * draws it as the body of a tab (no card, no heading; the page decides
 * whether the tab shows) and `onCount` reports how many are waiting.
 */
export default function JoinRequestsCard({
  groupId,
  policy,
  canManage,
  embedded = false,
  onCount,
}: {
  groupId: string
  policy: JoinPolicy
  canManage: boolean
  embedded?: boolean
  onCount?: (waiting: number) => void
}) {
  const toast = useToast()
  const { refreshMembers, setMemberCount, memberCount } = usePortal()
  const [rows, setRows] = useState<JoinRequest[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const { data, error } = await supabase.rpc('get_group_join_requests', { p_group_id: groupId })
      const res = (data ?? null) as { ok?: boolean; rows?: JoinRequest[] } | null
      if (error || !res?.ok) {
        setLoadError("We couldn't load join requests. Refresh the page to try again.")
      } else {
        setRows(res.rows ?? [])
      }
    } catch {
      setLoadError("We couldn't load join requests. Refresh the page to try again.")
    } finally {
      setLoaded(true)
    }
  }, [groupId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (loaded) onCount?.(rows.length)
  }, [loaded, rows.length, onCount])

  async function decide(row: JoinRequest, approve: boolean) {
    if (busy) return
    setBusy(row.id)
    const who = row.name || 'This person'
    try {
      const { data, error } = await supabase.rpc('decide_group_join_request', {
        p_request_id: row.id,
        p_approve: approve,
      })
      const res = (data ?? null) as { ok?: boolean; reason?: string } | null
      if (error || !res?.ok) {
        toast(REASONS[res?.reason ?? ''] ?? "We couldn't save that decision. Please try again.", {
          type: 'error',
        })
        if (res?.reason === 'not_found' || res?.reason === 'already_decided') void load()
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      posthog.capture('portal_join_request_decided', { employer_group_id: groupId, approved: approve })
      if (approve) {
        toast(`${who} is on the team`, { type: 'success' })
        setMemberCount(memberCount + 1)
        void refreshMembers(30)
      } else {
        toast(`${who} was not added`, { type: 'default' })
      }
    } catch {
      toast("We couldn't save that decision. Please try again.", { type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  // Only worth a card when the policy asks for approval or someone is
  // still waiting from before it changed.
  if (!embedded && policy !== 'approval' && (!loaded || rows.length === 0)) return null

  const sub =
    policy === 'approval'
      ? 'People who entered your invite code. They join once an admin approves them.'
      : 'Requests from before you changed who can join. Approve or decline them to clear the list.'

  const body =
    !loaded ? (
        <div className="px-6 py-8 text-center text-[14px] text-ink-tertiary">Loading...</div>
      ) : loadError ? (
        <div className="px-6 py-8 text-center text-[14px] text-ink-muted">{loadError}</div>
      ) : rows.length === 0 ? (
        <CardBody>
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <UserCheck size={22} strokeWidth={1.75} className="text-ink-icon" />
            <p className="text-[14px] text-ink-muted">Nobody is waiting. New requests show up here.</p>
          </div>
        </CardBody>
      ) : (
        <ul className="divide-y divide-line-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={r.name || 'User'} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink">{r.name || 'Unnamed'}</div>
                  <div className="truncate text-[12.5px] text-ink-tertiary">
                    {r.email ? `${r.email} · ` : 'No work email on file · '}
                    Asked {formatDate(r.requested_at)}
                  </div>
                </div>
              </div>
              {canManage ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={X}
                    onClick={() => void decide(r, false)}
                    disabled={busy === r.id}
                  >
                    Decline
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Check}
                    onClick={() => void decide(r, true)}
                    disabled={busy === r.id}
                  >
                    Approve
                  </Button>
                </div>
              ) : (
                <span className="text-[12.5px] text-ink-tertiary">An admin can approve this</span>
              )}
            </li>
          ))}
        </ul>
      )

  if (embedded) {
    return (
      <div>
        <p className="px-6 pt-4 text-[13.5px] leading-[1.5] text-ink-muted">{sub}</p>
        {body}
      </div>
    )
  }

  return (
    <Card>
      <CardHead title="Waiting for approval" sub={sub} />
      {body}
    </Card>
  )
}
