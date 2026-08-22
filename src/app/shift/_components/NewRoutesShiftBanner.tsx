'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import StoreButtons from '@/components/StoreButtons'
import { NEWROUTES_CODE, isNewRoutesContext, storeUrlWithAttribution } from '@/lib/nearby/campaign'
import { parsePartnerSlug } from '@/lib/nearby/partner'

/**
 * New Routes hand-off banner at the top of /shift. A mover arriving from a
 * co-branded /nearby "Get Shift" CTA (or any utm_campaign=newroutes link) lands
 * here — this banner states the reward, shows the code they enter in the app so
 * their reward is linked, and gives attributed store buttons.
 *
 * Client-only: reads window.location.search on mount and renders nothing when
 * the page isn't in a New Routes context, so /shift stays static/ISR and the
 * banner is pure progressive enhancement for campaign traffic. Store URLs come
 * from the server page (env vars) as props.
 */
export default function NewRoutesShiftBanner({
  iosUrl,
  androidUrl,
}: {
  iosUrl: string
  androidUrl: string
}) {
  const [partner, setPartner] = useState<string | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const search = window.location.search
    if (!isNewRoutesContext(search)) return
    const slug = parsePartnerSlug(new URLSearchParams(search))
    setPartner(slug)
    setShow(true)
    posthog.capture('newroutes_shift_banner_shown', slug ? { partner: slug } : {})
  }, [])

  if (!show) return null

  const ios = iosUrl ? storeUrlWithAttribution(iosUrl, { partner }) : ''
  const android = androidUrl ? storeUrlWithAttribution(androidUrl, { partner }) : ''
  const live = !!(ios && android)

  return (
    <section className="border-b border-[#2E3252] bg-[#121320] px-6 py-8">
      <div className="mx-auto flex max-w-[900px] flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[54ch]">
          <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">
            New Routes reward
          </div>
          <h2 className="mt-2 font-display text-[clamp(22px,3vw,30px)] font-extrabold leading-tight text-white">
            Just moved? Earn $10 for getting around.
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-white/80">
            Take 10 walking, biking, or transit trips in your first 30 days on Shift and unlock a $10
            gift card at a local shop.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <span className="rounded-md border border-[#BAF14D]/40 bg-[#BAF14D]/10 px-2.5 py-1 font-mono text-[15px] font-bold tracking-wider text-[#BAF14D]">
              {NEWROUTES_CODE}
            </span>
            <span className="text-[13px] leading-snug text-white/75">
              After you install, enter this code in the app so your reward is linked.
            </span>
          </div>
        </div>
        <div className="shrink-0">
          {live ? (
            <StoreButtons iosUrl={ios} androidUrl={android} />
          ) : (
            <p className="text-sm font-semibold uppercase tracking-widest text-[#BAF14D]">
              Coming soon to iOS &amp; Android
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
