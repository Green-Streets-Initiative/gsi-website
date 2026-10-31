'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, DeviceMobile, EnvelopeSimple, Printer, SquaresFour } from '@phosphor-icons/react'
import { TEAM_CHALLENGE, challengeRulesPath, flyerPath, type TeamResult } from '@/lib/employer/team-challenge'
import { staffNote } from '@/lib/employer/team-challenge-note'

// The screen a new team lands on: the code, the note for staff (the kit's
// forwardable note, with the join link), the flyer, the portal and joining
// the team yourself. The note's text lives in team-challenge-note.ts, so
// the ready email carries the same words.

export default function TeamReady({ team, signinSent }: { team: TeamResult; signinSent: boolean }) {
  const [copied, setCopied] = useState(false)
  const note = staffNote(team)
  const flyer = flyerPath(team)
  const rules = challengeRulesPath(team.challengeId)

  async function copy() {
    try {
      await navigator.clipboard.writeText(note)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      /* the note is on screen to select by hand */
    }
  }

  return (
    <div>
      <div className="rounded-[18px] bg-forest px-6 pb-7 pt-5 text-white sm:px-8">
        <p className="text-[16px]"><b className="block sm:inline">{TEAM_CHALLENGE.label.range}</b><span className="sm:ml-3">{team.company}</span></p>
        <h1 className="mt-2 font-headline text-[clamp(1.8rem,4.5vw,2.6rem)] font-extrabold leading-[1.06]">Your team is ready</h1>
        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="text-[15px]">Invite code</p>
            <p className="font-headline text-[clamp(2.4rem,7vw,3.2rem)] font-extrabold leading-none tracking-[0.06em]">{team.code}</p>
          </div>
          <p className="pb-1 text-[15px]">Join link: shift.gogreenstreets.org/join/{team.code}</p>
        </div>
        {/* The sign-up email did not match the company website: invitations
            stay on the organizer's own domain until an admin adds more. */}
        {!team.domainVerified && (
          <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.55] text-white/85">
            Invitations from your portal go to {team.domain} addresses. To invite other addresses, add your company&rsquo;s email domains in Settings.
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
        <section aria-labelledby="note-h">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="note-h" className="font-headline text-[1.4rem] font-extrabold text-navy">1. Send your staff this note</h2>
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-navy px-5 text-[15px] font-bold text-navy hover:bg-navy hover:text-white"
            >
              {copied ? <Check size={18} weight="bold" aria-hidden /> : <Copy size={18} weight="bold" aria-hidden />}
              {copied ? 'Copied' : 'Copy the note'}
            </button>
          </div>
          <pre className="mt-4 whitespace-pre-wrap rounded-[14px] border-2 border-navy/[0.12] bg-white p-5 font-gsi text-[15.5px] leading-[1.6] text-navy">{note}</pre>
          <p className="mt-2 text-[14px] text-ink-soft" aria-live="polite">{copied ? 'The note is copied. Paste it into an email, Slack or Teams.' : 'Paste it into an email, Slack or Teams, as it is.'}</p>
          <p className="mt-2 text-[14px] text-ink-soft">
            {rules && (
              <>
                <Link href={rules} className="font-bold text-forest underline-offset-4 hover:underline">Your challenge&rsquo;s rules</Link>
                {' · '}
              </>
            )}
            <Link href={TEAM_CHALLENGE.rulesPath} className="font-bold text-forest underline-offset-4 hover:underline">Walk/Ride Day rules</Link>
          </p>
        </section>

        <div className="flex flex-col gap-6">
          <section>
            <h2 className="font-headline text-[1.4rem] font-extrabold text-navy">2. Put up the flyer</h2>
            <p className="mt-2 text-[1.0625rem] leading-[1.6] text-ink-soft">One page with your code, a QR code and the challenge dates, for the kitchen or the lobby.</p>
            <Link
              href={flyer}
              target="_blank"
              className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full border-2 border-navy px-6 text-[16px] font-bold text-navy hover:bg-navy hover:text-white"
            >
              <Printer size={20} weight="bold" aria-hidden /> Open the flyer
            </Link>
          </section>
          <section>
            <h2 className="font-headline text-[1.4rem] font-extrabold text-navy">3. Follow along</h2>
            {signinSent ? (
              <>
                <p className="mt-2 flex items-start gap-2 text-[1.0625rem] leading-[1.6] text-navy">
                  <EnvelopeSimple size={22} weight="duotone" className="mt-0.5 shrink-0 text-forest" aria-hidden />
                  <span><b>We emailed you a sign-in link.</b> Your portal has the team board, who has joined and your numbers. The challenge is already set up there.</span>
                </p>
                <p className="mt-3 text-[15px] leading-[1.6] text-ink-soft">
                  Nothing in a few minutes? Check your spam folder, or{' '}
                  <Link href="/shift/employers/login" className="font-bold text-forest underline-offset-4 hover:underline">ask for a new link</Link>.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[1.0625rem] leading-[1.6] text-ink-soft">Your portal has the team board, who has joined and your numbers. The challenge is already set up there.</p>
                <Link
                  href="/shift/employers/login"
                  className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-navy px-6 text-[16px] font-bold text-white hover:opacity-90"
                >
                  <SquaresFour size={20} weight="bold" aria-hidden /> Sign in to your portal
                </Link>
              </>
            )}
          </section>
          {/* Signing up doesn't put the organizer on the team (Keith 2026-10-27). */}
          <section>
            <h2 className="font-headline text-[1.4rem] font-extrabold text-navy">4. Join the team yourself</h2>
            <p className="mt-2 text-[1.0625rem] leading-[1.6] text-ink-soft">
              Get the Shift app and enter code {team.code}, so your trips count for the team too.
            </p>
            <a
              href={`https://shift.gogreenstreets.org/join/${team.code}`}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full border-2 border-navy px-6 text-[16px] font-bold text-navy hover:bg-navy hover:text-white"
            >
              <DeviceMobile size={20} weight="bold" aria-hidden /> Get the app
            </a>
          </section>
        </div>
      </div>
    </div>
  )
}
