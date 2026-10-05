'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import type { Group, JoinPolicy } from '../_lib/portal-types'

const OPTIONS: { value: JoinPolicy; title: string; desc: string }[] = [
  {
    value: 'open',
    title: 'Anyone with your invite code',
    desc: 'Whoever enters the code or opens the link joins right away. The simplest choice.',
  },
  {
    value: 'work_email',
    title: 'Only people who confirm a work email',
    desc: 'They enter the code, then confirm an address at one of your company domains before they are in.',
  },
  {
    value: 'approval',
    title: 'Anyone, after an admin approves them',
    desc: 'They enter the code and wait. Requests show on the Employees page for an admin to approve or decline.',
  },
]

/** The choice's title, for one-line summaries elsewhere (JoinPolicyLine). */
export const JOIN_POLICY_TITLE = Object.fromEntries(OPTIONS.map((o) => [o.value, o.title])) as Record<JoinPolicy, string>

const CURRENT: Record<JoinPolicy, string> = {
  open: 'Right now, anyone who has your invite code can join.',
  work_email: 'Right now, people join once they confirm a work email at one of your company domains.',
  approval: 'Right now, people join once an admin approves their request on the Employees page.',
}

const REASONS: Record<string, string> = {
  no_email_domain: 'Add at least one company email domain first, in the card above.',
  invalid_policy: "That isn't a choice we recognise. Refresh the page and try again.",
  forbidden: 'Only an admin on your team can change this.',
}

const TIGHTEN_BODY: Record<Exclude<JoinPolicy, 'open'>, string> = {
  work_email: 'People who already joined stay. New joiners will need to confirm a work email.',
  approval: 'People who already joined stay. New joiners will wait until an admin approves them.',
}

/**
 * "Who can join your team": open (default), work email, or admin approval.
 * Saves on change. Tightening asks first; loosening just saves. The work
 * email choice needs a company domain (the card above); without one it is
 * disabled with the reason.
 */
export default function JoinPolicyCard({
  group,
  canManage,
  onChanged,
}: {
  group: Group
  canManage: boolean
  onChanged: (g: Group) => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const current: JoinPolicy = group.join_policy ?? 'open'
  const [domainCount, setDomainCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // The domains card above changes the list without telling us, so the
  // count is re-read whenever the pointer or focus comes back into this card.
  const loadDomains = useCallback(async () => {
    const { count } = await supabase
      .from('employer_email_domains')
      .select('domain', { count: 'exact', head: true })
      .eq('group_id', group.id)
    setDomainCount(count ?? 0)
  }, [group.id])

  useEffect(() => {
    void loadDomains()
  }, [loadDomains])

  const noDomains = domainCount === 0

  async function choose(next: JoinPolicy) {
    if (saving || next === current || !canManage) return
    setError('')
    if (next === 'work_email' && noDomains) {
      setError(REASONS.no_email_domain)
      return
    }
    // Anything but "open" adds a step for new joiners: say so before saving.
    if (next !== 'open') {
      const ok = await confirm({
        title: next === 'work_email' ? 'Require a work email to join?' : 'Require admin approval to join?',
        body: TIGHTEN_BODY[next],
        confirmLabel: 'Change it',
      })
      if (!ok) return
    }
    setSaving(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('set_group_join_policy', {
        p_group_id: group.id,
        p_policy: next,
      })
      const res = (data ?? null) as { ok?: boolean; join_policy?: JoinPolicy; reason?: string } | null
      if (rpcErr || !res?.ok) {
        const msg = REASONS[res?.reason ?? ''] ?? "We couldn't save that. Please try again."
        setError(msg)
        toast(msg, { type: 'error' })
        return
      }
      onChanged({ ...group, join_policy: res.join_policy ?? next })
      posthog.capture('portal_join_policy_changed', { employer_group_id: group.id, policy: res.join_policy ?? next })
      toast('Saved', { type: 'success' })
    } catch {
      const msg = "We couldn't save that. Please try again."
      setError(msg)
      toast(msg, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHead title="Who can join your team" sub="What happens when someone enters your invite code" />
      <CardBody>
        <fieldset
          disabled={!canManage || saving}
          className="m-0 min-w-0 border-0 p-0"
          onPointerEnter={() => void loadDomains()}
          onFocusCapture={() => void loadDomains()}
        >
          <legend className="sr-only">Who can join</legend>
          <div className="space-y-2.5">
            {OPTIONS.map((opt) => {
              const selected = current === opt.value
              const blocked = opt.value === 'work_email' && noDomains
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-[12px] border px-4 py-3 transition-colors ${
                    selected ? 'border-accent bg-accent-softer' : 'border-line bg-surface hover:bg-surface-2'
                  } ${blocked || !canManage ? 'cursor-default' : ''} ${blocked ? 'border-dashed bg-surface-2' : ''}`}
                >
                  <input
                    type="radio"
                    name="join-policy"
                    value={opt.value}
                    checked={selected}
                    disabled={blocked}
                    onChange={() => void choose(opt.value)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                      selected ? 'border-accent bg-accent text-white' : 'border-ink-icon bg-white'
                    }`}
                  >
                    {selected && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-ink">{opt.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-[1.5] text-ink-muted">{opt.desc}</span>
                    {blocked && (
                      <span className="mt-1 block text-[12.5px] leading-[1.5] text-ink-muted">
                        Needs a company email domain.{' '}
                        <a href="#email-domains" className="font-semibold text-accent hover:underline">
                          Add one above
                        </a>{' '}
                        and this option opens up.
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        {error && <p className="mt-3 text-[13px] text-ep-danger">{error}</p>}
        <p className="mt-4 border-t border-line-2 pt-3 text-[12.5px] leading-[1.5] text-ink-muted">
          {saving ? 'Saving...' : CURRENT[current]}
          {current !== 'open' && ' Employees need the current version of the Shift app to see the extra step; an older version shows the code as invalid until they update.'}
          {!canManage && ' Ask an admin to change this.'}
        </p>
      </CardBody>
    </Card>
  )
}
