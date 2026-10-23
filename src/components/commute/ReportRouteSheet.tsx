'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from '@phosphor-icons/react'

/*
 * "Report a problem with this route" (Shift product item 15). A quiet link
 * under a route drawer opens a small sheet: what's wrong as chips, an
 * optional note and email, Send. The report carries its own context (the
 * surface, the stretch and the rating we showed, which map data decided
 * it), so the reporter is asked for nothing else. Never the home or work
 * address. Design: Shift docs/handoffs/report-route-problem-handoff.md.
 *
 * Phase 1 is the Commute Advisor; Nearby reuses this with its own surfaces.
 */

export type RouteIssueSurface =
  | 'advisor_bike' | 'advisor_transit' | 'advisor_drive' | 'advisor_walk'
  | 'advisor_bike_transit' | 'advisor_park_ride'

type Kind = 'comfort_wrong' | 'lane_changed' | 'closed' | 'unsafe_spot' | 'wrong_name' | 'bad_route' | 'other'

const KIND_LABELS: Record<Kind, string> = {
  comfort_wrong: 'The comfort rating is wrong',
  lane_changed: 'A bike lane is missing or new',
  closed: 'Road closed or construction',
  unsafe_spot: 'An unsafe spot',
  wrong_name: 'Wrong street name',
  bad_route: 'A bad route choice',
  other: 'Something else',
}

/** Only the choices that fit the way in: no comfort rating where we show none. */
const KINDS_FOR: Record<RouteIssueSurface, Kind[]> = {
  advisor_bike: ['comfort_wrong', 'lane_changed', 'closed', 'unsafe_spot', 'wrong_name', 'bad_route', 'other'],
  advisor_bike_transit: ['lane_changed', 'closed', 'unsafe_spot', 'wrong_name', 'bad_route', 'other'],
  advisor_walk: ['closed', 'unsafe_spot', 'wrong_name', 'bad_route', 'other'],
  advisor_transit: ['closed', 'unsafe_spot', 'wrong_name', 'bad_route', 'other'],
  advisor_park_ride: ['closed', 'unsafe_spot', 'wrong_name', 'bad_route', 'other'],
  advisor_drive: ['closed', 'unsafe_spot', 'wrong_name', 'bad_route', 'other'],
}

const NOTE_MAX = 280

/** The note's example, in the words of that way in. */
const NOTE_EXAMPLE: Record<RouteIssueSurface, string> = {
  advisor_bike: 'For example: the new bike lane opened in September.',
  advisor_bike_transit: 'For example: there is no bike rack at the station.',
  advisor_walk: 'For example: the sidewalk is closed on one side.',
  advisor_transit: 'For example: the stop moved across the street.',
  advisor_park_ride: 'For example: the lot fills up by 7:30 AM.',
  advisor_drive: 'For example: this road is closed until spring.',
}

export interface RouteIssueStretch {
  /** Index of the stretch in the drawer's list. */
  index: number
  label: string
  miles: number
  lat: number | null
  lng: number | null
  /** The rating we showed, as a word ("quiet_street"). */
  rating: string
  /** How the sheet names it: "McGrath Hwy, 0.1 mi, shown as quiet street". */
  phrase: string
  /** The stretch's colour on the map and its chip, so the sheet shows the same chip. */
  color?: string
  dashed?: boolean
  /** "0.1 mi · shown as quiet street", beside the label on the chip. */
  detail?: string
}

export interface ReportRouteLinkProps {
  surface: RouteIssueSurface
  /** The stretch the reader picked, when there is one; else the whole route is the subject. */
  stretch?: RouteIssueStretch | null
  /** Shown for the whole route when no stretch is picked ("Davis to Park Street"). */
  routeLabel?: string | null
  /** Which map data decided the ratings (massdot, mapc, osm, none). */
  sources?: string[]
  /** The route's line, hashed in the browser to group reports on the same route. */
  routePoints?: { lat: number; lng: number }[] | null
  employerSlug?: string | null
  track: (event: string, props?: Record<string, unknown>) => void
}

async function hashRoute(points: { lat: number; lng: number }[]): Promise<string | null> {
  try {
    const text = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
  } catch {
    return null
  }
}

type SendState = 'idle' | 'sending' | 'sent' | 'error' | 'too_many' | 'bad_email'

