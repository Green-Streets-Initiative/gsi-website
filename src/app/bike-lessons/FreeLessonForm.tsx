'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import posthog from 'posthog-js'
import { Check } from '@phosphor-icons/react'
import { gaEvent } from '@/lib/ga'
import { trackAdConversion } from '@/lib/ad-pixels'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { bikeLessonsStrings } from '@/lib/site-strings/bike-lessons'

/*
 * The free 1:1 street lesson, matched to an instructor (Shift 01750, Keith
 * 2026-11-12, sketch B "Your week"). The learner types their ZIP or town and
 * taps when they're usually free; the instructors who reach them show up,
 * with how many of those times each usually teaches, best fit first. They ask
 * one; the free-lessons function emails that instructor a Yes / Can't, and
 * on a no or two days of silence asks the next who fits. Instructors' usual
 * hours come from Green Streets, never weekly posting.
 *
 * Far away or all taken, it says so and offers the next-best thing. Shift
 * comes after, in `after`. Labels follow `locale`
 * (src/lib/site-strings/bike-lessons.ts); what the form sends is the same in
 * every language.
 */

const FIELD =
  'min-h-[48px] w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-[1rem] text-navy outline-none transition-colors placeholder:text-ink-soft focus:border-forest'
const LABEL = 'mb-1 block text-[0.9375rem] font-semibold text-navy'
const LINK = 'font-bold text-forest underline underline-offset-4 hover:opacity-80'
const NOTE = 'text-[1rem] leading-[1.55] text-navy'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const PARTS = ['am', 'pm', 'eve'] as const
const PART_KEY = { am: 'lessons.part_am', pm: 'lessons.part_pm', eve: 'lessons.part_eve' } as const
/** Forest, the one accent on GSI pages (blue is Shift's; brown was retired 2026-10-12). */
const FOREST = '#2D6A4F'

type Teacher = { id: string; name: string; org: string | null; area: string; hours: string[]; calls_first: boolean }
type Status = 'idle' | 'sending' | 'sent' | 'already' | 'far' | 'full' | 'error'
type Look = { state: 'none' } | { state: 'looking' } | { state: 'bad' } | { state: 'ok'; place: string; teachers: Teacher[]; left: number }

