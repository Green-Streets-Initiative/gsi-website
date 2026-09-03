'use client'

import { usePortal } from '../_lib/portal-context'
import { formatDate } from '../_lib/portal-utils'

/**
 * Shown when an org's platform access window has closed.
 *
 * The server still lets a lapsed team sign in and read their history — that is
 * deliberate, so the portal explains itself instead of appearing broken — but
 * every write is refused. Without this banner the only symptom would be a save
 * button that quietly does nothing.
 */
export default function AccessLapsedNotice() {
  const { group, accessActive } = usePortal()
  if (!group || accessActive) return null

  const ended = group.access_ends_at ? formatDate(group.access_ends_at) : null

  return (
    <div className="mb-6 rounded-xl border border-amber-300/40 bg-amber-50/10 px-5 py-4">
      <p className="font-display text-[15px] font-bold text-white">
        Your workplace access {ended ? `ended ${ended}` : 'has ended'}
      </p>
      <p className="mt-1.5 max-w-[62ch] text-[14px] text-white/80">
        Your team&apos;s history stays here and everyone keeps their personal trip
        tracking in the app. To start new challenges again, get in touch and
        we&apos;ll pick up where you left off.
      </p>
      <a
        href="mailto:info@gogreenstreets.org?subject=Renewing%20our%20Shift%20workplace%20access"
        className="mt-3 inline-block rounded-lg bg-[#BAF14D] px-3.5 py-2 font-display text-[13px] font-semibold text-[#191A2E] no-underline hover:opacity-90"
      >
        Talk to us about renewing
      </a>
    </div>
  )
}
