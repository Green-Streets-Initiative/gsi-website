'use client'

/**
 * "What your team hears from Shift" for one employer challenge (Keith
 * 2026-10-01: couldn't find the awards or the mid-challenge messages).
 *
 * Mirrors the employer-challenge-engage function (Shift) and the awards in
 * Shift 01047, so the admin sees each automatic note, when it goes out and
 * what it says, plus the award everyone gets at the end:
 *   - Monday standings, 9 am ET, from the first Monday at least 3 days in;
 *     the Monday in the last 7 days is the final-week version.
 *   - Near the goal, 5 pm ET, only with a first-to-the-goal prize.
 *   - Wrap-up, 9 am ET the morning after it ends, with the award.
 * The sample notes use the function's own wording with made-up numbers.
 * Keep the copy here in step with engage's standingsTitle/standingsBody,
 * zeroNote, nearNote and wrapNote.
 */

import { useEffect, useMemo, useState } from 'react'
import { Award, BellRing, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Challenge, ChallengePrize } from '../_lib/portal-types'

const ET = 'America/New_York'
const DAY_MS = 86_400_000

type CatalogRow = { key: string; name: string; measures: string; color: string; sort: number }

/** The instant it is `hour`:00 in Boston on the ET calendar day of `d`. */
function etAt(d: Date, hour: number): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  // EDT is UTC-4, EST is UTC-5: try EDT, keep it if Boston reads the right hour.
  const edt = new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00-04:00`)
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: 'numeric', hour12: false }).format(edt))
  return h === hour ? edt : new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00-05:00`)
}

function etWeekday(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'long' }).format(d)
}

function shortDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short', month: 'short', day: 'numeric' }).format(d)
}

/** Same rule as _employer_prize_reward_text (Shift 01049). */
function rewardText(p: ChallengePrize): string {
  const cents = p.amount_cents ?? 0
  if (p.funded_from_pool && cents > 0) {
    return `a $${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)} gift card`
  }
  const d = (p.prize_description ?? '').trim()
  if (!d) return 'a prize'
  return /^(A|An|The|One|Two|Three)\b/.test(d) ? d.charAt(0).toLowerCase() + d.slice(1) : d
}

