'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { errorText, getTurnout } from '@/lib/organizers/api'
import { dateLabel, monthLabel } from '@/lib/organizers/ride-words'
import type { Turnout } from '@/lib/organizers/types'
import { useRide } from './RideFrame'
import { Button, Card, Empty, Notice, SectionTitle, Spinner } from './ui'

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function download(name: string, rows: (string | number)[][]) {
  const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n'], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ride'
}

export default function TurnoutView() {
  const { detail } = useRide()
  const r = detail.ride
  const [t, setT] = useState<Turnout | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await getTurnout(r.id)
      setT(data)
      setErr(null)
    } catch (e) {
      setErr(errorText(e, "We couldn't load turnout."))
    }
  }, [r.id])
  useEffect(() => {
    let live = true
    getTurnout(r.id)
      .then((data) => { if (live) setT(data) })
      .catch((e) => { if (live) setErr(errorText(e, "We couldn't load turnout.")) })
    return () => { live = false }
  }, [r.id])

  const totals = useMemo(() => {
    const m = t?.months ?? []
    return {
      dates_run: m.reduce((a, x) => a + x.dates_run, 0),
      going: m.reduce((a, x) => a + x.going, 0),
      attended: m.reduce((a, x) => a + x.attended, 0),
      first_timers: m.reduce((a, x) => a + x.first_timers, 0),
    }
  }, [t])

  if (err) return <Notice tone="off">{err} <button type="button" className="font-semibold underline" onClick={() => void load()}>Try again</button></Notice>
  if (!t) return <Spinner label="Adding up turnout" />
  if (t.months.length === 0) {
    return <Empty title="No rides run yet">Once a date has happened, its turnout shows here month by month, ready to download for funders.</Empty>
  }

  const file = slug(r.name)
  const monthRows = (): (string | number)[][] => [
    ['Ride', 'Month', 'Dates run', 'Dates cancelled', 'Said going', 'Came (attendances)', 'People', 'First-timers', 'Came back'],
    ...t.months.map((m) => [r.name, m.month.slice(0, 7), m.dates_run, m.dates_canceled, m.going, m.attended, m.people, m.first_timers, m.came_back]),
  ]
  const dateRows = (): (string | number)[][] => [
    ['Ride', 'Date', 'Status', 'Said going', 'Maybe', 'Came', 'Kids', 'First-timers', 'Came back'],
    ...t.dates.map((d) => [r.name, d.date, d.status === 'canceled' ? 'cancelled' : 'ran', d.going, d.maybe, d.attended, d.kids, d.first_timers, d.came_back]),
  ]

  return (
    <div className="grid gap-5">
      <Card>
        <SectionTitle
          hint="Counted from people's own trips in the Shift app, plus the credit requests you approve. Everything since the ride started."
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => download(`${file}-turnout-by-month.csv`, monthRows())}><Download className="h-4 w-4" aria-hidden />Monthly CSV</Button>
              <Button size="sm" onClick={() => download(`${file}-turnout-by-date.csv`, dateRows())}><Download className="h-4 w-4" aria-hidden />Every date CSV</Button>
            </div>
          }
        >
          Turnout
        </SectionTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {([
            ['Dates run', totals.dates_run],
            ['Said going', totals.going],
            ['Came', totals.attended],
            ['First-timers', totals.first_timers],
          ] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-(--ev-panel-faint) px-4 py-3">
              <dt className="text-[13px] font-semibold text-(--ev-ink-75)">{k}</dt>
              <dd className="mt-1 font-display text-[28px] font-extrabold leading-none">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <SectionTitle hint="People: everyone who came at least once that month. Came back: of them, people who'd come before.">By month</SectionTitle>
        <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-(--ev-line-mid) text-[13px] text-(--ev-ink-75)">
                {['Month', 'Dates run', 'Said going', 'Came', 'People', 'First-timers', 'Came back'].map((h, i) => (
                  <th key={h} scope="col" className={i ? 'py-2 pl-3 text-right font-semibold' : 'py-2 font-semibold'}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.months.map((m) => (
                <tr key={m.month} className="border-b border-(--ev-line) last:border-0">
                  <th scope="row" className="py-2.5 font-semibold text-(--ev-ink)">{monthLabel(m.month)}</th>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{m.dates_run}{m.dates_canceled ? <span className="text-(--ev-ink-75)"> (+{m.dates_canceled} off)</span> : ''}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{m.going}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums font-semibold">{m.attended}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{m.people}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{m.first_timers}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{m.came_back}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle>Every date</SectionTitle>
        <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-(--ev-line-mid) text-[13px] text-(--ev-ink-75)">
                {['Date', 'Said going', 'Maybe', 'Came', 'First-timers', 'Came back'].map((h, i) => (
                  <th key={h} scope="col" className={i ? 'py-2 pl-3 text-right font-semibold' : 'py-2 font-semibold'}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.dates.map((d) => (
                <tr key={d.date} className="border-b border-(--ev-line) last:border-0">
                  <th scope="row" className="py-2.5 font-semibold text-(--ev-ink)">
                    {dateLabel(d.date)}{d.status === 'canceled' && <span className="ml-2 font-normal text-(--ev-ink-75)">cancelled</span>}
                  </th>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{d.going}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{d.maybe}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums font-semibold">{d.attended}{d.kids ? <span className="font-normal text-(--ev-ink-75)"> +{d.kids} kids</span> : ''}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{d.first_timers}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{d.came_back}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
