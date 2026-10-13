'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAR_FOR_BUSINESS,
  CAR_PART_OPTIONS,
  DAY_MODE_BY_CODE,
  DAY_MODE_GROUP_LABEL,
  DAY_MODE_OPTIONS,
  END_TIME,
  INCENTIVES,
  INCENTIVE_RATINGS,
  INTERESTS,
  LONGEST_LEG_LABEL,
  MILES_ONE_WAY,
  MINUTES_ONE_WAY,
  PARKING_FULL,
  PARKING_PART,
  SCREENING,
  START_TIME,
  TRANSIT_ROUTES,
  WEEKDAYS,
  WHY_DRIVE,
  WHY_SHIFT,
  dayDateLabel,
  isCommuteDay,
  longDate,
  usesTransit,
  weekLabel,
  type CarPart,
  type Choice,
  type DayAnswer,
  type DayMode,
  type IncentiveRating,
  type LongestLeg,
  type SurveyAnswers,
  type Weekday,
} from '@/lib/employer/survey-instrument'
import type { PublicSurvey } from '@/lib/employer/survey-server'

type Props = {
  token: string
  survey: PublicSurvey
  recipient: { name: string | null; department: string | null; location_id: string | null } | null
}

const GROUP_ORDER: (keyof typeof DAY_MODE_GROUP_LABEL)[] = ['active', 'transit', 'shared', 'car', 'away']

type StepId = 'screen' | 'days' | 'about' | 'why' | 'incentives' | 'words'

/**
 * Draft answers live in this browser under the link's token (Keith
 * 2026-10-13: a long page must not lose partial work). Written on every
 * change, restored when the page opens again, removed on submit. Nothing
 * leaves the device until "Send"; a private window or blocked storage just
 * means no draft.
 */
const DRAFT_KEY = (token: string) => `survey-draft:${token}`
type Draft = { screen: SurveyAnswers['screen']; days: Partial<Record<Weekday, DayAnswer>>; a: Omit<SurveyAnswers, 'screen' | 'days'>; saved_at: string; step?: number }

function readDraft(token: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY(token))
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    return d && typeof d === 'object' && d.days && d.a ? d : null
  } catch {
    return null
  }
}
function writeDraft(token: string, d: Draft) {
  try {
    window.localStorage.setItem(DRAFT_KEY(token), JSON.stringify(d))
  } catch {}
}
function clearDraft(token: string) {
  try {
    window.localStorage.removeItem(DRAFT_KEY(token))
  } catch {}
}

const card = 'rounded-[16px] border border-navy/[0.12] bg-white px-4 py-5 sm:px-6'
const h2 = 'font-headline text-[22px] font-extrabold leading-tight text-navy'
const help = 'mt-1 text-[16px] leading-[1.5] text-ink-soft'
const label = 'block text-[18px] font-bold leading-[1.3] text-navy'
const select = 'form-input mt-1.5 !text-[17px] !py-3'

