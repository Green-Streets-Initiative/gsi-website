'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import PhotoCredit from '@/components/PhotoCredit'

/*
 * The learner's page after their free street lesson (Shift 01870). One tap in
 * an email lands here with ?a=; the page saves it in the browser (a link
 * scanner that fetches the page without running it saves nothing), then asks
 * one thing and shows one next step. Answers go to Green Streets only; words
 * are shared only when the learner says so, and named as they choose.
 */

export type Ride = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location_name: string | null
  organizer_name: string | null
  image_url: string | null
  href: string
}

type Tapped = 'great' | 'ok' | 'rough' | 'had' | 'rode' | 'not_yet'
type Feeling = 'great' | 'ok' | 'rough'

type View = {
  ok: boolean
  state?: string
  first?: string | null
  teacher?: string | null
  had?: boolean
  next?: 'alone' | 'company' | null
  feeling?: Feeling | null
  words?: string | null
  words_share?: 'name_town' | 'anonymous' | null
  rode?: 'yes' | 'not_yet' | null
}

/** Someone riding a city bike lane on their own, the lesson's whole point (Adam Coppola, CC0; also on What's new). */
const STREET_PHOTO = {
  src: '/images/whats-new/cambridge-protected-lane.jpg',
  credit: 'Photo: Adam Coppola / Wikimedia Commons, CC0',
  url: 'https://commons.wikimedia.org/wiki/File:Older_woman_with_flowers_protected_bike_lane_boston.jpg',
}

const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold leading-tight text-navy text-balance'
const CARD = 'rounded-[22px] bg-white p-6 sm:p-7'
const BTN =
  'flex min-h-[56px] w-full items-center justify-center rounded-2xl px-6 text-[1.0625rem] font-bold transition-opacity hover:opacity-90 disabled:opacity-50'
const LINK = 'font-bold text-forest underline underline-offset-4 hover:opacity-80'
const BODY = 'text-[1.0625rem] leading-relaxed text-navy'

