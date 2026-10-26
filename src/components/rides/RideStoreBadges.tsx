'use client'

import { useSyncExternalStore, type ComponentProps } from 'react'
import StoreBadges from '@/components/StoreBadges'

/** A Shift referral code: 8 hex characters. */
const REF_RE = /^[0-9A-F]{8}$/

/** The page's ?ref=, if it is a referral code. Fixed for the page's life. */
function linkRef(): string | null {
  const r = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() ?? ''
  return REF_RE.test(r) ? r : null
}
const noSubscribe = () => () => {}

/**
 * The store badges on a ride page, plus the hand-off into the app. A store
 * install drops the link, so a badge tap copies "SHIFT-<ride code>" to the
 * clipboard, with "+<friend's code>" when the link came from someone's
 * invite (?ref=). The app reads that once on first open: it opens the join
 * screen for this ride and credits the friend. Same hand-off as the Worker's
 * /join/CODE page (docs/cloudflare-worker-refer.js in the Shift repo).
 */
export default function RideStoreBadges({ code, ...badges }: { code: string } & ComponentProps<typeof StoreBadges>) {
  // Client-only: the server render doesn't see the visitor's link.
  const friendRef = useSyncExternalStore(noSubscribe, linkRef, () => null)

  // Capture phase, so the copy starts inside the tap, before the store tab opens.
  const copyOnStoreTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.target as Element).closest('a')) return
    const text = `SHIFT-${code.toUpperCase()}${friendRef ? `+${friendRef}` : ''}`
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div onClickCapture={copyOnStoreTap}>
      <StoreBadges {...badges} />
      {friendRef && <p className="mt-2 text-[13px] leading-snug text-(--ev-ink-80)">Get Shift here and your friend&rsquo;s invite comes with you.</p>}
    </div>
  )
}
