'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { SEMESTER_CODE, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS } from '@/lib/semester/campaign'

/**
 * The join section of a school page. Two versions:
 *
 *  - Code live: the campaign is the primary card — open Shift (or get it),
 *    enter SEMESTER, verify your school email — with the group invite code
 *    and QR as the "already have the app" secondary path.
 *  - Code not live (pre-launch): the group join card alone, no code printed,
 *    so nothing promises a code the app doesn't accept yet.
 *
 * Client component so it can fire the PostHog events the web funnel needs.
 */
export default function SemesterJoinCard({
  schoolSlug,
  shortName,
  primaryDomain,
  appHref,
  joinUrl,
  inviteCode,
  qrSvg,
  codeLive,
}: {
  schoolSlug: string
  shortName: string
  primaryDomain: string | null
  appHref: string
  joinUrl: string
  inviteCode: string
  qrSvg: string
  codeLive: boolean
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    posthog.capture('semester_school_page_viewed', { school: schoolSlug, code_live: codeLive })
  }, [schoolSlug, codeLive])

  const track = (target: 'go_semester' | 'group_join_link' | 'qr') =>
    posthog.capture('semester_join_cta_clicked', { school: schoolSlug, target, code_live: codeLive })

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(SEMESTER_CODE)
      setCopied(true)
      posthog.capture('semester_code_copied', { surface: 'school_page', school: schoolSlug })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  }

  const groupCard = (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center">
        <a href={joinUrl} onClick={() => track('qr')} aria-label={`Join ${shortName} on Shift`}>
          <div className="flex h-[140px] w-[140px] items-center justify-center rounded-2xl bg-white p-2">
            <div className="h-[120px] w-[120px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
        </a>
        <p className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-white/75">Scan to join</p>
      </div>
      <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/75">
          {codeLive ? `Already have the app? Join the ${shortName} group directly` : 'Or enter the group code in the app'}
        </p>
        <p className="mb-3 font-mono text-2xl font-extrabold tracking-[0.2em] text-[#BAF14D]">{inviteCode}</p>
        <p className="text-sm leading-[1.6] text-white/85">
          In Shift, open the Community tab, tap the <strong className="text-white">+</strong> button, and enter the
          code.{' '}
          {codeLive
            ? `Joining the group on its own doesn't unlock the reward — the school-email check does. If you've verified, you're already in.`
            : `Your trips count for ${shortName} from that moment on.`}
        </p>
      </div>
    </div>
  )

  if (!codeLive) {
    return (
      <>
        <div className="mb-5 rounded-[14px] border border-[#BAF14D]/20 bg-[#BAF14D]/[0.06] p-6">
          <span className="mb-2 inline-block rounded-full bg-[#BAF14D]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#BAF14D]">
            Live now
          </span>
          <h2 className="mb-2 text-lg font-bold text-white">Join {shortName} in one tap</h2>
          <p className="mb-5 text-[0.9375rem] leading-[1.6] text-white/85">
            This link opens the Shift app and fills in {shortName}&rsquo;s join code. Don&rsquo;t have the app yet?
            The same link shows you download links first. Reward enrollment opens in the app shortly.
          </p>
          <a
            href={joinUrl}
            onClick={() => track('group_join_link')}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#BAF14D] px-8 py-4 text-center text-lg font-extrabold text-[#191A2E] transition-opacity hover:opacity-85 sm:w-auto"
          >
            {`Join ${shortName} on Shift`} &rarr;
          </a>
        </div>
        {groupCard}
      </>
    )
  }

  return (
    <>
      <div className="mb-5 rounded-[14px] border border-[#BAF14D]/20 bg-[#BAF14D]/[0.06] p-6">
        <span className="mb-2 inline-block rounded-full bg-[#BAF14D]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#BAF14D]">
          Live now
        </span>
        <h2 className="mb-2 text-lg font-bold text-white">Join {shortName} on Shift</h2>
        <p className="mb-5 text-[0.9375rem] leading-[1.6] text-white/85">
          Get the free app and enter code {SEMESTER_CODE}. Then verify your
          {primaryDomain ? <> @{primaryDomain}</> : ' school'} address inside the app — that puts you in {shortName}&rsquo;s
          group and starts your {SEMESTER_WINDOW_DAYS}-day clock: {SEMESTER_TRIPS} active trips unlock {SEMESTER_REWARD}.
          Your account can stay on any email.
        </p>
        <a
          href={appHref}
          onClick={() => track('go_semester')}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#BAF14D] px-8 py-4 text-center text-lg font-extrabold text-[#191A2E] transition-opacity hover:opacity-85 sm:w-auto"
        >
          Open Shift / Get the app &rarr;
        </a>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copyCode}
            className="rounded-md border border-[#BAF14D]/40 bg-[#BAF14D]/10 px-3 py-1.5 font-mono text-[15px] font-bold tracking-wider text-[#BAF14D] transition-colors hover:bg-[#BAF14D]/20"
            aria-label={`Copy code ${SEMESTER_CODE}`}
          >
            {copied ? 'Copied' : SEMESTER_CODE}
          </button>
          <span className="text-[13px] leading-snug text-white/75">
            Installing from the App Store or Google Play? Enter this code after you sign up — store installs
            don&rsquo;t carry the link.
          </span>
        </div>
      </div>
      {groupCard}
    </>
  )
}
