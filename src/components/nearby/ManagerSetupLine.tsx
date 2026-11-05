'use client'

import { useMemo } from 'react'
import posthog from 'posthog-js'
import { useNearbyT } from './NearbyI18n'

/**
 * "Manage this building? Get your own link" for property managers who open a
 * building page from a /move-in outreach email (utm_campaign starting
 * 'movein-'). The emails lead with the building page, and the page had no way
 * on to setup: in the first week 3 people opened it and none reached /move-in
 * (housing item 7, 2026-11-05). Residents never arrive with that tag, and a
 * page that already carries a partner is already set up, so both see nothing.
 *
 * The link opens /move-in with the same name/address (when the email carried
 * them) and the same utm tags, so a signup still traces to the email.
 */
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const

export function managerSetupHref(search: string): string | null {
  const p = new URLSearchParams(search)
  if (!(p.get('utm_campaign') ?? '').toLowerCase().startsWith('movein-')) return null
  if (p.get('partner')) return null
  const out = new URLSearchParams()
  const name = (p.get('name') ?? '').trim()
  const address = (p.get('address') ?? '').trim()
  if (name) out.set('name', name)
  if (address) out.set('address', address)
  for (const k of UTM_KEYS) {
    const v = p.get(k)
    if (v) out.set(k, v)
  }
  return `/move-in?${out.toString()}`
}

export default function ManagerSetupLine({ variant }: { variant: 'strip' | 'inline' }) {
  const tr = useNearbyT()
  // window.location, not useSearchParams: the first render can see empty
  // params (same reason NearbySnapshot reads partnerSlug this way).
  const href = useMemo(
    () => (typeof window === 'undefined' ? null : managerSetupHref(window.location.search)),
    [],
  )
  if (!href) return null

  const onClick = () => {
    const p = new URLSearchParams(window.location.search)
    posthog.capture('movein_setup_link_clicked', {
      from: 'building_page',
      variant,
      utm_campaign: p.get('utm_campaign') ?? undefined,
      utm_content: p.get('utm_content') ?? undefined,
    })
  }

  if (variant === 'strip') {
    return (
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-(--nb-line) bg-(--nb-panel) px-4">
        <span className="min-w-0 truncate text-[0.78rem] text-(--nb-ink-80)">{tr('manager.question')}</span>
        <a
          href={href}
          onClick={onClick}
          className="shrink-0 text-[0.78rem] font-bold text-(--nb-accent) transition-opacity hover:opacity-80"
        >
          {tr('manager.cta_short')} →
        </a>
      </div>
    )
  }

  return (
    <p className="text-[0.875rem] leading-relaxed text-(--nb-ink-80)">
      {tr('manager.line')}{' '}
      <a
        href={href}
        onClick={onClick}
        className="font-bold text-(--nb-accent) underline-offset-2 transition-opacity hover:underline hover:opacity-90"
      >
        {tr('manager.cta')} →
      </a>
    </p>
  )
}
