'use client'

import { useId, useState, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { errorText, setHeadcount } from '@/lib/organizers/api'
import { dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import { Button, Card, Dialog, SectionTitle, cx } from './ui'

/**
 * Head counts (Shift 01725). Shift only counts people on the ride's Shift
 * list; the organizer says how many came in all, so turnout includes people
 * who answered on Partiful, Meetup or the group chat, or just showed up.
 * The count is the total, Shift's own people included, so no one is counted
 * twice.
 */
export interface CountableDate {
  id: string
  date: string
  /** People Shift saw on the ride (matched trips, approved requests, "yes, I made it"). */
  shift_counted: number
  headcount: number | null
  headcount_new: number | null
}

/** "How many came?" sentence under the number: what Shift already has. */
function shiftLine(shift: number): string {
  if (shift === 0) return 'Everyone, kids too, including people who answered on Partiful or just showed up.'
  return `Everyone, kids too. The ${shift} Shift saw are part of it, not added to it.`
}

function Stepper({ id, value, onChange, min, label }: {
  id: string; value: number | null; onChange: (n: number | null) => void; min: number; label: string
}) {
  const n = value ?? 0
  const btn = 'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-(--ev-line-strong) bg-white text-(--ev-ink) hover:bg-(--ev-panel) disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-accent)'
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, n - 1))} disabled={value != null && n <= min} aria-label={`One fewer: ${label}`}>
        <Minus className="h-5 w-5" aria-hidden />
      </button>
      <input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value == null ? '' : String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
          onChange(digits === '' ? null : Number(digits))
        }}
        onFocus={(e) => e.target.select()}
        className="h-12 w-24 rounded-[10px] border border-(--ev-line-strong) bg-white text-center font-display text-[26px] font-extrabold tabular-nums text-(--ev-ink) focus:border-(--ev-accent) focus:outline-none focus:ring-2 focus:ring-(--ev-accent-tint-15)"
      />
      <button type="button" className={btn} onClick={() => onChange(Math.min(1000, n + 1))} aria-label={`One more: ${label}`}>
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </div>
  )
}

/** The two questions and Save. Used in the card and in the dialog. */
function HeadcountForm({ d, onSaved, extra, wide }: {
  d: CountableDate; onSaved: (came: number) => void; extra?: ReactNode; wide?: boolean
}) {
  const ids = useId()
  const [count, setCount] = useState<number | null>(d.headcount ?? (d.shift_counted || null))
  const [fresh, setFresh] = useState<number | null>(d.headcount_new)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const low = count != null && count < d.shift_counted
  const tooMany = count != null && fresh != null && fresh > count

  async function save() {
    if (count == null) { setErr('Enter how many came.'); return }
    if (low) { setErr(`Shift already saw ${d.shift_counted} people on this date, so the count can't be lower.`); return }
    if (tooMany) { setErr("New people can't be more than everyone who came."); return }
    setBusy(true)
    setErr(null)
    try {
      const r = await setHeadcount(d.id, count, fresh)
      onSaved(r.came)
    } catch (e) {
      setErr(errorText(e))
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-5">
      {/* The two questions side by side where there's room (the card). */}
      <div className={cx('grid gap-5', wide && 'md:grid-cols-2 md:gap-8')}>
      <div>
        <label htmlFor={`${ids}-n`} className="block text-[15px] font-semibold text-(--ev-ink-85)">How many came?</label>
        <p className="mt-0.5 text-[14px] leading-snug text-(--ev-ink-75)">{shiftLine(d.shift_counted)}</p>
        <div className="mt-2"><Stepper id={`${ids}-n`} value={count} onChange={(n) => { setCount(n); setErr(null) }} min={d.shift_counted} label="how many came" /></div>
      </div>
      <div>
        <label htmlFor={`${ids}-new`} className="block text-[15px] font-semibold text-(--ev-ink-85)">
          How many were new?<span className="ml-1.5 font-normal text-(--ev-ink-75)">(optional)</span>
        </label>
        <p className="mt-0.5 text-[14px] leading-snug text-(--ev-ink-75)">Their first time with you. Leave it blank if you didn&rsquo;t ask.</p>
        <div className="mt-2"><Stepper id={`${ids}-new`} value={fresh} onChange={(n) => { setFresh(n); setErr(null) }} min={0} label="how many were new" /></div>
      </div>
      </div>
      {err && <p role="alert" className="text-[14px] font-semibold text-(--ev-danger)">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void save()} busy={busy}>Save the count</Button>
        {extra}
      </div>
    </div>
  )
}

/** Count (or recount) any date that has run, from Past dates or Turnout. */
export function HeadcountDialog({ d, onClose, onSaved }: {
  d: CountableDate | null; onClose: () => void; onSaved: (msg: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!d) return null
  const label = dateLabel(d.date)
  async function clear() {
    if (!d) return
    setBusy(true)
    try {
      await setHeadcount(d.id, null, null)
      onSaved(`Count removed. ${label} shows the ${plural(d.shift_counted, 'person', 'people')} Shift saw.`)
    } catch (e) { setErr(errorText(e)); setBusy(false) }
  }
  return (
    <Dialog open onClose={onClose} title={`How many came on ${label}?`}>
      <HeadcountForm
        key={d.id}
        d={d}
        onSaved={(came) => onSaved(`Saved. Turnout counts ${plural(came, 'person', 'people')} for ${label}.`)}
        extra={<>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {d.headcount != null && <Button variant="ghost" onClick={() => void clear()} busy={busy}>Remove the count</Button>}
        </>}
      />
      {err && <p role="alert" className="mt-3 text-[14px] font-semibold text-(--ev-danger)">{err}</p>}
    </Dialog>
  )
}

/** Has this date's start time passed, in Boston? */
export function hasStarted(date: string, start: string | null, now = new Date()): boolean {
  const today = todayKey(now)
  if (date < today) return true
  if (date > today) return false
  if (!start) return true
  const t = now.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false })
  return t >= start.slice(0, 8)
}

/** The latest date in the past week that ran and hasn't been counted. */
export function dateToCount<T extends CountableDate & { status: string; start_time: string }>(dates: T[], now = new Date()): T | null {
  const weekAgo = todayKey(new Date(now.getTime() - 7 * 864e5))
  const open = dates.filter((x) => x.status !== 'canceled' && x.headcount == null && x.date >= weekAgo && hasStarted(x.date, x.start_time, now))
  return open.sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null
}

function weekday(date: string): string {
  if (date === todayKey()) return 'today'
  return `on ${new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`
}

/** After a ride: the one question, answered in place on the ride's home. */
export function HeadcountPrompt({ d, onSaved, onSkip }: {
  d: CountableDate; onSaved: (msg: string) => void; onSkip: () => void
}) {
  return (
    <Card className={cx('border-(--ev-accent-line) ring-1 ring-(--ev-accent-line-30)')}>
      <SectionTitle
        hint={`${dateLabel(d.date)}. Your count goes into Turnout for funders.`}
        action={<Button size="sm" variant="ghost" onClick={onSkip}>Not now</Button>}
      >
        How many came {weekday(d.date)}?
      </SectionTitle>
      <HeadcountForm
        key={d.id}
        d={d}
        wide
        onSaved={(came) => onSaved(`Saved. Turnout counts ${plural(came, 'person', 'people')} for ${dateLabel(d.date)}.`)}
      />
    </Card>
  )
}
