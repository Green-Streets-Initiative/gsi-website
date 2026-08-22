'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { useNearbyT } from './NearbyI18n'
import { NEWROUTES_CODE } from '@/lib/nearby/campaign'

/**
 * The New Routes offer block, shown on /nearby when the page is in a New Routes
 * context (partner co-brand or utm_campaign=newroutes). States the reward the
 * campaign copy promises — which the snapshot page otherwise never mentions —
 * and shows the code the mover enters in the app so their reward is linked.
 *
 * `variant="splash"` renders its own card (pre-location splash); `"inline"`
 * renders bare content to sit inside the existing "Get the Shift app" card.
 * Reads copy from the nearby i18n dictionary via useNearbyT(), so it must be
 * rendered inside a NearbyI18nProvider (both call sites are).
 */
export default function NewRoutesOffer({
  href,
  variant = 'inline',
  onCta,
}: {
  href: string
  variant?: 'splash' | 'inline'
  onCta?: () => void
}) {
  const tr = useNearbyT()

  useEffect(() => {
    posthog.capture('snapshot_newroutes_offer_shown', { variant })
  }, [variant])

  const body = (
    <>
      <div className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">
        {tr('newroutes.offer_eyebrow')}
      </div>
      <div
        className={
          variant === 'splash'
            ? 'mt-1 font-display text-[1.05rem] font-extrabold leading-tight text-white'
            : 'mt-0.5 text-[0.95rem] font-bold text-white'
        }
      >
        {tr('newroutes.offer_title')}
      </div>
      <p className="mt-1 text-[0.82rem] leading-snug text-white/80">{tr('newroutes.offer_body')}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="shrink-0 rounded-md border border-[#BAF14D]/40 bg-[#BAF14D]/10 px-2 py-1 font-mono text-[0.8rem] font-bold tracking-wider text-[#BAF14D]">
          {NEWROUTES_CODE}
        </span>
        <span className="text-[0.72rem] leading-snug text-white/70">{tr('newroutes.offer_code_note')}</span>
      </div>
      <Link
        href={href}
        onClick={onCta}
        className="mt-3 inline-block rounded-lg bg-[#BAF14D] px-4 py-2 text-[0.8rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85"
      >
        {tr('newroutes.offer_cta')}
      </Link>
    </>
  )

  if (variant === 'splash') {
    return (
      <div className="rounded-2xl border border-[rgba(186,241,77,0.25)] bg-[linear-gradient(135deg,rgba(41,102,229,0.18),rgba(186,241,77,0.1))] px-5 py-4 text-left">
        {body}
      </div>
    )
  }
  return <div className="text-left">{body}</div>
}
