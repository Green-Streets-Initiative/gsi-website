'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import { computeSetupSteps, nextSetupStep } from '../_lib/setup-steps'

// Portal-wide onboarding thread: while setup is incomplete, a slim bar under
// the Topbar keeps the next task present wherever the person is. It stays
// out of the way on the Setup page itself, while the agreement gate is up
// (nothing behind it can be done yet) and for viewers, who cannot act on it.
export default function SetupProgressBanner() {
  const pathname = usePathname()
  const { group, benefitsForm, memberCount, challenges, loading, agreementGated, isAdmin, isGsiAdmin } =
    usePortal()

  if (loading || !group) return null
  if (agreementGated) return null
  if (!isAdmin && !isGsiAdmin) return null
  if (pathname.startsWith('/shift/employers/portal/setup')) return null

  const steps = computeSetupSteps({ group, benefitsForm, memberCount, challenges })
  const next = nextSetupStep(steps)
  if (!next) return null
  const done = steps.filter((s) => s.done).length

  return (
    <Link
      href={next.route ?? '/shift/employers/portal/setup'}
      className="flex items-center justify-between gap-3 border-b border-line bg-accent-softer px-4 py-2 no-underline transition-colors hover:bg-accent-soft sm:px-6"
    >
      <span className="min-w-0 truncate text-[13px] text-ink">
        <strong className="font-semibold">
          Setup: {done} of {steps.length}
        </strong>
        <span className="text-ink-muted"> · Next: {next.label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">
        Continue <ArrowRight size={14} strokeWidth={2} />
      </span>
    </Link>
  )
}
