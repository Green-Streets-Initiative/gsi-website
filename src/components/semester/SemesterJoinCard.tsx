'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { PILL } from '@/components/org/Section'
import { SEMESTER_CODE, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS } from '@/lib/semester/campaign'

/**
 * The join section of a school page. Two versions:
 *
 *  - Code live: the campaign is the primary path — open Shift (or get it),
 *    enter SEMESTER, verify your school email — with the group invite code
 *    and QR as the "already have the app" secondary path.
 *  - Code not live (pre-launch): the group join link alone, no code printed,
 *    so nothing promises a code the app doesn't accept yet.
 *
 * Client component so it can fire the PostHog events the web funnel needs.
 * `capture={false}` on the staging routes keeps preview traffic out of it.
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
  capture = true,
}: {
  schoolSlug: string
  shortName: string
  primaryDomain: string | null
  appHref: string
  joinUrl: string
  inviteCode: string
  qrSvg: string
  codeLive: boolean
  capture?: boolean
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (capture) posthog.capture('semester_school_page_viewed', { school: schoolSlug, code_live: codeLive })
  }, [schoolSlug, codeLive, capture])

  const track = (target: 'go_semester' | 'group_join_link' | 'qr') => {
    if (capture) posthog.capture('semester_join_cta_clicked', { school: schoolSlug, target, code_live: codeLive })
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(SEMESTER_CODE)
      setCopied(true)
      if (capture) posthog.capture('semester_code_copied', { surface: 'school_page', school: schoolSlug })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_auto] md:gap-12">
      <div>
        <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] text-navy">
          {codeLive ? (
            <>
              Join {shortName} <em className="text-green-deep">on Shift.</em>
            </>
          ) : (
            <>
              Join {shortName} <em className="text-green-deep">in one tap.</em>
            </>
          )}
        </h2>
        <p className="mt-4 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
          {codeLive ? (
            <>
              Get the free app and enter code <span className="font-mono font-semibold text-navy">{SEMESTER_CODE}</span>. Then verify your
              {primaryDomain ? <> @{primaryDomain}</> : ' school'} address inside the app. That puts you in {shortName}&rsquo;s group and starts
              your {SEMESTER_WINDOW_DAYS}-day clock: {SEMESTER_TRIPS} active trips unlock {SEMESTER_REWARD}. Your account can stay on any email.
            </>
          ) : (
            <>
              This link opens the Shift app with {shortName}&rsquo;s join code filled in. No app yet? The same link shows you the download
              links first. Reward enrollment opens in the app shortly.
            </>
          )}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {codeLive ? (
            <a href={appHref} onClick={() => track('go_semester')} className={PILL}>
              Open Shift / Get the app &rarr;
            </a>
          ) : (
            <a href={joinUrl} onClick={() => track('group_join_link')} className={PILL}>
              {`Join ${shortName} on Shift →`}
            </a>
          )}
          {codeLive && (
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex min-h-[44px] items-center rounded-full border border-navy/25 px-4 font-mono text-[15px] font-bold tracking-wider text-navy transition-colors hover:bg-navy/[0.05]"
              aria-label={`Copy code ${SEMESTER_CODE}`}
            >
              {copied ? 'Copied' : SEMESTER_CODE}
            </button>
          )}
        </div>
        {codeLive && (
          <p className="mt-3 max-w-[520px] text-[13px] leading-snug text-ink-soft">
            Installing from the App Store or Google Play? Enter the code after you sign up. Store installs don&rsquo;t carry the link.
          </p>
        )}
      </div>

      {/* The group path: scan, or type the invite code. */}
      <div className="flex max-w-[360px] gap-4 md:w-[300px] md:flex-col md:gap-3">
        <a
          href={joinUrl}
          onClick={() => track('qr')}
          aria-label={`Join ${shortName} on Shift`}
          className="shrink-0 self-start rounded-[16px] border border-navy/10 bg-white p-3"
        >
          <div className="h-[112px] w-[112px] md:h-[140px] md:w-[140px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </a>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">
            {codeLive ? 'Already have the app?' : 'Or enter the group code'}
          </p>
          <p className="mt-1 font-mono text-[1.375rem] font-bold tracking-[0.18em] text-navy">{inviteCode}</p>
          <p className="mt-1.5 text-[13px] leading-snug text-ink-soft">
            In Shift: Community tab, the <strong className="font-semibold text-navy">+</strong> button, enter the code.{' '}
            {codeLive
              ? 'The group alone does not unlock the reward; the school-email check does.'
              : `Your trips count for ${shortName} from then on.`}
          </p>
        </div>
      </div>
    </div>
  )
}
