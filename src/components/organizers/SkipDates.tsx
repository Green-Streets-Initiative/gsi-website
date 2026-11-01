'use client'

import { useMemo, useState } from 'react'
import { errorText, setSkipDates } from '@/lib/organizers/api'
import { dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import { addDaysKey, scheduleDates } from '@/lib/organizers/schedule'
import type { DetailDate, RideRow } from '@/lib/organizers/types'
import { Button, Dialog, Notice, Toggle } from './ui'

/** How far ahead the picker reaches: about six months of a ride's dates. */
const HORIZON_DAYS = 183

/**
 * Skip dates ahead of time (a holiday weekend, a race that closes the
 * route), before they're on the schedule. Dates already on it are in the
 * list on the ride page, where cancelling one tells the people on it; this
 * picker covers the ones after those, and writes the ride's skip dates.
 */
export function SkipDatesDialog({ ride, dates, open, onClose, onDone }: {
  ride: RideRow
  dates: DetailDate[]
  open: boolean
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const today = todayKey()
  // After the last date already on the schedule.
  const from = useMemo(() => {
    const last = dates.reduce((m, d) => (d.date > m ? d.date : m), today)
    return addDaysKey(last, 1)
  }, [dates, today])
  const listed = useMemo(() => scheduleDates(ride, from, {
    limit: 40, horizonDays: HORIZON_DAYS, includeSkipped: true, today,
  }), [ride, from, today])
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set((ride.skip_dates ?? []).filter((d) => d >= from)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const before = new Set((ride.skip_dates ?? []).filter((d) => listed.includes(d)))
  const changed = listed.some((d) => before.has(d) !== skipped.has(d))
  const count = listed.filter((d) => skipped.has(d)).length

  async function save() {
    setBusy(true)
    setErr(null)
    try {
      // Keep every skip outside this list (past ones, and dates cancelled on the ride page).
      const keep = (ride.skip_dates ?? []).filter((d) => !listed.includes(d))
      await setSkipDates(ride.id, [...keep, ...listed.filter((d) => skipped.has(d))])
      onDone(count > 0 ? `Saved. ${plural(count, 'date')} skipped; they won't open for sign-ups.` : 'Saved. No dates skipped.')
    } catch (e) {
      setErr(errorText(e))
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Skip dates further out" wide
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => void save()} busy={busy} disabled={!changed}>Save skipped dates</Button>
      </>}>
      <p className="text-[15px] leading-snug text-(--ev-ink-85)">
        Tap the dates you won&rsquo;t ride. The next few dates are already listed above; cancel those there so people hear.
      </p>
      {listed.length === 0 ? (
        <p className="mt-4 text-[15px] text-(--ev-ink-80)">No more dates in the next six months.</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Dates to skip">
          {listed.map((d) => {
            const off = skipped.has(d)
            return (
              <Toggle key={d} on={off} aria-label={`${dateLabel(d)}${off ? ', skipped' : ''}`}
                onClick={() => setSkipped((prev) => { const n = new Set(prev); if (n.has(d)) n.delete(d); else n.add(d); return n })}
                className={off ? 'line-through' : undefined}>
                {dateLabel(d)}
              </Toggle>
            )
          })}
        </div>
      )}
      {count > 0 && <p className="mt-3 text-[14px] text-(--ev-ink-80)">{plural(count, 'date')} skipped.</p>}
      {err && <div className="mt-3"><Notice tone="off">{err}</Notice></div>}
    </Dialog>
  )
}
