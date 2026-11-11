'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toneClass } from '@/components/events/EventsTone'
import { MessageCircle } from 'lucide-react'
import { FUNCTIONS_BASE, clock, dateShort, dayShort, type RideChat, type RsvpStatus } from '@/lib/rides/public'
import '@/components/events/events-tone.css'

interface GuestDate {
  id: string
  date: string
  status: 'scheduled' | 'canceled'
  start_time: string | null
  meetup_name: string | null
  rsvp: RsvpStatus | null
}
interface GuestRide {
  series_id: string
  code: string
  name: string
  status: string
  /** Going on every date (Shift 01598), and how that reads ("every Saturday"). */
  every_date: boolean
  every: string | null
  /** The organizer's group chat or email link, for people on the ride. */
  chat: RideChat | null
  /** The ride has a group chat and the organizer hasn't let them in yet (Shift 01679). */
  chat_waiting?: boolean
  dates: GuestDate[]
  /** Where they join and their helper job, for the first date they're coming to (Shift 01744). */
  next?: NextPicks | null
}
type Job = 'front' | 'sweep' | 'corner'
interface NextPicks {
  occurrence_id: string
  date: string
  walk: boolean
  stops: { id: string; label: string; time: string | null; miles: number | null }[]
  my_stop: string | null
  open: Record<Job, number> | null
  my_job: Job | null
}
interface Overview {
  first_name: string
  email: string
  email_optout: boolean
  rides: GuestRide[]
}
/** The answer to "Did you make it?" (Shift 01594), from the after-ride email. */
interface WentResult {
  occurrence_id: string
  date: string
  ride_name: string
  date_title: string | null
  went: boolean
}

const JOB_WORDS: Record<Job, string> = { front: 'Lead', sweep: 'Sweep at the back', corner: 'Hold a corner' }

const ANSWERS: { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't go" },
]

