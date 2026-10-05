'use client'

import Link from 'next/link'
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
  const { group, accessActive, isAdmin, isGsiAdmin } = usePortal()
  if (!group || accessActive) return null

  const ended = group.access_ends_at ? formatDate(group.access_ends_at) : null
  const paused = group.status === 'paused'

  return (
    <div className="mb-6 rounded-xl border border-[#E3C48C] bg-[#FBF4E6] px-5 py-4">
      <p className="text-[15px] font-bold text-ink">
        {paused ? 'Your plan is paused' : `Your workplace access ${ended ? `ended ${ended}` : 'has ended'}`}
      </p>
      <p className="mt-1.5 max-w-[62ch] text-[14px] leading-[1.5] text-ink-muted">
        {paused
          ? 'Your plan is paused. Write to info@gogreenstreets.org to pick it up again. Your team\u2019s history stays here and everyone keeps their personal trip tracking in the app.'
          : 'Your team\u2019s history stays here and everyone keeps their personal trip tracking in the app. To start new challenges again, get in touch and we\u2019ll pick up where you left off.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={
            paused
              ? `mailto:info@gogreenstreets.org?subject=${encodeURIComponent(`Resume our plan — ${group.name}`)}`
              : 'mailto:info@gogreenstreets.org?subject=Renewing%20our%20Shift%20workplace%20access'
          }
          className="inline-block rounded-[10px] bg-accent px-3.5 py-2 text-[13px] font-semibold text-white no-underline hover:bg-accent-dark"
        >
          {paused ? 'Write to us to pick it up again' : 'Talk to us about renewing'}
        </a>
        {(isAdmin || isGsiAdmin) && (
          <Link
            href="/shift/employers/portal/billing"
            className="inline-block rounded-[10px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-accent-ink no-underline hover:border-accent hover:text-accent"
          >
            See billing &amp; rewards
          </Link>
        )}
      </div>
    </div>
  )
}
