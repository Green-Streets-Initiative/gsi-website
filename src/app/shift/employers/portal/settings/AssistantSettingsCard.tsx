'use client'

// The workplace's own switch for the setup assistant (Shift 01372; Keith
// 2026-10-22, Loomis readiness). Shown where GSI offers the assistant. Admins
// turn it off or on; off holds for everyone here, GSI staff included. Links
// the public note a security review reads.

import { useState } from 'react'
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
  if (!group || (!group.assistant_enabled && !isGsiAdmin)) return null
  const on = !group.assistant_turned_off_at
  const canChange = isAdmin || isGsiAdmin

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

  return (
    <Card id="assistant">
      <CardHead
        title="Setup assistant"
        sub="Sets things up with your team by conversation. Anything your team or employees would see waits for the person's approval."
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
            {on ? 'The assistant is on for this workplace.' : 'An admin turned the assistant off for this workplace.'} Admins can change this.
          </p>
        )}
        {!group.assistant_enabled && isGsiAdmin && (
          <p className="text-[13px] text-ink-muted">GSI staff view: the assistant isn&apos;t offered to this workplace yet, so only GSI staff can use it here.</p>
        )}
        <p className="text-[13.5px] text-ink-muted">
          Conversations are private to each person and deleted after 12 months.{' '}
          <a href="/shift/employers/assistant-data" target="_blank" rel="noopener" className="font-medium text-accent hover:underline">
            How the assistant handles your data
          </a>
          , for your IT or security team.
        </p>
      </CardBody>
    </Card>
  )
}
