'use client'

// The challenge page in the Shift app (app/(tabs)/community/event.tsx with
// GuaranteedPrizePanel), drawn with the app's own words, colors and order:
// the badge, name, dates, the description, then "Your prizes" with a row per
// reward and "How trips count". It shows the page as it reads before anyone
// has logged a trip. Keith 2026-10-31: "be sure that the platform shows a
// preview of how the challenge will be displayed to challenge participants".

import { ChevronLeft, ChevronRight, Gift } from 'lucide-react'
import type { PrizeFormState } from '../_lib/portal-types'

type Row = { kind: 'goal'; tile: string | null; title: string; line: string } | { kind: 'offer'; title: string; body: string; meta: string | null }

const etToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const short = (ymd: string) => new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const dollarsOf = (p: PrizeFormState) => `$${(parseFloat(p.amount_dollars) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
const funded = (p: PrizeFormState) => p.funded_from_pool && (parseFloat(p.amount_dollars) || 0) > 0

/** "a company fleece" -> "Company fleece" (the app's prizeNameFromDescription). */
function prizeName(desc: string): string | null {
  const s = desc.trim().replace(/^(a|an)\s+/i, '').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null
}

/** The prize in a sentence: "a $10 gift card", or the employer's own words. */
function prizeLabel(p: PrizeFormState, employer: string): string {
  return funded(p) ? `a ${dollarsOf(p)} gift card` : p.prize_description.trim() || `a prize from ${employer}`
}

/** One row per reward, in the app's order: Try something new, drawings, then goal rewards. */
function rowsFor(prizes: PrizeFormState[], employer: string, startsAt: string, endsAt: string, notStarted: boolean): Row[] {
  const startsLine = `Starts ${short(startsAt)}. Trips from then on count.`
  const after = endsAt ? short(endsAt) : ''
  const offers: Row[] = []
  const drawings: Row[] = []
  const goals: Row[] = []
  for (const p of prizes) {
    const spots = parseInt(p.winner_count, 10) || 0
    const goal = parseInt(p.min_threshold, 10) || 0
    if (p.metric === 'tried_new' && (p.award_mode === 'guaranteed' || p.award_mode === 'drawing')) {
      const drawing = p.award_mode === 'drawing'
      offers.push({
        kind: 'offer',
        title: `Make a trip a new way, ${drawing ? 'enter to win' : 'win'} ${prizeLabel(p, employer)}`,
        body: notStarted ? startsLine : "Make a trip in a way you haven't in a while: a walk, a bike ride, the bus, the train or a carpool.",
        meta: drawing ? `Winners drawn after ${after}` : `${spots} of ${spots} spots left`,
      })
    } else if (p.award_mode === 'drawing' && (p.metric === 'trips' || p.metric === 'active_days')) {
      const unit = p.metric === 'active_days' ? 'days with a trip' : 'trips'
      drawings.push({
        kind: 'offer',
        title: `Enter to win ${prizeLabel(p, employer)}`,
        body: notStarted ? startsLine : `0 of ${goal} ${unit} to enter the drawing`,
        meta: spots === 1 ? `1 winner drawn after ${after}` : `${spots} winners drawn after ${after}`,
      })
    } else if (p.award_mode === 'guaranteed') {
      goals.push({
        kind: 'goal',
        tile: funded(p) ? dollarsOf(p) : null,
        title: funded(p) ? `${dollarsOf(p)} gift card` : (prizeName(p.prize_description) ?? `Prize from ${employer}`),
        line: notStarted ? startsLine : `0 of ${goal} trips · ${spots} of ${spots} spots left`,
      })
    }
  }
  return [...offers, ...drawings, ...goals]
}

export default function ChallengePagePreview({
  employer,
  name,
  startsAt,
  endsAt,
  description,
  prizes,
}: {
  employer: string
  name: string
  /** YYYY-MM-DD, Eastern. */
  startsAt: string
  endsAt: string
  description: string | null | undefined
  prizes: PrizeFormState[]
}) {
  const today = etToday()
  const notStarted = !startsAt || startsAt > today
  const rows = rowsFor(prizes, employer, startsAt || today, endsAt, notStarted)
  const about = description?.trim()

  return (
    <div className="max-w-[380px] overflow-hidden rounded-[26px] bg-[#191A2E] shadow-md" aria-label="The challenge page in the Shift app">
      {/* Header, as the app's stack header draws it */}
      <div className="relative flex h-12 items-center justify-center border-b border-white/[0.08] px-3">
        <span className="absolute left-3 flex items-center gap-0.5 text-[14px] text-white">
          <ChevronLeft size={16} strokeWidth={2} /> Back
        </span>
        <span className="text-[15px] font-bold text-white">Event</span>
      </div>

      <div className="px-4 pb-5 pt-3.5">
        <span
          className={`inline-block rounded-lg px-2.5 py-[3px] text-[12px] font-bold tracking-[0.08em] ${
            notStarted ? 'bg-white/[0.12] text-white' : 'bg-[#1e3a2a] text-[#BAF14D]'
          }`}
        >
          {notStarted ? 'UPCOMING' : 'LIVE'}
        </span>
        <div className="mt-2.5 text-[22px] font-extrabold leading-[1.2] text-[#F4F8EE]">{name.trim() || 'Your challenge'}</div>
        {startsAt && endsAt && (
          <div className="mt-1.5 text-[14px] font-semibold text-white/85">
            {short(startsAt)} – {short(endsAt)}
          </div>
        )}
        {about ? (
          <p className="mt-2.5 whitespace-pre-line text-[14px] leading-[20px] text-white/85">{about}</p>
        ) : (
          <p className="mt-2.5 rounded-lg border border-dashed border-white/25 px-3 py-2 text-[14px] leading-[20px] text-white/75">
            Your description shows here.
          </p>
        )}

        {rows.length > 0 && (
          <>
            <div className="mt-5 rounded-[14px] bg-[#242538] px-4 pb-1.5 pt-4">
              <div className="mb-1 text-[17px] font-bold text-[#F4F8EE]">Your prizes</div>
              {rows.map((r, i) => (
                <div key={i} className={i > 0 ? 'border-t border-white/[0.08]' : ''}>
                  {r.kind === 'goal' ? (
                    <div className="flex items-center gap-3.5 py-3.5">
                      {r.tile ? (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[rgba(186,241,77,0.16)] text-[16px] font-extrabold text-[#BAF14D]">
                          {r.tile}
                        </div>
                      ) : (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[rgba(41,102,229,0.18)]">
                          <Gift size={24} strokeWidth={1.75} className="text-[#98b6f1]" />
                        </div>
                      )}
                      <div className="grid min-w-0 flex-1 gap-[3px]">
                        <div className="text-[17px] font-bold leading-[1.25] text-[#F4F8EE]">{r.title}</div>
                        <div className="text-[14px] leading-[20px] text-white/75">{r.line}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2.5">
                      <div className="mb-1 text-[16px] font-bold leading-[1.3] text-[#F4F8EE]">{r.title}</div>
                      <div className="text-[14px] leading-[20px] text-white/75">{r.body}</div>
                      {r.meta && <div className="mt-1.5 text-[14px] font-bold text-[#F4F8EE]">{r.meta}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[15px] font-bold text-[#BAF14D]">
              How trips count <ChevronRight size={18} strokeWidth={2} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
