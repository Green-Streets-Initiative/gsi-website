'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import { computeSetupSteps } from '../_lib/setup-steps'

// Portal-wide onboarding thread: while setup is incomplete, a slim bar under
// the Topbar keeps the flow present wherever a setup step took the user —
// no back buttons needed. Disappears permanently once every step is done.
export default function SetupProgressBanner() {
  const pathname = usePathname()
  const { group, benefitsForm, memberCount, challenges, loading } = usePortal()

  if (loading || !group) return null
  if (pathname.startsWith('/shift/employers/portal/setup')) return null

  const steps = computeSetupSteps({ group, benefitsForm, memberCount, challenges })
  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null

  const next = steps.find((s) => !s.done)

  return (
    <Link
      href="/shift/employers/portal/setup"
      className="flex items-center justify-between gap-3 border-b border-line bg-accent-softer px-6 py-2 no-underline transition-colors hover:bg-accent-soft"
    >
      <span className="min-w-0 truncate text-[13px] text-ink">
        <strong className="font-semibold">
          Setup: {done} of {steps.length} complete
        </strong>
        {next && <span className="text-ink-muted"> · next: {next.label}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">
        Continue <ArrowRight size={14} strokeWidth={2} />
      </span>
    </Link>
  )
}