/** The same shape the server checks, so a typo is caught here, not after a round trip. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function ReportRouteLink({ surface, stretch, routeLabel, sources, routePoints, employerSlug, track }: ReportRouteLinkProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const linkRef = useRef<HTMLButtonElement>(null)
  const openedAt = useRef(0)
  const closedBy = useRef<string>('close')
  // A backdrop close needs the press to start on the backdrop too, so a text
  // selection that ends outside the sheet doesn't throw the draft away.
  const pressStartedOnBackdrop = useRef(false)
  const [open, setOpen] = useState(false)
  const [kinds, setKinds] = useState<Kind[]>([])
  const [note, setNote] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SendState>('idle')

  const choices = KINDS_FOR[surface]
  const subject = stretch ? stretch.phrase : routeLabel ? `the whole route, ${routeLabel}` : 'the whole route'
  const titleId = `route-issue-title-${surface}`

  const openSheet = () => {
    setKinds([])
    setNote('')
    setEmail('')
    setState('idle')
    closedBy.current = 'close'
    openedAt.current = Date.now()
    setOpen(true)
    track('route_issue_sheet_opened', { surface, segment_prefilled: !!stretch })
  }

  // showModal gives the sheet a real dialog: focus moves in, Escape closes it,
  // the page behind can't be reached.
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const close = (affordance: string) => {
    closedBy.current = affordance
    setOpen(false)
  }

  // One handler for every way out (button, Escape, backdrop, the auto-close after thanks).
  const onClosed = () => {
    setOpen(false)
    // Closed mid-send: the report may still land, so it isn't a dismissal.
    if (state !== 'sent' && state !== 'sending') {
      track('route_issue_dismissed', {
        surface,
        seconds_on_screen: Math.round((Date.now() - openedAt.current) / 1000),
        affordance: closedBy.current,
        kinds_picked: kinds.length,
      })
    }
    linkRef.current?.focus()
  }

  useEffect(() => {
    if (state !== 'sent') return
    const t = setTimeout(() => close('auto'), 2600)
    return () => clearTimeout(t)
  }, [state])

  const toggle = (k: Kind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))

  const send = async () => {
    if (kinds.length === 0 || state === 'sending') return
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setState('bad_email')
      return
    }
    setState('sending')
    const route_hash = routePoints && routePoints.length > 1 ? await hashRoute(routePoints) : null
    const body = {
      surface,
      kinds,
      note: note.trim() || null,
      email: email.trim() || null,
      route_hash,
      segment: stretch
        ? { index: stretch.index, label: stretch.label, miles: Number(stretch.miles.toFixed(2)), lat: stretch.lat, lng: stretch.lng, rating: stretch.rating }
        : routeLabel ? { label: routeLabel } : null,
      sources: sources && sources.length > 0 ? sources : null,
      employer_slug: employerSlug ?? null,
    }
    try {
      const res = await fetch('/api/commute/report-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setState('sent')
        // Never the note or the email: what was picked, and what we had shown.
        track('route_issue_reported', {
          surface,
          kinds,
          has_note: !!body.note,
          has_email: !!body.email,
          has_segment: !!stretch,
          rating_shown: stretch?.rating ?? null,
          seconds_on_screen: Math.round((Date.now() - openedAt.current) / 1000),
        })
        return
      }
      const err = await res.json().then((d) => d?.error).catch(() => null)
      setState(res.status === 429 ? 'too_many' : err === 'bad_email' ? 'bad_email' : 'error')
      track('route_issue_failed', { surface, status: res.status })
    } catch {
      setState('error')
      track('route_issue_failed', { surface, status: 0 })
    }
  }

  return (
    <>
      <button
        ref={linkRef}
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center text-[0.875rem] font-semibold text-[#4A4D68] underline decoration-[rgba(74,77,104,0.45)] underline-offset-[3px] transition-colors hover:text-[#191A2E] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
      >
        Report a problem with this route
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={onClosed}
        onCancel={() => { closedBy.current = 'escape' }}
        onPointerDown={(e) => { pressStartedOnBackdrop.current = e.target === e.currentTarget }}
        onClick={(e) => { if (e.target === e.currentTarget && pressStartedOnBackdrop.current) close('backdrop') }}
        className="m-0 mt-auto max-h-[92vh] w-full max-w-none rounded-t-2xl bg-white p-0 text-[#191A2E] shadow-[0_-8px_32px_rgba(25,26,46,0.18)] backdrop:bg-[rgba(25,26,46,0.55)] sm:m-auto sm:max-w-[460px] sm:rounded-2xl"
      >
        {open && (
          <div className="flex max-h-[92vh] flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-[rgba(25,26,46,0.08)] px-5 pb-3 pt-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-[1.0625rem] font-extrabold leading-snug">Report a problem with this route</h2>
                {stretch?.color ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.9375rem] leading-snug text-[#4A4D68]">
                    About
                    <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border border-[rgba(25,26,46,0.12)] bg-white px-2.5 py-1 text-[0.9375rem]">
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 shrink-0 rounded-[3px]"
                        style={stretch.dashed ? { border: `2px dashed ${stretch.color}` } : { backgroundColor: stretch.color }}
                      />
                      <span className="whitespace-nowrap font-semibold text-[#191A2E]">{stretch.label}</span>
                      {stretch.detail && <span className="whitespace-nowrap text-[#4A4D68]">{stretch.detail}</span>}
                    </span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-[0.9375rem] leading-snug text-[#4A4D68]">About {subject}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => close('close')}
                aria-label="Close"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[rgba(25,26,46,0.15)] text-[#4A4D68] transition-colors hover:bg-[#F4F8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
              >
                <X size={18} weight="bold" aria-hidden />
              </button>
            </div>

            {state === 'sent' ? (
              <div className="px-5 py-8" role="status">
                <p className="text-[1.0625rem] font-bold">Thanks.</p>
                <p className="mt-1 text-[0.9375rem] text-[#4A4D68]">We check every report against the map data.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                  <fieldset className="m-0 border-0 p-0">
                    <legend className="mb-2 text-[0.9375rem] font-bold">What&apos;s wrong? Pick any.</legend>
                    <div className="flex flex-wrap gap-2">
                      {choices.map((k) => {
                        const on = kinds.includes(k)
                        return (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(k)}
                            className={`min-h-[44px] cursor-pointer rounded-full border px-3.5 text-left text-[0.9375rem] font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F] ${
                              on ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white' : 'border-[rgba(25,26,46,0.18)] bg-white text-[#191A2E] hover:border-[#2D6A4F]'
                            }`}
                          >
                            {KIND_LABELS[k]}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>

                  <label className="mt-5 block text-[0.9375rem] font-bold" htmlFor={`${titleId}-note`}>
                    Anything to add? <span className="font-normal text-[#4A4D68]">(optional)</span>
                  </label>
                  <textarea
                    id={`${titleId}-note`}
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                    maxLength={NOTE_MAX}
                    rows={3}
                    placeholder={NOTE_EXAMPLE[surface]}
                    aria-describedby={`${titleId}-count`}
                    className="mt-1.5 block w-full resize-none rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.15)] bg-white px-3 py-2.5 text-[1rem] text-[#191A2E] outline-none placeholder:text-[#6B6E85] focus:border-[#2D6A4F]"
                  />
                  <p id={`${titleId}-count`} className="mt-1 text-right text-[0.875rem] tabular-nums text-[#4A4D68]">
                    {NOTE_MAX - note.length} left
                  </p>

                  <label className="mt-3 block text-[0.9375rem] font-bold" htmlFor={`${titleId}-email`}>
                    Your email <span className="font-normal text-[#4A4D68]">(optional)</span>
                  </label>
                  <p id={`${titleId}-email-why`} className="text-[0.875rem] text-[#4A4D68]">Only if you&apos;d like to hear back.</p>
                  <input
                    id={`${titleId}-email`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (state === 'bad_email') setState('idle') }}
                    aria-invalid={state === 'bad_email'}
                    aria-describedby={`${titleId}-email-why`}
                    className="mt-1.5 block w-full rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.15)] bg-white px-3 py-2.5 text-[1rem] text-[#191A2E] outline-none focus:border-[#2D6A4F]"
                  />
                </div>

                <div className="border-t border-[rgba(25,26,46,0.08)] px-5 pt-3" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
                  {(state === 'error' || state === 'too_many' || state === 'bad_email') && (
                    <p role="alert" className="mb-2 text-[0.9375rem] text-[#9B2C2C]">
                      {state === 'too_many'
                        ? "That's a lot of reports from here in one hour. Please try again later."
                        : state === 'bad_email'
                          ? 'Check your email address, or leave it blank.'
                          : "That didn't send. Please try again in a minute."}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={send}
                    disabled={kinds.length === 0 || state === 'sending'}
                    className="min-h-[48px] w-full cursor-pointer rounded-full bg-[#2D6A4F] text-[1rem] font-bold text-white transition-colors hover:bg-[#1F4D3A] disabled:cursor-not-allowed disabled:bg-[rgba(25,26,46,0.12)] disabled:text-[#4A4D68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
                  >
                    {state === 'sending' ? 'Sending…' : kinds.length === 0 ? "Pick what's wrong to send" : 'Send report'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  )
}
