'use client'

import { useEffect, useState } from 'react'
import WeekGrid from '../../WeekGrid'

/*
 * An instructor's answer to one free lesson request (Shift 01750), from the
 * two links in the ask email. A page rather than a one-click link, so a mail
 * scanner opening the link can't answer for them. The learner's contact
 * details show only after Yes.
 */

type View = {
  ok: boolean
  state: 'open' | 'yes' | 'no' | 'expired' | 'closed' | 'not_found'
  learner?: { first: string; place: string | null; cells: string[]; free: string; note: string | null }
  contact?: { name: string; email: string; phone: string | null; code: string | null } | null
  teacher?: { hello: string; calls_first: boolean; manage_token: string }
}

const BTN =
  'flex min-h-[56px] w-full items-center justify-center rounded-2xl px-6 text-[1.0625rem] font-bold transition-opacity hover:opacity-90 disabled:opacity-50'
const LINK = 'font-bold text-forest underline underline-offset-4 hover:opacity-80'
const CARD = 'rounded-[22px] bg-white p-6 sm:p-7'

async function call(body: Record<string, unknown>): Promise<View> {
  const res = await fetch('/api/free-lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!data?.state) throw new Error('failed')
  return data
}

export default function OfferAnswer({ token, from }: { token: string; from: 'yes' | 'no' | null }) {
  const [view, setView] = useState<View | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    call({ action: 'offer_get', token }).then(setView, () => setFailed(true))
  }, [token])

  async function answer(a: 'yes' | 'no') {
    setBusy(true)
    setFailed(false)
    try {
      setView(await call({ action: 'offer_answer', token, answer: a }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const retry = failed && (
    <p className="mt-4 text-[0.9375rem] font-semibold text-[#B42318]" role="alert">
      Something went wrong. Please try again, or write to{' '}
      <a href="mailto:info@gogreenstreets.org" className={LINK}>
        info@gogreenstreets.org
      </a>
      .
    </p>
  )

  if (!view) {
    return <div className={CARD}>{failed ? retry : <p className="text-[1rem] text-navy/80">Loading…</p>}</div>
  }
  if (!view.ok || view.state === 'not_found' || !view.learner || !view.teacher) {
    return (
      <div className={CARD}>
        <h1 className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[1.75rem] font-extrabold leading-tight text-navy">This link has expired</h1>
        <p className="mt-3 text-[1rem] leading-relaxed text-navy">
          Write to <a href="mailto:info@gogreenstreets.org" className={LINK}>info@gogreenstreets.org</a> and we’ll sort it out.
        </p>
      </div>
    )
  }

  const { learner: l, teacher: t, contact: c } = view
  const hours = (
    <p className="mt-6 text-[0.9375rem] leading-relaxed text-navy/80">
      Your usual times or area changed?{' '}
      <a href={`/bike-lessons/teach/${t.manage_token}`} className={LINK}>
        Update them here
      </a>
      .
    </p>
  )

  if (view.state === 'yes' && c) {
    return (
      <div className={CARD}>
        <p className="font-mono text-[0.8125rem] uppercase tracking-[0.06em] text-forest">You’re teaching</p>
        <h1 className="mt-1 [font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[1.75rem] font-extrabold leading-tight text-navy">
          Thanks, {t.hello}. Here’s how to reach {l.first}.
        </h1>
        <dl className="mt-5 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-3 border-t border-navy/10 pt-5 text-[1rem]">
          <dt className="font-semibold text-navy/80">Name</dt>
          <dd className="text-navy">{c.name}</dd>
          <dt className="font-semibold text-navy/80">Email</dt>
          <dd className="break-all">
            <a href={`mailto:${c.email}`} className={LINK}>{c.email}</a>
          </dd>
          {c.phone && (
            <>
              <dt className="font-semibold text-navy/80">Phone</dt>
              <dd>
                <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className={LINK}>{c.phone}</a>
              </dd>
            </>
          )}
          {c.code && (
            <>
              <dt className="font-semibold text-navy/80">Code</dt>
              <dd className="font-mono font-bold tracking-wider text-navy">{c.code}</dd>
            </>
          )}
        </dl>
        <p className="mt-5 text-[1rem] leading-relaxed text-navy">
          {t.calls_first && c.phone ? `Give ${l.first} a call to pick a time.` : `Email ${l.first} to pick a time.`} We’ve told them
          you’ll be in touch, and emailed you these details too. Put the code on your invoice to Green Streets.
        </p>
        {hours}
      </div>
    )
  }

  if (view.state !== 'open') {
    const msg =
      view.state === 'no'
        ? ['Thanks for letting us know', `We’ll ask another instructor for ${l.first}.`]
        : view.state === 'expired'
        ? ['We asked another instructor', `Two days passed, so ${l.first}’s request moved on. Thanks for teaching with us.`]
        : ['Another instructor is teaching', `${l.first} is taken care of. Thanks for teaching with us.`]
    return (
      <div className={CARD}>
        <h1 className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[1.75rem] font-extrabold leading-tight text-navy">{msg[0]}</h1>
        <p className="mt-3 text-[1rem] leading-relaxed text-navy">{msg[1]}</p>
        {hours}
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="font-mono text-[0.8125rem] uppercase tracking-[0.06em] text-forest">Free road lesson</p>
      <h1 className="mt-1 [font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[2rem] font-extrabold leading-tight text-navy">
        Can you teach {l.first}?
      </h1>
      <p className="mt-2 text-[1rem] leading-relaxed text-navy">
        90 minutes on real streets{l.place ? `, near ${l.place}` : ''}. Green Streets pays your usual rate.
      </p>

      <div className="mt-6">
        <p className="mb-2 text-[0.9375rem] font-semibold text-navy">{l.first} is usually free</p>
        {l.cells.length ? <WeekGrid cells={l.cells} /> : null}
        <p className="mt-2 text-[0.9375rem] leading-snug text-navy">{l.free}</p>
      </div>
      {l.note && (
        <blockquote className="mt-5 rounded-2xl bg-cream px-4 py-3 text-[1rem] leading-relaxed text-navy">“{l.note}”</blockquote>
      )}

      <div className="mt-7 flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer('yes')}
          className={`${BTN} bg-forest text-white ${from === 'no' ? 'ring-0' : 'ring-4 ring-forest/20'}`}
        >
          Yes, I’ll set a time
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer('no')}
          className={`${BTN} border-2 border-navy/15 bg-white text-navy ${from === 'no' ? 'ring-4 ring-navy/10' : ''}`}
        >
          Can’t take this one
        </button>
      </div>
      {retry}
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-navy/80">
        Yes shows you {l.first}’s email{t.calls_first ? ' and phone' : ''}. No answer in two days, and we ask someone else.
      </p>
      {hours}
    </div>
  )
}
