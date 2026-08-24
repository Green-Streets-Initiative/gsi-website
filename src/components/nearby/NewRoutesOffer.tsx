'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { useNearbyT } from './NearbyI18n'
import { NEWROUTES_CODE } from '@/lib/nearby/campaign'

/**
 * The New Routes offer block, shown on /nearby when the page is in a New Routes
 * context (partner co-brand or utm_campaign=newroutes). States the reward the
 * campaign copy promises — which the snapshot page otherwise never mentions.
 *
 *  - `variant="splash"`  the fuller hero for the pre-location splash: shows the
 *                        NEWROUTES code + note (there's room, and it's the page's
 *                        main content).
 *  - `variant="compact"` the located view (under the headline on desktop / top of
 *                        the sheet on mobile). Text + CTA sit side by side on
 *                        wider screens to stay short; the code is NOT repeated
 *                        here — the /shift page this links to and the print sheet
 *                        both carry it.
 *
 * Reads copy via useNearbyT(), so it must render inside a NearbyI18nProvider
 * (all call sites are).
 */

// Full-colour Shift wordmark (transparent); rides a white tile so it stays
// legible on the dark card, matching how partner logos sit on white tiles.
const SHIFT_LOGO = '/assets/wayfinding/shift-wordmark.png'

export default function NewRoutesOffer({
  href,
  variant = 'compact',
  onCta,
}: {
  href: string
  variant?: 'splash' | 'compact'
  onCta?: () => void
}) {
  const tr = useNearbyT()

  useEffect(() => {
    posthog.capture('snapshot_newroutes_offer_shown', { variant })
  }, [variant])

  const eyebrow = (
    <div className="flex items-center gap-2">
      <span className="inline-flex shrink-0 items-center rounded-md bg-white px-1.5 py-[3px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SHIFT_LOGO} alt="Shift" className="h-3.5 w-auto" />
      </span>
      <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">
        {tr('newroutes.offer_eyebrow')}
      </span>
    </div>
  )

  const cta = (
    // Cross-origin app-open link (shift.gogreenstreets.org/go/newroutes) → a
    // plain anchor, not next/link (which is for in-app routes).
    <a
      href={href}
      onClick={onCta}
      className="inline-flex shrink-0 items-center rounded-lg bg-[#BAF14D] px-4 py-2 text-[0.8rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85"
    >
      {tr('newroutes.offer_cta')}
    </a>
  )

  if (variant === 'compact') {
    return (
      <div className="rounded-xl border border-[rgba(186,241,77,0.25)] bg-[linear-gradient(135deg,rgba(41,102,229,0.18),rgba(186,241,77,0.1))] px-4 py-3 text-left">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {eyebrow}
            <div className="mt-1 text-[0.95rem] font-bold leading-tight text-white">
              {tr('newroutes.offer_title')}
            </div>
            <p className="mt-0.5 text-[0.78rem] leading-snug text-white/80">
              {tr('newroutes.offer_body')}
            </p>
          </div>
          {cta}
        </div>
      </div>
    )
  }

  // splash — the fuller hero for the pre-location page (keeps the code + note)
  return (
    <div className="rounded-2xl border border-[rgba(186,241,77,0.25)] bg-[linear-gradient(135deg,rgba(41,102,229,0.18),rgba(186,241,77,0.1))] px-5 py-4 text-left">
      {eyebrow}
      <div className="mt-1.5 font-display text-[1.05rem] font-extrabold leading-tight text-white">
        {tr('newroutes.offer_title')}
      </div>
      <p className="mt-1 text-[0.82rem] leading-snug text-white/80">{tr('newroutes.offer_body')}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="shrink-0 rounded-md border border-[#BAF14D]/40 bg-[#BAF14D]/10 px-2 py-1 font-mono text-[0.8rem] font-bold tracking-wider text-[#BAF14D]">
          {NEWROUTES_CODE}
        </span>
        <span className="text-[0.72rem] leading-snug text-white/70">{tr('newroutes.offer_code_note')}</span>
      </div>
      <div className="mt-3">{cta}</div>
    </div>
  )
}
