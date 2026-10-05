'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { JoinPolicy } from '../_lib/portal-types'

const SETTING_HREF = '/shift/employers/portal/settings#who-can-join'

/** The choice in a few words, for the chip. Calls the code the invite code. */
const POLICY_WORDS: Record<JoinPolicy, string> = {
  open: 'Anyone with your invite code',
  work_email: 'Only people who confirm a work email',
  approval: 'Anyone, after an admin approves them',
}

/**
 * The "Who can join" setting as a control, not a caption (Keith 2026-10-05:
 * it was too small for what it governs). A bordered pill with a gear, the
 * policy in words (plus the company domains when a work email is required)
 * and a Change link to the setting. Shown under the Employees title and at
 * the top of the invite dialog's Email tab, so the setting is found from
 * the place it matters.
 */
export default function JoinPolicyLine({
  policy,
  canManage,
  groupId,
  className = '',
}: {
  policy: JoinPolicy
  canManage: boolean
  groupId: string
  className?: string
}) {
  const [domains, setDomains] = useState<string[]>([])

  // The domains only matter when a work email is required.
  useEffect(() => {
    if (policy !== 'work_email') return
    let cancelled = false
    supabase
      .from('employer_email_domains')
      .select('domain')
      .eq('group_id', groupId)
      .order('domain')
      .then(({ data }) => {
        if (!cancelled) setDomains((data ?? []).map((d: { domain: string }) => d.domain))
      })
    return () => {
      cancelled = true
    }
  }, [groupId, policy])

  const words =
    policy === 'work_email' && domains.length > 0
      ? `${POLICY_WORDS.work_email} (${domains.map((d) => `@${d}`).join(', ')})`
      : POLICY_WORDS[policy]

  return (
    <div
      className={`inline-flex max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-line bg-surface py-[7px] pl-3 pr-3.5 text-[13px] leading-[1.4] text-ink shadow-sm ${className}`}
    >
      <Settings size={16} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
      <span className="min-w-0">
        <span className="font-semibold">Who can join:</span> {words}
      </span>
      <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
      <Link href={SETTING_HREF} className="font-semibold text-accent hover:underline">
        {canManage ? 'Change' : 'See the setting'}
      </Link>
    </div>
  )
}
