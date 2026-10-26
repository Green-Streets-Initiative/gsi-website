'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Printer, SquaresFour } from '@phosphor-icons/react'
import { TEAM_CHALLENGE, type TeamResult } from '@/lib/employer/team-challenge'

// The screen a new team lands on: the code, the note for staff (the kit's
// forwardable note, with the join link), the flyer and the portal.

function staffNote(company: string, code: string): string {
  const c = TEAM_CHALLENGE
  return [
    `Our team commute challenge runs ${c.label.range}. Walk, bike, scoot, take transit or carpool for any trip on any day, and it counts for ${company}’s team. On ${c.label.wrd}, Walk/Ride Day, every trip also enters you in a gift card drawing.`,
    '',
    `1. Get the free Shift app and join our team: shift.gogreenstreets.org/join/${code}`,
    `   (or enter our team code ${code} when you sign up)`,
    '2. Turn on trip tracking. The app records your trips by itself, so there’s nothing to log by hand. A carpool takes one tap.',
    '3. Check our team board in the app.',
    '',
    `The drawing is open to anyone 18 or older in Massachusetts. Rules: gogreenstreets.org${c.rulesPath}`,
  ].join('\n')
}

export default function TeamReady({ team, tokenHash }: { team: TeamResult; tokenHash: string | null }) {
  const [copied, setCopied] = useState(false)
  const note = staffNote(team.company, team.code)
  const flyer = `/shift/employers/flyer?group=${encodeURIComponent(team.slug ?? team.code)}${team.challengeId ? `&challenge=${team.challengeId}` : ''}`
  // The one-time sign-in token from the confirm step opens the portal signed
  // in; on a later visit the portal's own sign-in page sends a fresh link.
  const portal = tokenHash
    ? `/shift/employers/portal/dashboard?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`
    : '/shift/employers/login'

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
            <p className="text-[15px]">Team code</p>
            <p className="font-headline text-[clamp(2.4rem,7vw,3.2rem)] font-extrabold leading-none tracking-[0.06em]">{team.code}</p>
          </div>
          <p className="pb-1 text-[15px]">Join link: shift.gogreenstreets.org/join/{team.code}</p>
        </div>
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
            <p className="mt-2 text-[1.0625rem] leading-[1.6] text-ink-soft">Your portal has the team board, who has joined and your numbers. The challenge is already set up there.</p>
            <a
              href={portal}
              className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-navy px-6 text-[16px] font-bold text-white hover:opacity-90"
            >
              <SquaresFour size={20} weight="bold" aria-hidden /> {tokenHash ? 'Open your portal' : 'Sign in to your portal'}
            </a>
          </section>
        </div>
      </div>
    </div>
  )
}
