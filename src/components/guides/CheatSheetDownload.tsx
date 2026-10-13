'use client'

import posthog from 'posthog-js'
import { FilePdf } from '@phosphor-icons/react'
import { gaEvent } from '@/lib/ga'

/**
 * A printable one-page PDF for a guide, free with no sign-up. The click is the
 * guide's "meaningful action" for Google Ad Grants, so it fires the GA4 event
 * `cheat_sheet_download`. The PDF opens in a new tab (same as the store
 * badges) so this page stays loaded while the event is sent.
 */
export default function CheatSheetDownload({
  href,
  sheet,
  placement,
  label,
  detail,
  className = '',
}: {
  href: string
  /** Stable id for reporting, e.g. 't-cheat-sheet'. */
  sheet: string
  placement: string
  label: string
  detail: string
  className?: string
}) {
  const track = () => {
    const props = { sheet, placement }
    gaEvent('cheat_sheet_download', props)
    posthog.capture('cheat_sheet_download', props)
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      onClick={track}
      className={`group flex items-center gap-4 rounded-[14px] border-2 border-forest bg-white px-5 py-4 no-underline transition-colors hover:bg-forest/5 ${className}`}
    >
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-forest text-white">
        <FilePdf size={26} weight="regular" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[1rem] font-semibold leading-snug text-forest underline decoration-forest/40 underline-offset-4 group-hover:decoration-forest">
          {label}
        </span>
        <span className="mt-0.5 block text-[0.875rem] leading-snug text-ink-muted">{detail}</span>
      </span>
    </a>
  )
}
