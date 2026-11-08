'use client'

import posthog from 'posthog-js'
import { gaEvent } from '@/lib/ga'

/**
 * One short card pointing to /logan (Going to Logan together) from the
 * college pages and /parking/logan-airport. The parent decides whether it
 * shows (loganTogetherOpen() in lib/logan-together.ts); the click is
 * logan_together_click with the placement, in PostHog and GA4.
 * Plan: Shift docs/programs/launches/logan-together/plan.md.
 */
export default function LoganTogetherLine({
  title,
  placement,
  page,
}: {
  title: string
  placement: 'semester' | 'parking'
  page: string
}) {
  const href = `/logan?from=${placement}-${page}`
  return (
    <div className="mt-8 max-w-[640px] rounded-[16px] border border-navy/10 bg-white p-5 sm:p-6">
      <p className="text-[1.125rem] font-bold leading-snug text-navy">{title}</p>
      <p className="mt-2 text-[1rem] leading-[1.6] text-navy/80">
        Add your flight and we&apos;ll find someone going to Logan at the same time, and someone landing when you do
        on the way back. Take the T together or share a ride.
      </p>
      <a
        href={href}
        onClick={() => {
          const params = { placement, page }
          posthog.capture('logan_together_click', params)
          gaEvent('logan_together_click', params)
        }}
        className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-forest px-5 text-[1rem] font-bold text-white hover:opacity-90"
      >
        Go to Logan together
      </a>
    </div>
  )
}