/** A row of pill buttons for a one-choice question. Big enough for thumbs. */
function Pills<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: { code: T; label: string }[]
  value: T | undefined
  onChange: (v: T) => void
  name: string
}) {
  return (
    <div role="radiogroup" aria-label={name} className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.code
        return (
          <button
            key={o.code}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.code)}
            className={`min-h-[46px] rounded-full border px-4 py-2 text-[17px] leading-[1.2] transition-colors ${
              on ? 'border-navy bg-navy font-bold text-white' : 'border-navy/25 bg-white text-navy hover:border-navy'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Checks({ options, value, onChange, name }: { options: Choice[]; value: string[]; onChange: (v: string[]) => void; name: string }) {
  return (
    <div role="group" aria-label={name} className="mt-2 grid gap-1 sm:grid-cols-2">
      {options.map((o) => {
        const on = value.includes(o.code)
        return (
          <label key={o.code} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-cream">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => onChange(e.target.checked ? [...value, o.code] : value.filter((x) => x !== o.code))}
              className="h-5 w-5 shrink-0 accent-forest"
            />
            <span className="text-[17px] leading-[1.35] text-navy">{o.label}</span>
          </label>
        )
      })}
    </div>
  )
}

function YesNo({ value, onChange, name }: { value: boolean | undefined; onChange: (v: boolean) => void; name: string }) {
  return (
    <Pills
      name={name}
      options={[
        { code: 'yes', label: 'Yes' },
        { code: 'no', label: 'No' },
      ]}
      value={value === true ? 'yes' : value === false ? 'no' : undefined}
      onChange={(v) => onChange(v === 'yes')}
    />
  )
}

export default function SurveyForm({ token, survey, recipient }: Props) {
  const [screen, setScreen] = useState<SurveyAnswers['screen']>({})
  const [days, setDays] = useState<Partial<Record<Weekday, DayAnswer>>>({})
  const [a, setA] = useState<Omit<SurveyAnswers, 'screen' | 'days'>>({
    transit_routes: [],
    why_shift: [],
    why_drive: [],
    interests: [],
    incentives: {},
    location_id: recipient?.location_id ?? (survey.sites.length === 1 ? survey.sites[0].id : null),
    department: recipient?.department ?? null,
  })
  const [problems, setProblems] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)
  // Draft: restored once after mount (never during server render), then
  // written on every change. `restored` says "picked up where you left off".
  const hydrated = useRef(false)
  const [restored, setRestored] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    const d = readDraft(token)
    if (d) {
      setScreen(d.screen ?? {})
      setDays(d.days ?? {})
      setA((prev) => ({ ...prev, ...d.a }))
      if (typeof d.step === 'number') setStepIdx(d.step)
      setRestored(true)
      setSavedAt(d.saved_at)
    }
    hydrated.current = true
  }, [token])

  useEffect(() => {
    if (done) window.scrollTo({ top: 0 })
  }, [done])

  useEffect(() => {
    if (!hydrated.current || done) return
    const empty = Object.keys(screen).length === 0 && Object.keys(days).length === 0
    if (empty && !restored) return
    const t = window.setTimeout(() => {
      const saved_at = new Date().toISOString()
      writeDraft(token, { screen, days, a, saved_at, step: stepIdx })
      setSavedAt(saved_at)
    }, 400)
    return () => window.clearTimeout(t)
  }, [token, screen, days, a, done, restored, stepIdx])

  const set = <K extends keyof typeof a>(k: K, v: (typeof a)[K]) => setA((prev) => ({ ...prev, [k]: v }))
  const setDay = (d: Weekday, patch: Partial<DayAnswer> | null) =>
    setDays((prev) => {
      if (patch === null) {
        const next = { ...prev }
        delete next[d]
        return next
      }
      const cur = prev[d]
      const mode = (patch.mode ?? cur?.mode) as DayMode | undefined
      if (!mode) return prev
      // A new mode drops the old follow-ups.
      const base: DayAnswer = patch.mode && patch.mode !== cur?.mode ? { mode: patch.mode } : { ...(cur ?? { mode }), ...patch }
      return { ...prev, [d]: base }
    })

  const answered = WEEKDAYS.map((d) => days[d]).filter((x): x is DayAnswer => !!x)
  const commuteDays = answered.filter((x) => isCommuteDay(x.mode))
  const anyDriveAlone = answered.some((x) => x.mode === 'drive_alone')
  const anyShift = commuteDays.some((x) => x.mode !== 'drive_alone' && x.mode !== 'ridehail_alone')
  const anyTransit = answered.some((x) => usesTransit(x.mode))
  const anyDriveFull = answered.some((x) => x.mode === 'drive_alone' || x.mode === 'carpool')
  const anyDrivePart = answered.some((x) => x.mode === 'drive_bike' || (x.mode === 'transit_drive' && x.car_part !== 'shuttle'))
  const showWhyShift = anyShift || commuteDays.length === 0
  const showWhyDrive = anyDriveAlone || commuteDays.length === 0
  // Screening answered and all five days complete, follow-ups included:
  // enough for the filing, so the early "Send now" appears.
  const requiredDone =
    SCREENING.every((q) => screen[q.code] !== undefined) &&
    WEEKDAYS.every((d) => {
      const v = days[d]
      if (!v) return false
      const opt = DAY_MODE_BY_CODE[v.mode]
      if (v.mode === 'carpool' && !(v.size && v.size >= 2)) return false
      if (opt.legs && !v.longest) return false
      if (v.mode === 'transit_drive' && !v.car_part) return false
      return true
    })

  const modeGroups = useMemo(
    () => GROUP_ORDER.map((g) => ({ g, options: DAY_MODE_OPTIONS.filter((o) => o.group === g) })),
    [],
  )

  // One section per step (Keith 2026-10-13: a long page is hard to finish
  // on a phone). "Why" only exists when it has a question to ask.
  const steps = useMemo<{ id: StepId; title: string }[]>(
    () => [
      { id: 'screen', title: 'About your work week' },
      { id: 'days', title: 'How you got to work each day' },
      { id: 'about', title: 'About your commute' },
      ...(showWhyShift || showWhyDrive ? [{ id: 'why' as StepId, title: 'Why' }] : []),
      { id: 'incentives', title: 'What would change how you get to work?' },
      { id: 'words', title: 'In your words' },
    ],
    [showWhyShift, showWhyDrive],
  )
  const idx = Math.min(stepIdx, steps.length - 1)
  const step = steps[idx].id
  const isLast = idx === steps.length - 1

  function goTo(i: number) {
    setStepIdx(Math.max(0, Math.min(i, steps.length - 1)))
    setProblems([])
    setFailed(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Next: the current step's required answers, else move on. */
  function next() {
    const p = step === 'screen' ? screenProblems() : step === 'days' ? dayProblems() : step === 'about' ? zipProblems() : []
    setProblems(p)
    if (p.length > 0) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    goTo(idx + 1)
  }

  function copyMonday() {
    const mon = days.mon
    if (!mon) return
    setDays({ mon, tue: { ...mon }, wed: { ...mon }, thu: { ...mon }, fri: { ...mon } })
  }

  function screenProblems(): string[] {
    const out: string[] = []
    for (const q of SCREENING) if (screen[q.code] === undefined) out.push(`Answer "${q.label}"`)
    return out
  }
  function zipProblems(): string[] {
    return a.home_zip && !/^\d{5}$/.test(a.home_zip) ? ['Home ZIP code should be five digits'] : []
  }
  function dayProblems(): string[] {
    const out: string[] = []
    for (const d of WEEKDAYS) {
      const v = days[d]
      const dayName = dayDateLabel(survey.week_start, d)
      if (!v) {
        out.push(`Pick how you got to work on ${dayName}`)
        continue
      }
      const opt = DAY_MODE_BY_CODE[v.mode]
      if (v.mode === 'carpool' && !(v.size && v.size >= 2)) out.push(`${dayName}: how many people were in the carpool or vanpool, including you?`)
      if (opt.legs && !v.longest) out.push(`${dayName}: which part of the trip covered the most distance?`)
      if (v.mode === 'transit_drive' && !v.car_part) out.push(`${dayName}: how did the car part of the trip happen?`)
    }
    return out
  }

  async function submit() {
    // Anything missing sends the person back to the step it belongs to.
    const checks: [StepId, string[]][] = [
      ['screen', screenProblems()],
      ['days', dayProblems()],
      ['about', zipProblems()],
    ]
    const first = checks.find(([, p]) => p.length > 0)
    if (first) {
      setStepIdx(steps.findIndex((s) => s.id === first[0]))
      setProblems(first[1])
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setProblems([])
    setSending(true)
    setFailed(null)
    try {
      const res = await fetch(`/api/survey/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { screen, days, ...a } }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string; problems?: string[] } | null
      if (res.ok) {
        clearDraft(token)
        // The thank-you screen scrolls itself to the top once it has
        // rendered (an effect below); scrolling here first flashed the top
        // of the last step for a frame.
        setDone(true)
        return
      }
      if (json?.error === 'invalid' && json.problems) {
        // The server only checks the screening questions and the week.
        setStepIdx(json.problems.some((p) => p.startsWith('Answer "')) ? 0 : 1)
        setProblems(json.problems)
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (json?.error === 'answered') {
        clearDraft(token)
        setDone(true)
      } else if (json?.error === 'closed') {
        setFailed('This survey has closed.')
      } else {
        setFailed("We couldn't save your answers. Check your connection and try again.")
      }
    } catch {
      setFailed("We couldn't save your answers. Check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  const header = (
    <header className="mb-6">
      <div className="flex items-center gap-3">
        {survey.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={survey.logo_url} alt="" className="h-10 w-auto max-w-[140px] rounded-md bg-white object-contain p-1" />
        ) : null}
        <div className="text-[14px] font-bold uppercase tracking-wide text-forest">{survey.company}</div>
      </div>
      <h1 className="font-headline mt-3 text-[30px] font-extrabold leading-[1.05] text-navy">Commute survey</h1>
      <p className="mt-2 text-[16px] leading-[1.5] text-navy">
        {recipient?.name ? `Hi ${recipient.name.split(/\s+/)[0]}. ` : ''}
        How did you get to work the week of {weekLabel(survey.week_start)}? About two minutes.
      </p>
      <p className={help}>
        {survey.company} sees totals and who has answered. Run by Shift, from the nonprofit Green
        Streets Initiative. Please answer by {longDate(survey.closes_on)}.
      </p>
    </header>
  )

  if (done) {
    return (
      <main className="street min-h-screen bg-cream px-4 py-8 text-navy sm:px-6" style={{ fontFamily: 'var(--font-gsi)' }}>
        <div className="mx-auto max-w-[640px]">
          {header}
          <div className={card}>
            <h2 className={h2}>Thank you</h2>
            <p className="mt-2 text-[16px] leading-[1.5] text-navy">
              {`Your answers are in. ${survey.company} will see how the whole team gets to work.`}
            </p>
            <p className={help}>
              Want to see your own trips add up? Shift is a free app that records walks, bike rides, transit trips and carpools and
              turns them into rewards.{' '}
              <a href="https://shift.gogreenstreets.org" className="font-bold text-forest underline">
                Get Shift
              </a>
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="street min-h-screen bg-cream px-4 py-8 text-navy sm:px-6" style={{ fontFamily: 'var(--font-gsi)' }}>
      <form
        className="mx-auto max-w-[640px]"
        onSubmit={(e) => {
          // Enter in a text box submits the form; before the last step that
          // means "Next", never "send everything".
          e.preventDefault()
          if (isLast) void submit()
          else next()
        }}
        noValidate
      >
        {header}
        <div ref={topRef} />
        {restored && (
          <p className="mb-4 rounded-[12px] border border-forest/30 bg-white px-4 py-3 text-[14px] leading-[1.45] text-navy" role="status">
            Picked up where you left off. Your answers are saved on this device as you go; nothing is sent until you press Send.
          </p>
        )}
        {/* Progress: which step, how many, and a bar. */}
        <div className="mb-4" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 text-[14px] text-navy">
            <span className="font-bold">
              Step {idx + 1} of {steps.length}
            </span>
            <span className="text-ink-soft">{idx < 2 ? 'Required' : 'Optional'}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-navy/[0.12]" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={idx + 1} aria-label="Survey progress">
            <div className="h-full rounded-full bg-forest transition-all duration-300" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        {problems.length > 0 && (
          <div role="alert" className="mb-5 rounded-[12px] border border-[#B3361F]/40 bg-[#FBEDE9] px-4 py-3 text-[15px] leading-[1.45] text-[#8A2A17]">
            <div className="font-bold">A few things to finish:</div>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-5">
          {/* 1. Who this applies to (MassDEP) */}
          {step === 'screen' && (
          <section className={card} aria-labelledby="s-screen">
            <h2 id="s-screen" className={h2}>
              {steps[0].title}
            </h2>
            <p className={help}>Three quick questions that decide how your answers are counted.</p>
            <div className="mt-4 grid gap-5">
              {SCREENING.map((q) => (
                <div key={q.code}>
                  <span className={label}>{q.label}</span>
                  <YesNo name={q.label} value={screen[q.code]} onChange={(v) => setScreen((s) => ({ ...s, [q.code]: v }))} />
                </div>
              ))}
            </div>
          </section>
          )}

          {/* 2. The week */}
          {step === 'days' && (
          <section className={card} aria-labelledby="s-days">
            <h2 id="s-days" className={h2}>
              {steps[1].title}
            </h2>
            <p className={help}>
              The week of {weekLabel(survey.week_start)}. Pick the one that fits best; if you used two ways, pick the combination.
            </p>
            <div className="mt-4 grid gap-5">
              {WEEKDAYS.map((d, i) => {
                const v = days[d]
                const opt = v ? DAY_MODE_BY_CODE[v.mode] : null
                return (
                  <div key={d} className="border-t border-navy/[0.08] pt-4 first:border-t-0 first:pt-0">
                    <label className={label} htmlFor={`day-${d}`}>
                      {dayDateLabel(survey.week_start, d)}
                    </label>
                    <select
                      id={`day-${d}`}
                      className={select}
                      value={v?.mode ?? ''}
                      onChange={(e) => (e.target.value ? setDay(d, { mode: e.target.value as DayMode }) : setDay(d, null))}
                    >
                      <option value="">Choose one</option>
                      {modeGroups.map(({ g, options }) => (
                        <optgroup key={g} label={DAY_MODE_GROUP_LABEL[g]}>
                          {options.map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.label}
                              {o.hint ? ` (${o.hint.toLowerCase()})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {v?.mode === 'carpool' && (
                      <div className="mt-3">
                        <label className={label} htmlFor={`size-${d}`}>
                          How many people in the vehicle, including you?
                        </label>
                        <input
                          id={`size-${d}`}
                          type="number"
                          inputMode="numeric"
                          min={2}
                          max={30}
                          value={v.size ?? ''}
                          onChange={(e) => setDay(d, { size: e.target.value ? Number(e.target.value) : undefined })}
                          className={`${select} max-w-[120px]`}
                        />
                      </div>
                    )}
                    {v?.mode === 'transit_drive' && (
                      <div className="mt-3">
                        <span className={label}>How did the car part happen?</span>
                        <Pills<CarPart>
                          name="Car part"
                          options={CAR_PART_OPTIONS}
                          value={v.car_part}
                          onChange={(c) => setDay(d, { car_part: c })}
                        />
                      </div>
                    )}
                    {opt?.legs && (
                      <div className="mt-3">
                        <span className={label}>Which part covered the most distance?</span>
                        <Pills<LongestLeg>
                          name="Longest part"
                          options={opt.legs.map((l) => ({ code: l, label: LONGEST_LEG_LABEL[l] }))}
                          value={v?.longest}
                          onChange={(l) => setDay(d, { longest: l })}
                        />
                      </div>
                    )}
                    {i === 0 && v && (
                      <button
                        type="button"
                        onClick={copyMonday}
                        className="mt-3 min-h-[44px] rounded-full border border-forest px-4 py-2 text-[14px] font-bold text-forest hover:bg-forest hover:text-white"
                      >
                        Same for the whole week
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
          )}

          {/* The required part ends here: send now, or keep going. */}
          {step === 'days' && requiredDone && (
            <div className="rounded-[16px] border border-forest bg-white px-4 py-5 sm:px-6" role="status">
              <h2 className={h2}>That&apos;s the part the filing needs</h2>
              <p className="mt-1 text-[15px] leading-[1.5] text-navy">
                You can send now. The next sections (about three more minutes) help {survey.company} plan better commute options, and are optional.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={sending}
                  className="min-h-[48px] rounded-full bg-navy px-6 text-[16px] font-bold text-white hover:bg-forest disabled:opacity-60"
                >
                  {sending ? 'Sending...' : 'Send now'}
                </button>
                <button type="button" onClick={() => goTo(idx + 1)} className="min-h-[44px] text-center text-[15px] font-bold text-forest underline sm:text-left">
                  Keep going
                </button>
              </div>
            </div>
          )}

          {/* 3. About your commute */}
          {step === 'about' && (
          <section className={card} aria-labelledby="s-about">
            <h2 id="s-about" className={h2}>
              About your commute
            </h2>
            <p className={help}>Optional, but each one helps {survey.company} plan better options.</p>
            <div className="mt-4 grid gap-5">
              {(survey.sites.length > 1 || survey.departments.length > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {survey.sites.length > 1 && (
                    <div>
                      <label className={label} htmlFor="site">
                        Where do you work?
                      </label>
                      <select id="site" className={select} value={a.location_id ?? ''} onChange={(e) => set('location_id', e.target.value || null)}>
                        <option value="">Choose a site</option>
                        {survey.sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {survey.departments.length > 0 && (
                    <div>
                      <label className={label} htmlFor="dept">
                        Your department
                      </label>
                      <select id="dept" className={select} value={a.department ?? ''} onChange={(e) => set('department', e.target.value || null)}>
                        <option value="">Choose one</option>
                        {survey.departments.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className={label} htmlFor="zip">
                  Home ZIP code
                </label>
                <input
                  id="zip"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  value={a.home_zip ?? ''}
                  onChange={(e) => set('home_zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className={`${select} max-w-[160px]`}
                />
                <p className={help}>Only ever reported as a count of people per ZIP code.</p>
              </div>
              <div>
                <span className={label}>When do you usually start work?</span>
                <Pills name="Start time" options={START_TIME} value={a.start_time} onChange={(v) => set('start_time', v)} />
              </div>
              <div>
                <span className={label}>When do you usually finish?</span>
                <Pills name="End time" options={END_TIME} value={a.end_time} onChange={(v) => set('end_time', v)} />
              </div>
              <div>
                <span className={label}>How long does it take you to get to work, one way?</span>
                <Pills name="Time to work, one way" options={MINUTES_ONE_WAY} value={a.minutes_one_way} onChange={(v) => set('minutes_one_way', v)} />
              </div>
              <div>
                <span className={label}>How far is it from home to work, one way?</span>
                <p className={help}>A rough figure is fine.</p>
                <Pills name="Distance to work, one way" options={MILES_ONE_WAY} value={a.miles_one_way} onChange={(v) => set('miles_one_way', v)} />
              </div>
              {anyTransit && (
                <div>
                  <span className={label}>Which transit did you use?</span>
                  <Checks name="Transit routes" options={TRANSIT_ROUTES} value={a.transit_routes ?? []} onChange={(v) => set('transit_routes', v)} />
                  <label className={`${label} mt-3`} htmlFor="bus">
                    Bus route numbers
                  </label>
                  <input
                    id="bus"
                    type="text"
                    value={a.bus_routes ?? ''}
                    onChange={(e) => set('bus_routes', e.target.value)}
                    placeholder="71, 73"
                    className={`${select} max-w-[240px]`}
                  />
                </div>
              )}
              <div>
                <span className={label}>How often do you drive your own car for your job during the workday?</span>
                <p className={help}>Client or site visits, meetings elsewhere, errands for work. Not your commute.</p>
                <Pills name="Car for business" options={CAR_FOR_BUSINESS} value={a.car_for_business} onChange={(v) => set('car_for_business', v)} />
              </div>
              {anyDriveFull && (
                <div>
                  <span className={label}>When you drive the whole way, where do you park?</span>
                  <Pills name="Parking" options={PARKING_FULL} value={a.parking_full} onChange={(v) => set('parking_full', v)} />
                </div>
              )}
              {anyDrivePart && (
                <div>
                  <span className={label}>When you drive part of the way, where do you park?</span>
                  <Pills name="Parking, part way" options={PARKING_PART} value={a.parking_part} onChange={(v) => set('parking_part', v)} />
                </div>
              )}
            </div>
          </section>
          )}

          {/* 4. Why */}
          {step === 'why' && (
            <section className={card} aria-label="Why you travel the way you do">
              <div className="grid gap-6">
                {showWhyShift && (
                  <div>
                    <h2 className={h2}>When you walk, bike, take transit or carpool, why?</h2>
                    <p className={help}>Mark all that apply.</p>
                    <Checks name="Why you shift" options={WHY_SHIFT} value={a.why_shift ?? []} onChange={(v) => set('why_shift', v)} />
                  </div>
                )}
                {showWhyDrive && (
                  <div>
                    <h2 className={h2}>When you drive alone, why?</h2>
                    <p className={help}>Mark all that apply.</p>
                    <Checks name="Why you drive" options={WHY_DRIVE} value={a.why_drive ?? []} onChange={(v) => set('why_drive', v)} />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 5. What would change things */}
          {step === 'incentives' && (
          <section className={card} aria-labelledby="s-incentives">
            <h2 id="s-incentives" className={h2}>
              What would change how you get to work?
            </h2>
            <p className={help}>For each one: how likely would you be to change your commute if it were offered?</p>
            <div className="mt-4 grid gap-4">
              {INCENTIVES.map((i) => (
                <div key={i.code} className="border-t border-navy/[0.08] pt-3 first:border-t-0 first:pt-0">
                  <span className="block text-[17px] leading-[1.35] text-navy">{i.label}</span>
                  <Pills<IncentiveRating>
                    name={i.label}
                    options={INCENTIVE_RATINGS.map((r) => ({ code: r.code, label: r.short }))}
                    value={a.incentives?.[i.code]}
                    onChange={(v) => set('incentives', { ...(a.incentives ?? {}), [i.code]: v })}
                  />
                </div>
              ))}
            </div>
          </section>
          )}

          {/* 6. In your words */}
          {step === 'words' && (
          <section className={card} aria-label="A few more, in your own words">
            <p className={help}>Last step. Only Green Streets Initiative reads what you write here; {survey.company} gets a summary without names.</p>
            <div className="mt-4 grid gap-6">
              <div>
                <span className={label}>Which of these would you like to try?</span>
                <Checks name="Interests" options={INTERESTS} value={a.interests ?? []} onChange={(v) => set('interests', v)} />
                {a.interests?.includes('other') && (
                  <input
                    type="text"
                    aria-label="Something else"
                    value={a.interests_other ?? ''}
                    onChange={(e) => set('interests_other', e.target.value)}
                    placeholder="Such as..."
                    className={`${select} max-w-[320px]`}
                  />
                )}
              </div>
              <div>
                <label className={label} htmlFor="switch">
                  What would make you switch from driving alone to another way?
                </label>
                <textarea id="switch" rows={3} value={a.switch_text ?? ''} onChange={(e) => set('switch_text', e.target.value)} className={select} />
              </div>
              <div>
                <label className={label} htmlFor="transit-imp">
                  What would make public transit work better for you?
                </label>
                <p className={help}>Nearby stops, buying passes at work, better schedules...</p>
                <textarea
                  id="transit-imp"
                  rows={3}
                  value={a.transit_improvements ?? ''}
                  onChange={(e) => set('transit_improvements', e.target.value)}
                  className={select}
                />
              </div>
              <div>
                <label className={label} htmlFor="facility">
                  What could {survey.company} do to make carpooling, vanpooling, biking or walking easier?
                </label>
                <textarea id="facility" rows={3} value={a.facility_could ?? ''} onChange={(e) => set('facility_could', e.target.value)} className={select} />
              </div>
            </div>
          </section>
          )}

          {failed && (
            <p role="alert" className="text-[15px] font-bold text-[#8A2A17]">
              {failed}
            </p>
          )}
          {/* Step navigation: Back, then Next or Send. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isLast ? (
              <button
                type="submit"
                disabled={sending}
                className="min-h-[52px] w-full rounded-full bg-navy px-6 text-[17px] font-bold text-white hover:bg-forest disabled:opacity-60 sm:w-auto sm:px-10"
              >
                {sending ? 'Sending...' : 'Send my answers'}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="min-h-[52px] w-full rounded-full bg-navy px-6 text-[17px] font-bold text-white hover:bg-forest sm:w-auto sm:px-10"
              >
                Next
              </button>
            )}
            {idx > 0 && (
              <button type="button" onClick={() => goTo(idx - 1)} className="min-h-[44px] text-[15px] font-bold text-forest underline">
                Back
              </button>
            )}
          </div>
          {savedAt && (
            <p className="text-[13px] leading-[1.5] text-ink-soft" aria-live="polite">
              Draft saved on this device. You can close this page and come back to the same link.
            </p>
          )}
          <p className="pb-6 text-[13px] leading-[1.5] text-ink-soft">
            {`Your answers are held by Green Streets Initiative for three years, as the state's commute-reporting rules require, then deleted. ${survey.company} sees totals and a list of who has answered.`}
          </p>
        </div>
      </form>
    </main>
  )
}
