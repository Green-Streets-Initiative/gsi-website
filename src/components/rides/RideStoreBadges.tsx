'use client'

import { useSyncExternalStore, type ComponentProps } from 'react'
import StoreBadges from '@/components/StoreBadges'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

/** A Shift referral code: 8 hex characters. */
// The picked date rides along as "@YYYY-MM-DD" so the app can mark them Going
// on it (rider review 2026-11-12). App builds up to Update 31 reject any
// suffix they don't know, so this stays off until the update that reads it
// is live; then flip it to true.
const HANDOFF_DATE = false

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
export default function RideStoreBadges({ code, date, locale = 'en', ...badges }: { code: string; date?: string | null; locale?: SiteLocale } & ComponentProps<typeof StoreBadges>) {
  const t = translator(ridesStrings, locale)
  // Client-only: the server render doesn't see the visitor's link.
  const friendRef = useSyncExternalStore(noSubscribe, linkRef, () => null)

  // Capture phase, so the copy starts inside the tap, before the store tab opens.
  const copyOnStoreTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.target as Element).closest('a')) return
    const when = HANDOFF_DATE && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `@${date}` : ''
    const text = `SHIFT-${code.toUpperCase()}${friendRef ? `+${friendRef}` : ''}${when}`
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div onClickCapture={copyOnStoreTap}>
      <StoreBadges {...badges} />
      {friendRef && <p className="mt-2 text-[13px] leading-snug text-(--ev-ink-80)">{t('badges.friend')}</p>}
    </div>
  )
}
