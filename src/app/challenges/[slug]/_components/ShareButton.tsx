'use client'

import { useState } from 'react'
import { track } from '../_lib/track'

/** The phone's share sheet where there is one; otherwise copies the link. */
export default function ShareButton({ url, title, compact = false }: { url: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function share() {
    track('creative_share_tap', { url })
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
    } catch { /* closed the sheet: fall through to copy */ }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* nothing to do */ }
  }
  return (
    <button type="button" onClick={share}
      className={compact
        ? 'inline-flex min-h-[44px] items-center font-bold text-forest underline-offset-4 hover:underline'
        : 'inline-flex min-h-[48px] items-center rounded-full border-2 border-navy px-6 text-[16px] font-bold text-navy hover:bg-navy/[0.06]'}>
      {copied ? 'Link copied' : 'Share'}
    </button>
  )
}
