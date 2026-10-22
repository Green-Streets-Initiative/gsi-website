'use client'

// The workplace's own switch for the setup assistant (Shift 01372; Keith
// 2026-10-22, Loomis readiness). Shown where GSI offers the assistant. Admins
// turn it off or on; off holds for everyone here, GSI staff included. Links
// the public note a security review reads.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import Toggle from '@/components/employer/Toggle'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { useToast } from '@/components/employer/Toast'
import { usePortal } from '../_lib/portal-context'

export default function AssistantSettingsCard() {
  const { group, setGroup, isAdmin, isGsiAdmin } = usePortal()
  const confirm = useConfirm()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  // How many conversations this person has here: they can delete them from
  // this card, even while the assistant is off or no longer offered.
  const [mine, setMine] = useState<number | null>(null)
  const groupId = group?.id
  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      const t = data.session?.access_token
      if (!t) return
      const res = await fetch(`/api/employer/assistant?${new URLSearchParams({ group_id: groupId, list: '1' })}`, { headers: { Authorization: `Bearer ${t}` } })
      const j = (await res.json().catch(() => ({}))) as { threads?: unknown[] }
      if (!cancelled) setMine(j.threads?.length ?? 0)
    })()
    return () => {
      cancelled = true
    }
  }, [groupId])
  if (!group || (!group.assistant_enabled && !isGsiAdmin && !group.assistant_turned_off_at && !mine)) return null
  const on = !group.assistant_turned_off_at
  // Offered: GSI switched it on for this workplace (or GSI staff are looking).
  const offered = !!group.assistant_enabled || isGsiAdmin
  const canChange = (isAdmin || isGsiAdmin) && (offered || !on)

  async function change(next: boolean) {
    if (!group || saving || !canChange) return
    if (!next) {
      const ok = await confirm({
        title: 'Turn the assistant off?',
        body: 'Nobody can use it in this workplace until an admin turns it back on, Green Streets staff included. Conversations people already had stay private to them until they delete them or they reach 12 months.',
        confirmLabel: 'Turn off',
        tone: 'danger',
      })
      if (!ok) return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('set_employer_assistant', { p_group_id: group.id, p_on: next })
    setSaving(false)
    const res = data as { ok?: boolean; reason?: string } | null
    if (error || !res?.ok) {
      toast(
        res?.reason === 'forbidden'
          ? 'Only an admin can change this.'
          : res?.reason === 'not_offered'
            ? "Green Streets hasn't switched the assistant on for this workplace yet."
            : "That didn't save. Try again.",
        { type: 'error' },
      )
      return
    }
    setGroup({ ...group, assistant_turned_off_at: next ? null : new Date().toISOString() })
    toast(next ? 'The assistant is on.' : 'The assistant is off.', { type: 'success' })
  }

  async function deleteMine() {
    if (!group || !mine) return
    const ok = await confirm({
      title: `Delete your ${mine === 1 ? 'conversation' : `${mine} conversations`}?`,
      body: 'They go for good, with any staff lists attached to them. Anything the assistant set up (drafts, challenges, invitations) stays.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    const { data } = await supabase.auth.getSession()
    const t = data.session?.access_token
    if (!t) return
    const res = await fetch(`/api/employer/assistant?${new URLSearchParams({ group_id: group.id, all: '1' })}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } })
    if (!res.ok) {
      toast("That didn't go through. Try again.", { type: 'error' })
      return
    }
    setMine(0)
    toast('Your conversations are deleted.', { type: 'success' })
  }

  return (
    <Card id="assistant">
      <CardHead
        title="Setup assistant"
        sub="Sets things up with your team by conversation. Invitations, settings, money and anything employees would see wait for the person's approval; drafts are saved as you go."
      />
      <CardBody className="space-y-4">
        {canChange ? (
          <Toggle
            on={on}
            onChange={(v) => void change(v)}
            title={on ? 'The assistant is on for this workplace' : 'The assistant is off for this workplace'}
            desc={on ? 'Turn it off and nobody here can use it, Green Streets staff included.' : 'Turn it on and everyone on your portal team can use it again.'}
          />
        ) : (
          <p className="text-[14px] text-ink">
            {!offered
              ? "The assistant isn't offered for this workplace right now."
              : on
                ? 'The assistant is on for this workplace. Admins can turn it off.'
                : 'An admin turned the assistant off for this workplace. Admins can turn it back on.'}
          </p>
        )}
        {!group.assistant_enabled && isGsiAdmin && (
          <p className="text-[13px] text-ink-muted">GSI staff view: the assistant isn&apos;t offered to this workplace yet, so only GSI staff can use it here.</p>
        )}
        <p className="text-[13.5px] text-ink-muted">
          Conversations are private to each person and deleted 12 months after their last message.{' '}
          <a href="/shift/employers/assistant-data" target="_blank" rel="noopener" className="font-medium text-accent hover:underline">
            How the assistant handles your data
          </a>
          , for your IT or security team.
        </p>
        {!!mine && (
          <p className="text-[13.5px] text-ink-muted">
            You have {mine} {mine === 1 ? 'conversation' : 'conversations'} with the assistant here.{' '}
            <button type="button" onClick={() => void deleteMine()} className="font-medium text-accent hover:underline">
              Delete {mine === 1 ? 'it' : 'them'}
            </button>
          </p>
        )}
      </CardBody>
    </Card>
  )
}
