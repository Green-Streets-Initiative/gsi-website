'use client'

import posthog from 'posthog-js'

/**
 * The printed sheet is the artifact that ends up in an orientation packet or
 * a mailer, so the print/save is the outcome worth counting — the page's
 * $pageview only says someone opened the layout. `partner` comes from the
 * server page; the co-brand property is also registered session-wide in
 * PostHogProvider, but naming it on the event keeps the one query a partner
 * report actually needs to a single event.
 */
export default function PrintButton({ partner }: { partner?: string | null }) {
  return (
    <button
      type="button"
      onClick={() => {
        // Analytics is never a reason not to print.
        try {
          posthog.capture('snapshot_print_clicked', partner ? { partner } : {})
        } catch { /* blocked or not yet loaded */ }
        window.print()
      }}
      className="whitespace-nowrap rounded-full bg-[#BAF14D] px-5 py-2 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
    >
      Print or save as PDF
    </button>
  )
}