async function call(body: Record<string, unknown>): Promise<View> {
  const res = await fetch('/api/free-lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!data || typeof data.ok !== 'boolean') throw new Error('failed')
  return data
}

/** What a tap in the email saves. */
function answerOf(a: Tapped): Record<string, unknown> {
  if (a === 'had') return { had: true }
  if (a === 'rode') return { rode: 'yes' }
  if (a === 'not_yet') return { rode: 'not_yet' }
  return { feeling: a }
}

/** "Sat" and "Nov 22" for a date tile. */
function tile(day: string): [string, string, string] {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return [
    dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    dt.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    String(d),
  ]
}

/** "10 AM" from "10:00:00". */
function clock(t: string | null): string | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ap}`
}

export default function AfterLesson({ token, tapped, rides }: { token: string; tapped: Tapped | null; rides: Ride[] }) {
  const [view, setView] = useState<View | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    const go = tapped ? call({ action: 'after_answer', token, ...answerOf(tapped) }) : call({ action: 'after_get', token })
    go.then(setView, () => setFailed(true))
  }, [token, tapped])

  async function answer(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true)
    setFailed(false)
    try {
      setView(await call({ action: 'after_answer', token, ...body }))
      return true
    } catch {
      setFailed(true)
      return false
    } finally {
      setBusy(false)
    }
  }

  const photo = (
    <figure className="relative mx-auto h-[150px] w-full max-w-[640px] overflow-hidden bg-navy/10 sm:mt-6 sm:h-[200px] sm:rounded-[22px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={STREET_PHOTO.src}
        alt="A woman with flowers in her bike basket rides a parking-protected bike lane in Cambridge"
        width={1200}
        height={720}
        className="absolute inset-0 h-full w-full object-cover object-[35%_55%]"
      />
      <figcaption className="absolute right-2 top-2 whitespace-nowrap sm:bottom-2 sm:top-auto rounded-md bg-[rgba(25,26,46,.6)] px-2 py-0.5 text-[0.75rem] text-white">
        <PhotoCredit text={STREET_PHOTO.credit} url={STREET_PHOTO.url} linkClassName="underline-offset-2 hover:underline" />
      </figcaption>
    </figure>
  )

  const shell = (children: React.ReactNode) => (
    <>
      {photo}
      <div className="relative mx-auto -mt-6 flex w-full max-w-[640px] flex-col gap-4 px-4 sm:mt-4">{children}</div>
    </>
  )

  if (!view) {
    return shell(
      <div className={CARD}>
        {failed ? (
          <p className={BODY} role="alert">
            That didn’t load. Please try again, or reply to our email.
          </p>
        ) : (
          <p className={BODY}>One moment…</p>
        )}
      </div>,
    )
  }
  if (!view.ok) {
    return shell(
      <div className={CARD}>
        <h1 className={`${HEAD} text-[1.75rem]`}>This link has expired</h1>
        <p className={`${BODY} mt-3`}>Reply to our email and we’ll sort it out.</p>
      </div>,
    )
  }

  const name = view.first ? `, ${view.first}` : ''
  const withTeacher = view.teacher ? ` with ${view.teacher}` : ''
  const retry = failed && (
    <p className="mt-4 text-[0.9375rem] font-semibold text-[#B42318]" role="alert">
      That didn’t save. Please try again.
    </p>
  )

  // A month on: biked on their own yet?
  if (view.rode && (tapped === 'rode' || tapped === 'not_yet' || view.feeling)) {
    if (view.rode === 'yes') {
      return shell(
        <>
          <div className={CARD}>
            <h1 className={`${HEAD} text-[2rem]`}>That’s great{name}.</h1>
            <p className={`${BODY} mt-2`}>You’ve biked on your own since your lesson{withTeacher}.</p>
          </div>
          {!view.words && <Words kind="share" busy={busy} onSend={answer} saved={null} />}
          <ShareLessons />
        </>,
      )
    }
    return shell(
      <>
        <div className={CARD}>
          <h1 className={`${HEAD} text-[2rem]`}>Thanks for telling us{name}.</h1>
          <p className={`${BODY} mt-2`}>
            A first ride with company can make it easier.{rides.length > 0 ? ' Here are two ways.' : ''}
          </p>
        </div>
        <NextStep next="company" rides={rides} />
      </>,
    )
  }

  // Day 14: we haven't heard about a lesson yet.
  if (!view.had && !view.feeling) {
    return shell(
      <div className={CARD}>
        <h1 className={`${HEAD} text-[2rem]`}>Did you have your lesson{withTeacher}?</h1>
        <button type="button" disabled={busy} onClick={() => answer({ had: true })} className={`${BTN} mt-6 bg-forest text-white`}>
          Yes, we had it
        </button>
        {retry}
        <p className={`${BODY} mt-4`}>
          Still waiting? Reply to our email and we’ll check with {view.teacher ?? 'your instructor'}.
        </p>
      </div>,
    )
  }

  // How did it go?
  if (!view.feeling) {
    return shell(
      <div className={CARD}>
        <h1 className={`${HEAD} text-[2rem]`}>How did your lesson{withTeacher} go?</h1>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {(['great', 'ok', 'rough'] as Feeling[]).map((f) => (
            <button
              key={f}
              type="button"
              disabled={busy}
              onClick={() => answer({ feeling: f })}
              className={`${BTN} border-2 border-forest/30 bg-white px-2 text-forest`}
            >
              {FEELING[f]}
            </button>
          ))}
        </div>
        {retry}
      </div>,
    )
  }

  const great = view.feeling === 'great'
  // Next: what the instructor said, else what the learner's answer suggests.
  const next = view.next ?? (great ? 'alone' : 'company')
  return shell(
    <>
      <div className={CARD}>
        <h1 className={`${HEAD} text-[2rem]`}>{great ? `Glad it went well${name}.` : `Thanks for telling us${name}.`}</h1>
        <p className="mt-3 text-[0.9375rem] text-navy/80">
          You said: <b className="text-navy">{FEELING[view.feeling]}</b>.{' '}
          {(['great', 'ok', 'rough'] as Feeling[])
            .filter((f) => f !== view.feeling)
            .map((f, i) => (
              <span key={f}>
                {i === 0 ? 'Change to ' : ' or '}
                <button type="button" disabled={busy} onClick={() => answer({ feeling: f })} className={LINK}>
                  {FEELING[f]}
                </button>
              </span>
            ))}
        </p>
        {retry}
      </div>
      <Words kind={great ? 'share' : 'private'} busy={busy} onSend={answer} saved={view.words ? view.words_share ?? 'private' : null} />
      <NextStep next={next} rides={rides} teacher={view.next ? view.teacher ?? 'Your instructor' : null} />
      {/* Once their words are in, the one more thing: a friend who'd like a lesson. */}
      {great && view.words && <ShareLessons />}
    </>,
  )
}

const FEELING: Record<Feeling, string> = { great: 'Great', ok: 'OK', rough: 'Rough' }

type Share = 'name_town' | 'anonymous' | 'private'

/** After Great: what they'd tell a friend, shared only as they choose. After OK or Rough: what would have helped. */
function Words({
  kind, busy, onSend, saved,
}: {
  kind: 'share' | 'private'
  busy: boolean
  onSend: (b: Record<string, unknown>) => Promise<boolean>
  saved: Share | null
}) {
  const [text, setText] = useState('')
  const [share, setShare] = useState<Share | null>(kind === 'private' ? 'private' : null)
  const [done, setDone] = useState<Share | null>(saved)
  const [failed, setFailed] = useState(false)

  if (done) {
    return (
      <div className={CARD}>
        <p className={BODY}>
          <b>Thank you.</b>{' '}
          {done === 'private'
            ? 'Only Green Streets will read it.'
            : done === 'name_town'
            ? 'We may share it with your first name and town, to help someone else decide to try a lesson.'
            : 'We may share it with your name left off, to help someone else decide to try a lesson.'}
        </p>
      </div>
    )
  }

  const question = kind === 'share' ? 'What would you tell a friend who’s nervous about biking here?' : 'What would have made it better?'
  const ready = text.trim().length > 1 && share !== null
  return (
    <form
      className={CARD}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ready || !share) return
        if (await onSend({ words: text.trim(), share: share === 'private' ? null : share })) setDone(share)
        else setFailed(true)
      }}
    >
      <label htmlFor="lesson-words" className={`${HEAD} block text-[1.375rem]`}>
        {question}
      </label>
      <textarea
        id="lesson-words"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={1000}
        className="mt-3 w-full rounded-xl border-2 border-navy/15 bg-white p-3 text-[1.0625rem] leading-relaxed text-navy placeholder:text-navy/60"
        placeholder={kind === 'share' ? 'In your own words' : 'Anything helps'}
      />
      {kind === 'share' && (
        <fieldset className="mt-4">
          <legend className="text-[0.9375rem] font-semibold text-navy">Can we share it?</legend>
          <div className="mt-2 flex flex-col gap-2">
            {(
              [
                ['name_town', 'Yes, with my first name and town'],
                ['anonymous', 'Yes, but leave my name off'],
                ['private', 'Keep it between us'],
              ] as [Share, string][]
            ).map(([v, label]) => (
              <label
                key={v}
                className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 text-[1rem] text-navy ${
                  share === v ? 'border-forest bg-forest/5' : 'border-navy/15'
                }`}
              >
                <input type="radio" name="lesson-share" value={v} checked={share === v} onChange={() => setShare(v)} className="h-5 w-5 accent-[#2D6A4F]" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button type="submit" disabled={busy || !ready} className={`${BTN} mt-5 bg-forest text-white`}>
        Send
      </button>
      {failed && (
        <p className="mt-3 text-[0.9375rem] font-semibold text-[#B42318]" role="alert">
          That didn’t send. Please try again.
        </p>
      )}
      {kind === 'private' && <p className="mt-3 text-[0.9375rem] text-navy/80">Only Green Streets reads this.</p>}
    </form>
  )
}