export default function FreeLessonForm({
  buttonClass,
  leagueUrl,
  after,
  locale = 'en',
}: {
  buttonClass: string
  leagueUrl?: string
  after?: ReactNode
  locale?: SiteLocale
}) {
  const t = translator(bikeLessonsStrings, locale)
  const sp = locale === 'zh-Hans' ? '' : ' '
  const dayShort = t('lessons.days').split(',')
  const dayLong = t('lessons.days_long').split(',')
  const partLong = t('lessons.parts_long').split(',')

  const [place, setPlace] = useState('')
  const [look, setLook] = useState<Look>({ state: 'none' })
  const [cells, setCells] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [askedName, setAskedName] = useState('')
  const [showWho, setShowWho] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [source, setSource] = useState('')
  const seq = useRef(0)
  const box = useRef<HTMLDivElement>(null)

  // The answer replaces a tall form; keep it in view rather than leave them further down the page.
  useEffect(() => {
    if (status === 'sent' || status === 'already' || status === 'far' || status === 'full') {
      box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [status])

  // Where this visit came from (an ad, a partner's newsletter), so each request names its channel.
  // Kept for the tab, so a language switch or a second look at the page keeps it.
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('utm_source') || sessionStorage.getItem('gsi_lesson_src') || ''
      const clean = raw.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 30)
      if (clean) {
        setSource(clean)
        sessionStorage.setItem('gsi_lesson_src', clean)
      }
    } catch {
      /* private mode: no source, the request still goes */
    }
  }, [])

  // Who reaches this place, looked up as they type (a ZIP is enough).
  useEffect(() => {
    const q = place.trim()
    if (q.length < 3) {
      setLook({ state: 'none' })
      return
    }
    const n = ++seq.current
    const timer = setTimeout(async () => {
      setLook({ state: 'looking' })
      try {
        const res = await fetch('/api/free-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'match', place: q }),
        })
        const data = await res.json().catch(() => null)
        if (n !== seq.current) return
        if (!res.ok || !data?.ok) return setLook({ state: 'bad' })
        setLook({ state: 'ok', place: q, teachers: data.teachers ?? [], left: data.left ?? 0 })
      } catch {
        if (n === seq.current) setLook({ state: 'bad' })
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [place])

  const teachers = look.state === 'ok' ? look.teachers : []
  const ranked = useMemo(() => {
    const fits = (x: Teacher) => x.hours.filter((h) => cells.has(h)).length
    return teachers
      .map((x) => ({ ...x, fits: fits(x) }))
      .sort((a, b) => b.fits - a.fits)
  }, [teachers, cells])
  // The best fit is picked until they pick someone themselves.
  const chosen = ranked.find((x) => x.id === picked) ?? ranked.find((x) => x.fits > 0) ?? null
  const teaches = (cell: string) => ranked.find((x) => x.hours.includes(cell))

  const clearError = () => {
    if (status === 'error') setStatus('idle')
  }
  const fail = (msg: string, reason = 'other') => {
    setStatus('error')
    setError(msg)
    // Counted so a form that stops working shows up as errors, not silence (Nov 13 to 17: 0 of 6 finished).
    try {
      posthog.capture('free_lesson_form_error', { reason })
    } catch {
      /* analytics must never break the form */
    }
  }
  const toggle = (cell: string) => {
    clearError()
    setCells((prev) => {
      const next = new Set(prev)
      if (next.has(cell)) next.delete(cell)
      else next.add(cell)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (look.state !== 'ok') return fail(t(look.state === 'bad' ? 'lessons.err_place_unknown' : 'lessons.err_place'), 'place')
    if (!cells.size) return fail(t('lessons.err_cells'), 'cells')
    if (!chosen) return fail(t('lessons.err_teacher'), 'teacher')
    if (!name.trim()) return fail(t('lessons.err_name'), 'name')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return fail(t('lessons.err_email'), 'email')
    if (chosen.calls_first && phone.replace(/\D/g, '').length < 10) return fail(t('lessons.err_phone', { name: chosen.name }), 'phone')
    setStatus('sending')
    try {
      const res = await fetch('/api/free-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim',
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          place: look.place,
          cells: [...cells],
          teacher: chosen.id,
          note: note.trim(),
          source,
          website,
        }),
      })
      const data = await res.json().catch(() => null)
      const state = data?.state
      if (res.ok && (state === 'sent' || state === 'already' || state === 'far' || state === 'full')) {
        setAskedName(data?.teacher?.name ?? chosen.name)
        setStatus(state)
        // Only a request sent to an instructor is a result for the ads; the rest are tracked apart.
        if (state === 'sent') {
          gaEvent('free_lesson_code_requested')
          // The Meta and Reddit pixels too, so a lesson ad can pay for requests rather than visits.
          trackAdConversion('FreeLessonRequested', { source: source || undefined })
        }
        if (state !== 'sent') gaEvent('free_lesson_code_unavailable', { state })
        // PostHog too, so the weekly search and ads scoreboard counts a lesson request (SEO hyp-20).
        try {
          posthog.capture(state === 'sent' ? 'free_lesson_code_requested' : 'free_lesson_code_unavailable', { state })
        } catch {
          /* analytics must never break the form */
        }
        return
      }
      if (res.ok && state === 'no_fit') return fail(t('lessons.err_teacher'), 'server_no_fit')
      if (data?.error === 'name') return fail(t('lessons.err_name'), 'server_name')
      if (data?.error === 'email') return fail(t('lessons.err_email'), 'server_email')
      if (data?.error === 'phone') return fail(t('lessons.err_phone', { name: chosen.name }), 'server_phone')
      if (data?.error === 'availability') return fail(t('lessons.err_cells'), 'server_cells')
      if (data?.error === 'place') return fail(t('lessons.err_place_unknown'), 'server_place')
      fail(t('lessons.err_failed'), `server_${res.status}`)
    } catch {
      fail(t('lessons.err_failed'), 'network')
    }
  }

  if (status === 'sent') {
    return (
      <div role="status" ref={box}>
        <p className="text-[1.125rem] font-bold leading-snug text-forest">{t('lessons.sent_title', { name: name.trim().split(/\s+/)[0] })}</p>
        <p className={`${NOTE} mt-2`}>{t('lessons.sent_asked', { teacher: askedName })}</p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-navy/80">{t('lessons.sent_code')}</p>
        {after}
      </div>
    )
  }

  if (status === 'already') {
    return (
      <div role="status" ref={box}>
        <p className="text-[1.125rem] font-bold leading-snug text-forest">{t('lessons.already_title')}</p>
        <p className={`${NOTE} mt-2`}>{t('lessons.already_body')}</p>
        {after}
      </div>
    )
  }

  const farNote = (
    <p className={NOTE}>
      {t('lessons.far_body')}
      {leagueUrl && (
        <>
          {sp}{t('lessons.far_league')}{sp}
          <a href={leagueUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
            {t('lessons.far_link')}
          </a>
        </>
      )}
    </p>
  )
  const fullNote = (
    <p className={NOTE}>
      {t('lessons.full_body')}{sp}
      <a href="#classes" className={LINK}>
        {t('lessons.full_link')}
      </a>
    </p>
  )

  if (status === 'far') return <div role="status" ref={box}>{farNote}</div>
  if (status === 'full') return <div role="status" ref={box}>{fullNote}</div>

  const far = look.state === 'ok' && !teachers.length
  const full = look.state === 'ok' && teachers.length > 0 && look.left <= 0
  const ready = look.state === 'ok' && teachers.length > 0 && !full

  return (
    <form onSubmit={submit} noValidate>
      <label className="block">
        <span className={LABEL}>{t('lessons.label_place')}</span>
        <input
          type="text"
          value={place}
          onChange={(e) => {
            setPlace(e.target.value)
            clearError()
          }}
          placeholder={t('lessons.placeholder_place')}
          autoComplete="postal-code"
          required
          className={FIELD}
        />
      </label>
      <p className="mt-1.5 min-h-[22px] text-[0.875rem] leading-snug text-navy/80" aria-live="polite">
        {look.state === 'looking' && t('lessons.place_looking')}
        {look.state === 'bad' && <span className="font-semibold text-[#B42318]">{t('lessons.err_place_unknown')}</span>}
      </p>

      {far && <div className="mt-2">{farNote}</div>}
      {full && <div className="mt-2">{fullNote}</div>}

      {ready && (
        <>
          <fieldset className="mt-3">
            <legend className={LABEL}>{t('lessons.label_availability')}</legend>
            <p className="mb-2 text-[0.875rem] leading-snug text-navy/80">{t('lessons.when_hint')}</p>
            <div className="grid grid-cols-[34px_repeat(7,minmax(0,1fr))] gap-1" role="group">
              <span />
              {DAYS.map((d, i) => (
                <span key={d} className="text-center text-[0.875rem] font-semibold text-navy/80" aria-hidden="true">
                  {dayShort[i]}
                </span>
              ))}
              {PARTS.map((p, pi) => (
                <PartRow
                  key={p}
                  label={t(PART_KEY[p])}
                  cells={DAYS.map((d, di) => {
                    const cell = `${d}-${p}`
                    const on = cells.has(cell)
                    const by = ready ? teaches(cell) : undefined
                    // Only times an instructor near them teaches can be picked; the rest are gray.
                    const off = !by && !on
                    return (
                      <button
                        key={cell}
                        type="button"
                        onClick={() => toggle(cell)}
                        disabled={off}
                        aria-pressed={on}
                        aria-label={`${dayLong[di]} ${partLong[pi]}`}
                        className={`flex h-11 items-center justify-center rounded-lg border-2 transition-colors ${
                          on ? 'border-forest bg-forest text-white' : off ? 'cursor-default border-transparent bg-navy/[0.06]' : 'border-forest/40 bg-white hover:border-forest'
                        }`}
                      >
                        {on && <Check size={20} weight="bold" aria-hidden="true" />}
                      </button>
                    )
                  })}
                />
              ))}
            </div>
          </fieldset>

          {cells.size > 0 && chosen && !showWho && (
            <div className="mt-5 flex items-start gap-3">
              <Initial name={chosen.name} />
              <div className="min-w-0">
                <p className="text-[1rem] leading-snug text-navy">
                  <span className="font-bold">{t('lessons.ask_first', { name: chosen.name })}</span>{' '}
                  <span className="text-navy/80">{t('lessons.chosen_why', { name: chosen.name })}</span>
                </p>
                {ranked.length > 1 && (
                  <button type="button" onClick={() => setShowWho(true)} className={`${LINK} mt-1 min-h-[44px] text-[0.9375rem]`}>
                    {t('lessons.pick_other')}
                  </button>
                )}
              </div>
            </div>
          )}

          {cells.size > 0 && !chosen && (
            <p className={`${NOTE} mt-4 font-semibold`} role="status">{t('lessons.no_fit')}</p>
          )}

          {cells.size > 0 && (showWho || !chosen) && (
            <fieldset className="mt-5">
              <legend className={LABEL}>{t('lessons.who_title')}</legend>
              <div className="flex flex-col gap-2">
                {ranked.map((x) => {
                  const sel = chosen?.id === x.id
                  return (
                    <label
                      key={x.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-white px-3 py-3 transition-colors ${sel ? 'border-forest' : 'border-transparent'}`}
                    >
                      <input
                        type="radio"
                        name="teacher"
                        value={x.id}
                        checked={sel}
                        onChange={() => {
                          setPicked(x.id)
                          clearError()
                        }}
                        className="mt-2.5 h-5 w-5 shrink-0 accent-forest"
                      />
                      <Initial name={x.name} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-[1rem] font-bold leading-snug text-navy">
                          {x.name}
                          {x.org && <span className="font-normal text-navy/80"> · {x.org}</span>}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <FitMeter fits={x.fits} of={cells.size} />
                          <span className="text-[0.875rem] font-semibold text-navy">
                            {x.fits ? t('lessons.fits', { n: x.fits }) : t('lessons.fits_none')}
                          </span>
                          {x.calls_first && (
                            <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[0.875rem] font-bold text-[#1F4D3A]">
                              {t('lessons.calls_first')}
                            </span>
                          )}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          {chosen && cells.size > 0 && (
            <>
              <label className="mt-5 block">
                <span className={LABEL}>{t('lessons.label_name')}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    clearError()
                  }}
                  autoComplete="name"
                  maxLength={80}
                  required
                  className={FIELD}
                />
              </label>
              <label className="mt-3 block">
                <span className={LABEL}>{t('lessons.label_email')}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearError()
                  }}
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                  className={FIELD}
                />
              </label>
              {chosen?.calls_first && (
                <label className="mt-3 block">
                  <span className={LABEL}>{t('lessons.label_phone')}</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      clearError()
                    }}
                    autoComplete="tel"
                    maxLength={30}
                    required
                    className={FIELD}
                  />
                  <span className="mt-1 block text-[0.875rem] leading-snug text-navy/80">
                    {t('lessons.phone_why', { name: chosen.name })}
                  </span>
                </label>
              )}
              {/* Optional, so it stays a link: the long note was where one learner stalled (Nov 13 to 17). */}
              {noteOpen ? (
                <label className="mt-3 block">
                  <span className={LABEL}>
                    {t('lessons.label_note')} <span className="font-normal text-navy/80">{t('lessons.optional')}</span>
                  </span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('lessons.placeholder_note')}
                    rows={2}
                    maxLength={500}
                    autoFocus
                    className={`${FIELD} resize-y`}
                  />
                </label>
              ) : (
                <p className="mt-2 text-[0.9375rem] text-navy/80">
                  <button type="button" onClick={() => setNoteOpen(true)} className={`${LINK} min-h-[44px]`}>
                    {t('lessons.add_note', { name: chosen.name })}
                  </button>{' '}
                  {t('lessons.optional')}
                </p>
              )}
            </>
          )}

          {/* People never fill this in; a bot that does is ignored. */}
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
            name="website"
          />
          {chosen && cells.size > 0 && (
            <>
              <button type="submit" disabled={status === 'sending'} className={`${buttonClass} mt-4 w-full disabled:opacity-50`}>
                {status === 'sending' ? t('lessons.sending') : t('lessons.send_to', { name: chosen.name })}
              </button>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-navy/80">{t('lessons.form_note')}</p>
            </>
          )}
          {status === 'error' && (
            <p className="mt-2 text-[0.9375rem] font-semibold text-[#B42318]" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </form>
  )
}

function PartRow({ label, cells }: { label: string; cells: ReactNode[] }) {
  return (
    <>
      <span className="flex items-center text-[0.875rem] font-semibold text-navy/80">{label}</span>
      {cells}
    </>
  )
}

/** How many of their times this instructor usually teaches, as a small meter. */
function FitMeter({ fits, of }: { fits: number; of: number }) {
  const n = Math.min(Math.max(of, 1), 7)
  const on = Math.min(fits, n)
  return (
    <span className="inline-flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="h-2 w-3 rounded-[3px]" style={{ background: i < on ? FOREST : '#E3E6DE' }} />
      ))}
    </span>
  )
}

/** The instructor's initial. */
function Initial({ name }: { name: string }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-[1.0625rem] font-bold text-white"
      aria-hidden="true"
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  )
}
