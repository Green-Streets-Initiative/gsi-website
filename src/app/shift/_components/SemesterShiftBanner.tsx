'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import StoreButtons from '@/components/StoreButtons'
import { resolveNewRoutesContext } from '@/lib/nearby/campaign'
import {
  SEMESTER_CODE, SEMESTER_CODE_LIVE, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS,
  isSemesterContext,
} from '@/lib/semester/campaign'
import { withUtm } from '@/lib/utm'

/**
 * Shift Your Semester hand-off banner at the top of /shift, for
 * utm_campaign=semester traffic (the worker's no-app fallback and any
 * newsletter/social link). States the reward, shows the code, and gives
 * attributed store buttons. Never renders alongside the New Routes banner —
 * one campaign per account, so one code per page.
 *
 * Client-only: reads window.location.search on mount and renders nothing
 * otherwise, so /shift stays static and this is pure progressive enhancement.
 */
export default function SemesterShiftBanner({ iosUrl, androidUrl }: { iosUrl: string; androidUrl: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!SEMESTER_CODE_LIVE) return
    const search = window.location.search
    if (!isSemesterContext(search)) return
    let cancelled = false
    void (async () => {
      // Async for the same reason as the New Routes banner: whether a
      // ?partner= co-brand counts as New Routes now lives on its row. Keeps
      // the one-campaign-per-page invariant true instead of racing it.
      if (await resolveNewRoutesContext(search)) return
      if (cancelled) return
      setShow(true)
      posthog.capture('semester_shift_banner_shown')
    })()
    return () => { cancelled = true }
  }, [])

  if (!show) return null

  const ios = iosUrl ? withUtm(iosUrl, { source: 'shift_page', medium: 'campaign_banner', campaign: 'semester' }) : ''
  const android = androidUrl ? withUtm(androidUrl, { source: 'shift_page', medium: 'campaign_banner', campaign: 'semester' }) : ''
  const live = !!(ios && android)

  return (
    <section className="border-b border-[#2E3252] bg-[#121320] px-6 py-8">
      <div className="mx-auto flex max-w-[900px] flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[54ch]">
          <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">Shift Your Semester</div>
          <h2 className="mt-2 font-display text-[clamp(22px,3vw,30px)] font-extrabold leading-tight text-white">
            Students: unlock {SEMESTER_REWARD} for getting around.
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-white/80">
            Take {SEMESTER_TRIPS} walking, biking, or transit trips in {SEMESTER_WINDOW_DAYS} days on Shift and unlock a{' '}
            {SEMESTER_REWARD} reward — a local shop or a digital gift card you choose. For students, faculty, and staff
            at Massachusetts colleges.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <span className="rounded-md border border-[#BAF14D]/40 bg-[#BAF14D]/10 px-2.5 py-1 font-mono text-[15px] font-bold tracking-wider text-[#BAF14D]">
              {SEMESTER_CODE}
            </span>
            <span className="text-[13px] leading-snug text-white/75">
              After you install, enter this code in the app, then verify your school email.
            </span>
          </div>
        </div>
        <div className="shrink-0">
          {live ? (
            <StoreButtons iosUrl={ios} androidUrl={android} />
          ) : (
            <p className="text-sm font-semibold uppercase tracking-widest text-[#BAF14D]">Coming soon to iOS &amp; Android</p>
          )}
        </div>
      </div>
    </section>
  )
}