/** "Your first walk, bike ride, transit trip or carpool counts." from the challenge's modes. */
function firstTripLine(modes: string[] | undefined): string {
  const m = modes ?? ['walk', 'bike', 'escooter', 'transit_bus', 'transit_train', 'transit_commuter_rail', 'ferry', 'carpool']
  const words: string[] = []
  if (m.includes('walk')) words.push('walk')
  if (m.includes('bike')) words.push('bike ride')
  if (m.includes('escooter')) words.push('e-scooter ride')
  if (['transit_bus', 'transit_train', 'transit_commuter_rail', 'ferry'].some((x) => m.includes(x))) words.push('transit trip')
  if (m.includes('carpool')) words.push('carpool')
  const list = words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`
  return `Your first ${list || 'active trip'} counts.`
}

function Notification({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-[420px] rounded-[14px] border border-line bg-surface px-3.5 py-3 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-accent text-[10px] font-extrabold text-white">S</span>
        Shift
      </div>
      <div className="text-[13.5px] font-semibold leading-[1.35] text-ink">{title}</div>
      <div className="mt-0.5 text-[13px] leading-[1.45] text-ink">{body}</div>
    </div>
  )
}

function Moment({
  when,
  label,
  who,
  children,
}: {
  when: string
  label: string
  who: string
  children: React.ReactNode
}) {
  return (
    <li className="grid gap-2 border-t border-line-2 py-4 first:border-t-0 first:pt-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-5">
      <div>
        <div className="text-[13.5px] font-semibold text-ink">{label}</div>
        <div className="text-[13px] leading-[1.45] text-ink-muted">{when}</div>
      </div>
      <div className="grid gap-2">
        <p className="text-[13px] leading-[1.5] text-ink-muted">{who}</p>
        {children}
      </div>
    </li>
  )
}

export default function TeamHearsPanel({
  challenge,
  groupName,
  goalPrize,
  ended,
}: {
  challenge: Challenge
  groupName: string
  /** The live first-to-the-goal prize, if any (published, not cancelled). */
  goalPrize: ChallengePrize | null
  ended: boolean
}) {
  const [open, setOpen] = useState(false)
  // Read the clock once per mount, not on every render.
  const [now] = useState(() => Date.now())
  const [catalog, setCatalog] = useState<CatalogRow[] | null>(null)

  const end = new Date(challenge.ends_at)

  // Every Monday 9 am ET the function would send standings for this challenge.
  const mondays = useMemo(() => {
    const out: { at: Date; finalWeek: boolean }[] = []
    const s = new Date(challenge.starts_at).getTime()
    const e = new Date(challenge.ends_at).getTime()
    for (let t = s; t <= e + DAY_MS; t += DAY_MS) {
      const at = etAt(new Date(t), 9)
      if (etWeekday(at) !== 'Monday') continue
      if (at.getTime() - s < 3 * DAY_MS || at.getTime() > e) continue
      if (out.some((o) => o.at.getTime() === at.getTime())) continue
      out.push({ at, finalWeek: e - at.getTime() <= 7 * DAY_MS })
    }
    return out
  }, [challenge.starts_at, challenge.ends_at])

  // The first 9 am ET after the end (the function sends the wrap-up then).
  const wrapAt = useMemo(() => {
    const e = new Date(challenge.ends_at)
    const sameDay = etAt(e, 9)
    return sameDay.getTime() > e.getTime() ? sameDay : etAt(new Date(e.getTime() + DAY_MS), 9)
  }, [challenge.ends_at])

  useEffect(() => {
    if (!open || catalog) return
    let cancelled = false
    supabase
      .from('challenge_award_catalog')
      .select('key,name,measures,color,sort')
      .order('sort', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setCatalog((data ?? []) as CatalogRow[])
      })
    return () => {
      cancelled = true
    }
  }, [open, catalog])

  // Upcoming dates only: a past Monday may predate these notes (they began
  // 2026-09-30), so listing it would claim a send that never happened.
  const weekly = mondays.filter((m) => !m.finalWeek)
  const upcomingWeekly = weekly.filter((m) => m.at.getTime() > now)
  const finalMonday = mondays.find((m) => m.finalWeek) ?? null
  const finalUpcoming = finalMonday && finalMonday.at.getTime() > now ? finalMonday : null
  const wrapUpcoming = wrapAt.getTime() > now
  const goal = goalPrize?.min_threshold ?? null
  const endDay = etWeekday(end)
  const noteCount = upcomingWeekly.length + (finalUpcoming ? 1 : 0) + (wrapUpcoming ? 1 : 0)
  const summary = ended
    ? 'Monday standings while it ran, a wrap-up the morning after, and an award for everyone who took part.'
    : `${noteCount} automatic ${noteCount === 1 ? 'note' : 'notes'} still to come${
        goalPrize ? ', near-the-goal nudges' : ''
      }, and an award for everyone who takes part.`

  // Sample numbers for the example notes.
  const sampleGoalLine = goal != null ? ` The goal is ${goal}; you're 3 away.` : ''

  return (
    <div className="mt-5 border-t border-line-2 pt-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 rounded-[8px] text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex items-start gap-2.5">
          <BellRing size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <span className="block text-[14px] font-semibold text-ink">What your team hears from Shift</span>
            <span className="block text-[13px] leading-[1.5] text-ink-muted">{summary}</span>
          </span>
        </span>
        {open ? (
          <ChevronUp size={16} className="mt-1 shrink-0 text-ink-icon" />
        ) : (
          <ChevronDown size={16} className="mt-1 shrink-0 text-ink-icon" />
        )}
      </button>

      {open && (
        <div className="mt-4 grid gap-5">
          <p className="text-[13px] leading-[1.55] text-ink">
            These go out on their own as a phone notification and a note in the app&apos;s inbox, never by email. Anyone
            who turned off challenge updates or is on vacation mode in Shift doesn&apos;t get them. The examples use
            made-up numbers; each person sees their own.
          </p>

          <ol className="grid">
            <Moment
              label="Monday standings"
              when={
                ended
                  ? '9 am on Mondays while it ran'
                  : upcomingWeekly.length > 0
                    ? `9 am on ${upcomingWeekly.map((m) => shortDate(m.at)).join(', ')}`
                    : weekly.length > 0
                      ? 'None left: the rest of the challenge is its last week'
                      : 'None: the challenge is too short for a Monday before its last week'
              }
              who="Everyone in the challenge: their place and active trips so far. People with no trips yet get one gentle note on their first Monday instead."
            >
              {weekly.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  <Notification
                    title={`${groupName}: you're #4 with 9 active trips`}
                    body={`12 colleagues have logged active trips so far.${sampleGoalLine}`}
                  />
                  <Notification
                    title={`${groupName}'s challenge is on`}
                    body={`12 colleagues have logged active trips. ${firstTripLine(challenge.counting_rules?.modes)}`}
                  />
                </div>
              )}
            </Moment>

            {finalMonday && (
              <Moment
                label="Final week"
                when={finalUpcoming ? `9 am on ${shortDate(finalMonday.at)}` : '9 am on its last Monday'}
                who="Everyone in the challenge: the same update, with the end day."
              >
                <Notification
                  title="Last week: you're #4 with 14 active trips"
                  body={`12 colleagues have logged active trips so far.${sampleGoalLine} It ends ${endDay}.`}
                />
              </Moment>
            )}

            {goalPrize && (
              <Moment
                label="Near the goal"
                when="5 pm on any day of the challenge"
                who={`People 1 or 2 trips short of ${goal ?? 'the goal'} who haven't won yet, while spots are open. Once per person.`}
              >
                <Notification
                  title={`2 more active trips and you win ${rewardText(goalPrize)}`}
                  body={`3 of ${goalPrize.winner_count} ${goalPrize.winner_count === 1 ? 'spot is' : 'spots are'} still open at ${groupName}.`}
                />
              </Moment>
            )}

            <Moment
              label="Wrap-up"
              when={wrapUpcoming ? `9 am on ${shortDate(wrapAt)}, the morning after it ends` : '9 am the morning after it ended'}
              who="Everyone who logged a trip: where they finished, anything they won, and their award."
            >
              <Notification
                title={`${groupName}'s challenge is done: 14 active trips`}
                body="You finished #3 of 12. Your challenge award is ready."
              />
            </Moment>
          </ol>

          <div className="rounded-[12px] border border-line bg-surface-2 p-4">
            <div className="mb-1.5 flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Award size={16} strokeWidth={1.75} className="text-accent" />
              An award for everyone who took part
            </div>
            <p className="mb-3 text-[13px] leading-[1.55] text-ink">
              The morning after it ends, each person who logged a trip gets one award in the app for what they did most,
              with a tip for next time. Each award also has a headline: the person who did the most of it. Headlines
              show names only when your leaderboard is public; otherwise they read &quot;A colleague&quot;. Once it
              ends, the recap shows here.
            </p>
            {catalog === null ? (
              <p className="text-[13px] text-ink-muted">Loading the awards...</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {catalog.map((a) => (
                  <li
                    key={a.key}
                    title={a.measures}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-ink"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: a.color }} aria-hidden />
                    {a.name}
                    <span className="font-normal text-ink-muted">· {a.measures}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