export default function ManageRides() {
  const params = useSearchParams()
  const token = params.get('t') ?? ''
  const intent = params.get('do') // "optout" or "forget", from the email footer links
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [forgotten, setForgotten] = useState(false)
  const [confirmForget, setConfirmForget] = useState(intent === 'forget')
  // Leaving takes every answer for that ride with it, so it asks first.
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null)
  // "Yes, I was there" / "No, I missed it" in the after-ride email open this
  // page with ?went=<date>&a=yes|no, and the answer is saved on arrival.
  const wentDate = params.get('went')
  const wentAnswer = params.get('a')
  const [went, setWent] = useState<WentResult | null>(null)
  const wentSent = useRef(false)
  // The date they just answered sits in the card above, not in the list again.
  const shown = (r: GuestRide) => r.dates.filter((d) => d.id !== went?.occurrence_id)

  const load = useCallback(async () => {
    if (!token) { setError('This page needs the link from your ride email.'); return }
    const res = await fetch(`${FUNCTIONS_BASE}/ride-guest-manage?t=${encodeURIComponent(token)}`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error ?? 'This link has expired or was removed.'); return }
    setData(body)
  }, [token])

  async function act(payload: Record<string, unknown>, key: string) {
    setSaving(key)
    setError(null)
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/ride-guest-manage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token, ...payload }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error ?? 'Couldn’t save that. Try again.'); return false }
      if (body.forgotten) { setForgotten(true); return true }
      if (body.went_result) setWent(body.went_result)
      if (body.chosen?.job_taken) setError('Someone took that job a moment ago. You’re on the ride either way.')
      if (body.rides) setData(body)
      return true
    } finally {
      setSaving(null)
    }
  }

  useEffect(() => {
    if (token && wentDate && (wentAnswer === 'yes' || wentAnswer === 'no')) {
      if (wentSent.current) return
      wentSent.current = true
      void act({ action: 'went', occurrence_id: wentDate, went: wentAnswer === 'yes' }, 'went').then((ok) => { if (!ok) void load() })
      return
    }
    void load()
    // act is recreated each render; the guard above makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, token, wentDate, wentAnswer])

  const shell = (children: React.ReactNode) => (
    <div className={`min-h-[70vh] bg-(--ev-bg) px-4 py-10 sm:px-8 ${toneClass('light')}`}>
      <div className="mx-auto max-w-[640px]">{children}</div>
    </div>
  )

  if (forgotten) {
    return shell(
      <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-6">
        <h1 className="font-display text-[28px] font-extrabold text-(--ev-ink)">Done. This address is removed.</h1>
        <p className="mt-2 text-[15px] text-(--ev-ink-80)">Your answers are gone and you won&rsquo;t get ride emails at this address.</p>
      </div>,
    )
  }
  if (error && !data) {
    return shell(
      <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-6">
        <h1 className="font-display text-[26px] font-extrabold text-(--ev-ink)">Your rides</h1>
        <p className="mt-2 text-[15px] text-(--ev-ink-80)">{error}</p>
        <p className="mt-3 text-[15px] text-(--ev-ink-80)">
          Looking for a ride? <Link href="/events?type=group_ride" className="font-semibold text-(--ev-accent) hover:underline">Find group rides on the calendar</Link>.
        </p>
      </div>,
    )
  }
  if (!data) return shell(<p className="text-[15px] text-(--ev-ink-75)">Loading your rides…</p>)

  return shell(
    <>
      <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold text-(--ev-ink)">Your rides, {data.first_name}</h1>
      <p className="mt-1 text-[14px] text-(--ev-ink-75)">Opened from the link in your email to {data.email}.</p>

      {error && <p role="alert" className="mt-4 text-[14px] font-semibold text-(--ev-danger)">{error}</p>}

      {went && (
        <div className="mt-6 rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5" role="status">
          <p className="text-[18px] font-bold text-(--ev-ink)">
            {went.went ? 'Thanks. You’re counted.' : 'Thanks for letting us know.'}
          </p>
          <p className="mt-1 text-[15px] text-(--ev-ink-80)">
            {went.ride_name}{went.date_title && went.date_title !== went.ride_name ? `: ${went.date_title}` : ''}, {dayShort(went.date)}, {dateShort(went.date)}.
            {went.went ? ' The organizer sees you came.' : ''}
          </p>
          {data.rides.some((r) => r.dates.some((d) => d.status === 'scheduled' && d.date > went.date)) && (
            <p className="mt-1 text-[15px] text-(--ev-ink-80)">Coming next time? Pick your answer below.</p>
          )}
          <button
            onClick={() => act({ action: 'went', occurrence_id: went.occurrence_id, went: !went.went }, 'went')}
            disabled={saving === 'went'}
            className="mt-3 min-h-[40px] text-[14px] font-semibold text-(--ev-accent) hover:underline disabled:opacity-60"
          >
            {went.went ? 'I didn’t make it' : 'Actually, I was there'}
          </button>
        </div>
      )}

      {intent === 'optout' && !data.email_optout && (
        <div className="mt-6 rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5">
          <p className="text-[15px] font-semibold text-(--ev-ink)">Stop ride emails?</p>
          <p className="mt-1 text-[14px] text-(--ev-ink-80)">You&rsquo;ll keep your answers, but we won&rsquo;t email reminders or changes.</p>
          <button onClick={() => act({ action: 'optout' }, 'optout')} disabled={saving === 'optout'} className="mt-3 rounded-[10px] bg-(--ev-accent-fill) px-5 py-2.5 text-[14px] font-bold text-(--ev-on-accent-fill) disabled:opacity-60">
            Stop ride emails
          </button>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {data.rides.length === 0 && <p className="text-[15px] text-(--ev-ink-80)">You&rsquo;re not on any rides right now.</p>}
        {data.rides.map((r) => (
          <section key={r.series_id} className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[18px] font-bold text-(--ev-ink)">
                <Link href={`/rides/${r.code}`} className="hover:underline">{r.name}</Link>
              </h2>
              {confirmLeave !== r.series_id && (
                <button onClick={() => setConfirmLeave(r.series_id)} className="min-h-[40px] text-[14px] font-semibold text-(--ev-ink-75) hover:text-(--ev-ink) hover:underline">
                  Leave this ride
                </button>
              )}
            </div>
            {confirmLeave === r.series_id && (
              <div className="mt-3 rounded-xl border border-(--ev-line-mid) bg-(--ev-panel) p-4">
                <p className="text-[15px] font-semibold text-(--ev-ink)">Leave {r.name}?</p>
                <p className="mt-1 text-[14px] text-(--ev-ink-80)">Your answers for its dates go, and you won&rsquo;t get its emails.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => { setConfirmLeave(null); void act({ action: 'leave', series_id: r.series_id }, `leave-${r.series_id}`) }}
                    disabled={saving === `leave-${r.series_id}`}
                    className="min-h-[40px] rounded-[10px] bg-(--ev-danger) px-4 text-[14px] font-bold text-white disabled:opacity-60">Leave the ride</button>
                  <button onClick={() => setConfirmLeave(null)} className="min-h-[40px] rounded-[10px] border border-(--ev-line-strong) px-4 text-[14px] font-semibold text-(--ev-ink)">Stay on it</button>
                </div>
              </div>
            )}
            {(r.every || r.chat || r.chat_waiting) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                {r.every && (r.every_date ? (
                  <p className="text-[15px] text-(--ev-ink-85)">
                    <b className="text-(--ev-ink)">You&rsquo;re in {r.every}.</b>{' '}
                    <button onClick={() => act({ action: 'every', series_id: r.series_id, on: false }, `every-${r.series_id}`)}
                      disabled={saving === `every-${r.series_id}`}
                      className="min-h-[40px] font-semibold text-(--ev-accent) hover:underline disabled:opacity-60">Stop</button>
                  </p>
                ) : r.dates.some((d) => d.status === 'scheduled') && (
                  <button onClick={() => act({ action: 'every', series_id: r.series_id, on: true }, `every-${r.series_id}`)}
                    disabled={saving === `every-${r.series_id}`}
                    className="min-h-[40px] text-[15px] font-semibold text-(--ev-accent) hover:underline disabled:opacity-60">
                    Count me in {r.every}
                  </button>
                ))}
                {r.chat && (
                  <a href={r.chat.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) px-3 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                    <MessageCircle size={15} /> {r.chat.label}
                  </a>
                )}
                {!r.chat && r.chat_waiting && (
                  <p className="inline-flex items-center gap-1.5 text-[15px] text-(--ev-ink-80)">
                    <MessageCircle size={15} aria-hidden /> Group chat: the organizer shares the invite
                  </p>
                )}
              </div>
            )}
            {shown(r).length === 0 ? (
              <p className="mt-2 text-[14px] text-(--ev-ink-75)">No upcoming dates.</p>
            ) : (
              <ul className="mt-3 divide-y divide-(--ev-line)">
                {shown(r).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-[15px] font-semibold text-(--ev-ink)">{dayShort(d.date)}, {dateShort(d.date)}</p>
                      <p className="text-[13px] text-(--ev-ink-75)">
                        {d.status === 'canceled' ? 'Cancelled' : [clock(d.start_time), d.meetup_name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {d.status === 'scheduled' && (
                      <div className="flex gap-1.5" role="radiogroup" aria-label={`Your answer for ${dateShort(d.date)}`}>
                        {ANSWERS.map((a) => {
                          const on = d.rsvp === a.value
                          return (
                            <button
                              key={a.value}
                              role="radio"
                              aria-checked={on}
                              disabled={saving === `${d.id}-${a.value}`}
                              onClick={() => act({ action: 'rsvp', occurrence_id: d.id, status: a.value }, `${d.id}-${a.value}`)}
                              className={`min-h-[40px] rounded-[10px] border px-3 text-[13px] font-bold transition-colors ${
                                on ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) text-(--ev-ink) hover:bg-(--ev-panel)'
                              }`}
                            >
                              {a.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {r.next?.occurrence_id === d.id && (
                      <NextChoices next={r.next} going={d.rsvp === 'going'} saving={saving}
                        onPick={(p, key) => act({ action: 'choose', occurrence_id: d.id, ...p }, key)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-8 space-y-3 border-t border-(--ev-line) pt-6 text-[14px] text-(--ev-ink-80)">
        <p>
          Ride emails are <b className="text-(--ev-ink)">{data.email_optout ? 'off' : 'on'}</b>.{' '}
          <button onClick={() => act({ action: data.email_optout ? 'optin' : 'optout' }, 'optout')} className="font-semibold text-(--ev-accent) hover:underline">
            {data.email_optout ? 'Turn them back on' : 'Turn them off'}
          </button>
        </p>
        {confirmForget ? (
          <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-4">
            <p className="font-semibold text-(--ev-ink)">Remove this address and every answer?</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => act({ action: 'forget' }, 'forget')} className="rounded-[10px] bg-(--ev-danger) px-4 py-2 text-[14px] font-bold text-white">Remove it</button>
              <button onClick={() => setConfirmForget(false)} className="rounded-[10px] border border-(--ev-line-strong) px-4 py-2 text-[14px] font-semibold text-(--ev-ink)">Keep it</button>
            </div>
          </div>
        ) : (
          <p>
            Not you, or done with rides?{' '}
            <button onClick={() => setConfirmForget(true)} className="font-semibold text-(--ev-accent) hover:underline">Remove this address</button>
          </p>
        )}
      </div>
    </>,
  )
}

/** "Where you join" and "Your job" for the first date they're coming to (Shift 01744). */
function NextChoices({ next, going, saving, onPick }: {
  next: NextPicks
  going: boolean
  saving: string | null
  onPick: (p: { stop?: string; job?: Job | 'none' }, key: string) => void
}) {
  const jobs = going && next.open ? (['front', 'sweep', 'corner'] as Job[]).filter((j) => next.open![j] > 0 || next.my_job === j) : []
  if (!next.stops.length && !jobs.length) return null
  const chip = (on: boolean) => `min-h-[40px] rounded-[10px] border px-3 py-1.5 text-left text-[14px] font-semibold transition-colors disabled:opacity-60 ${
    on ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) text-(--ev-ink) hover:bg-(--ev-panel)'}`
  return (
    <div className="w-full space-y-3 rounded-xl bg-(--ev-panel) p-4">
      {next.stops.length > 0 && (
        <div>
          <p className="text-[15px] font-semibold text-(--ev-ink)">Where you join</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Where you join">
            {next.stops.map((st, i) => {
              const on = (next.my_stop ?? 'start') === st.id
              return (
                <button key={st.id} role="radio" aria-checked={on} className={chip(on)} disabled={saving === `stop-${st.id}`}
                  onClick={() => !on && onPick({ stop: st.id }, `stop-${st.id}`)}>
                  {st.label}
                  {st.time && <span className="font-normal"> · {i === 0 ? '' : 'about '}{clock(`${st.time}:00`)}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {jobs.length > 0 && (
        <div>
          <p className="text-[15px] font-semibold text-(--ev-ink)">Can you help?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Can you help?">
            {[...jobs, null].map((j) => {
              const on = j === next.my_job || (j === null && !next.my_job)
              const key = `job-${j ?? 'none'}`
              return (
                <button key={key} role="radio" aria-checked={on} className={chip(on)} disabled={saving === key}
                  onClick={() => !on && onPick({ job: j ?? 'none' }, key)}>
                  {j ? JOB_WORDS[j] : 'Not this time'}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