/** One next step: plan the ride, or go with company the first time. */
function NextStep({ next, rides, teacher }: { next: 'alone' | 'company'; rides: Ride[]; teacher?: string | null }) {
  const said = teacher ? `${teacher} said you’re ready to ride on your own.` : null
  if (next === 'alone') {
    return (
      <div className={CARD}>
        <h2 className={`${HEAD} text-[1.5rem]`}>Plan your first ride on your own</h2>
        <p className={`${BODY} mt-2`}>
          {said ? `${said} ` : ''}Put in where you’re going, and the planner shows the calmest way there.
        </p>
        <Link href="/trip" className={`${BTN} mt-5 bg-forest text-white`}>
          Plan a ride
        </Link>
        <p className="mt-4 text-[0.9375rem] text-navy">
          Rather have company the first time?{' '}
          <Link href="/together" className={LINK}>
            Ride with someone nearby
          </Link>
        </p>
      </div>
    )
  }
  return (
    <>
      <div className={CARD}>
        <h2 className={`${HEAD} text-[1.5rem]`}>Ride with someone nearby</h2>
        <p className={`${BODY} mt-2`}>
          {teacher ? `${teacher} suggested company for your first ride. ` : ''}We introduce you to someone near you who already
          bikes, and you go together the first time.
        </p>
        <Link href="/together" className={`${BTN} mt-5 bg-forest text-white`}>
          Find someone to ride with
        </Link>
      </div>
      {rides.length > 0 && (
        <div className={CARD}>
          <h2 className={`${HEAD} text-[1.5rem]`}>Or join an easy group ride</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {rides.map((r) => {
              const [wd, mon, day] = tile(r.event_date)
              const meta = [clock(r.event_time), r.location_name].filter(Boolean).join(' · ')
              return (
                <li key={r.id}>
                  <Link href={r.href} className="flex items-center gap-3 rounded-2xl border-2 border-navy/10 p-2.5 hover:border-forest/40">
                    <span className="flex h-[64px] w-[56px] shrink-0 flex-col items-center justify-center rounded-xl bg-navy text-white">
                      <span className="text-[0.75rem] font-semibold">{wd}</span>
                      <span className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[1.375rem] font-extrabold leading-none">{day}</span>
                      <span className="text-[0.75rem]">{mon}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1rem] font-bold leading-snug text-navy">{r.title}</span>
                      {meta && <span className="mt-0.5 block text-[0.875rem] leading-snug text-navy/80">{meta}</span>}
                      {r.organizer_name && <span className="block text-[0.875rem] leading-snug text-navy/80">{r.organizer_name}</span>}
                    </span>
                    {r.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" width={64} height={64} className="hidden h-16 w-16 shrink-0 rounded-xl object-cover sm:block" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
          <Link href="/bike-lessons#group-rides" className={`mt-4 inline-block text-[1rem] ${LINK}`}>
            More easy group rides
          </Link>
        </div>
      )}
    </>
  )
}

/** For someone it went well for: the page to send a friend. */
function ShareLessons() {
  const url = 'https://www.gogreenstreets.org/bike-lessons?utm_source=lesson_after&utm_medium=web'
  const [copied, setCopied] = useState(false)
  return (
    <div className={CARD}>
      <h2 className={`${HEAD} text-[1.5rem]`}>Know someone who’d like a lesson?</h2>
      <p className={`${BODY} mt-2`}>
        Send them <b>gogreenstreets.org/bike-lessons</b>. Green Streets covers the cost.
      </p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => setCopied(false))
        }}
        className={`${BTN} mt-4 border-2 border-forest/30 bg-white text-forest`}
      >
        {copied ? 'Link copied' : 'Copy the link'}
      </button>
    </div>
  )
}
