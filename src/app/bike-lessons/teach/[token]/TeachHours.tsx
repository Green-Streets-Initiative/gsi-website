'use client'

import { useEffect, useState } from 'react'
import WeekGrid from '../../WeekGrid'

/*
 * An instructor's usual teaching times (Shift 01750). Set once, from their
 * reply to Green Streets; they change them here only if they want to (Keith
 * 2026-11-12: no weekly posting). We ask them only about people free at these
 * times. Pausing stops new asks without losing the times.
 */

type Teacher = { name: string; org: string | null; hello: string; area: string; hours: string[]; calls_first: boolean; paused: boolean; active: boolean }

const LINK = 'font-bold text-forest underline underline-offset-4 hover:opacity-80'
const CARD = 'rounded-[22px] bg-white p-6 sm:p-7'
const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold leading-tight text-navy'

async function call(body: Record<string, unknown>) {
  const res = await fetch('/api/free-lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!data || (!data.ok && data.state !== 'not_found')) throw new Error('failed')
  return data as { ok: boolean; teacher?: Teacher }
}

export default function TeachHours({ token }: { token: string }) {
  const [teacher, setTeacher] = useState<Teacher | null | 'missing'>(null)
  const [hours, setHours] = useState<Set<string>>(new Set())
  const [calls, setCalls] = useState(false)
  const [paused, setPaused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = (t: Teacher) => {
    setTeacher(t)
    setHours(new Set(t.hours))
    setCalls(t.calls_first)
    setPaused(t.paused)
  }

  useEffect(() => {
    call({ action: 'teacher_get', token }).then(
      (d) => (d.teacher ? load(d.teacher) : setTeacher('missing')),
      () => setFailed(true),
    )
  }, [token])

  const changed = () => {
    setSaved(false)
    setFailed(false)
  }

  async function save() {
    setSaving(true)
    setFailed(false)
    try {
      const d = await call({ action: 'teacher_save', token, hours: [...hours], calls_first: calls, paused })
      if (d.teacher) load(d.teacher)
      setSaved(true)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  if (teacher === 'missing') {
    return (
      <div className={CARD}>
        <h1 className={`${HEAD} text-[1.75rem]`}>This link has expired</h1>
        <p className="mt-3 text-[1rem] leading-relaxed text-navy">
          Write to <a href="mailto:info@gogreenstreets.org" className={LINK}>info@gogreenstreets.org</a> for a new one.
        </p>
      </div>
    )
  }
  if (!teacher) {
    return <div className={CARD}><p className="text-[1rem] text-navy/80">{failed ? 'Something went wrong. Please reload the page.' : 'Loading…'}</p></div>
  }

  return (
    <div className={CARD}>
      <p className="font-mono text-[0.8125rem] uppercase tracking-[0.06em] text-forest">Free road lessons</p>
      <h1 className={`${HEAD} mt-1 text-[2rem]`}>Hi {teacher.hello}. When do you usually teach?</h1>
      <p className="mt-2 text-[1rem] leading-relaxed text-navy">
        We only ask you about people who are free at these times.
      </p>

      <div className="mt-6">
        <WeekGrid
          cells={hours}
          onToggle={(cell) => {
            changed()
            setHours((prev) => {
              const next = new Set(prev)
              if (next.has(cell)) next.delete(cell)
              else next.add(cell)
              return next
            })
          }}
        />
        <p className="mt-2 text-[0.875rem] text-navy/80">
          {hours.size} of 21 times · tap to change
        </p>
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-cream px-4 py-3">
        <input
          type="checkbox"
          checked={calls}
          onChange={(e) => {
            changed()
            setCalls(e.target.checked)
          }}
          className="mt-0.5 h-5 w-5 shrink-0 accent-forest"
        />
        <span className="text-[1rem] leading-snug text-navy">
          <b>I call each student before we book.</b>
          <span className="block text-[0.9375rem] text-navy/80">We’ll ask learners for a phone number.</span>
        </span>
      </label>
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl bg-cream px-4 py-3">
        <input
          type="checkbox"
          checked={paused}
          onChange={(e) => {
            changed()
            setPaused(e.target.checked)
          }}
          className="mt-0.5 h-5 w-5 shrink-0 accent-forest"
        />
        <span className="text-[1rem] leading-snug text-navy">
          <b>Pause new requests</b>
          <span className="block text-[0.9375rem] text-navy/80">Your times stay saved for when you’re back.</span>
        </span>
      </label>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-6 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-forest px-6 text-[1.0625rem] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save my times'}
      </button>
      <p className="mt-3 min-h-[24px] text-[0.9375rem] font-semibold" aria-live="polite">
        {saved && <span className="text-forest">Saved. Thanks!</span>}
        {failed && <span className="text-[#B42318]">That didn’t save. Please try again.</span>}
      </p>
      {!teacher.active && (
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-navy/80">
          Green Streets switches on your requests once we’ve talked. Questions?{' '}
          <a href="mailto:info@gogreenstreets.org" className={LINK}>info@gogreenstreets.org</a>
        </p>
      )}
    </div>
  )
}
