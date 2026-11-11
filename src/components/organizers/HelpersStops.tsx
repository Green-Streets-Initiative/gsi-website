'use client'

import { useCallback, useEffect, useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { errorText, getDateHelpersStops, getRoster, setDateHelper } from '@/lib/organizers/api'
import { clock } from '@/lib/rides/public'
import type { DateHelpersStops, HelperJob, RosterRow } from '@/lib/organizers/types'
import { Button, Select, cx } from './ui'

/**
 * One date's helpers and join stops, in the Next ride card (Shift 01744):
 * who has each job, what's still open with a one-tap "Ask for help" that
 * opens the update box with the words written, and how many people join at
 * each stop. The organizer can give anyone going a job or take it off them.
 */

const JOB_NAME: Record<HelperJob, string> = { front: 'Front', sweep: 'Sweep', corner: 'Crossing guard' }

export function askText(open: Record<HelperJob, number>, dateWords: string, walk: boolean, url?: string, crossings: string[] = []): string | null {
  const at = crossings.length ? ` (${crossings.join('; ')})` : ''
  const wants = [
    open.front > 0 ? 'someone to lead from the front' : null,
    open.sweep > 0 ? `a sweep to ${walk ? 'walk' : 'ride'} at the back` : null,
    open.corner === 1 ? `a crossing guard at a busy crossing${at}` : open.corner > 1 ? `${open.corner} crossing guards at busy crossings${at}` : null,
  ].filter(Boolean) as string[]
  if (!wants.length) return null
  const list = wants.length === 1 ? wants[0] : `${wants.slice(0, -1).join(', ')} and ${wants[wants.length - 1]}`
  return `Can you help ${dateWords}? We need ${list}. Say Going and pick the job${url ? `: ${url}` : ' on the ride page.'}`
}

export default function HelpersStops({ occurrenceId, dateWords, walk, canManage, helpUrl, onAsk }: {
  occurrenceId: string
  /** The ride page for this date, opening "Can you help?" for anyone who says Going. */
  helpUrl?: string
  /** "on Saturday" */
  dateWords: string
  walk: boolean
  canManage: boolean
  onAsk: (note: string) => void
}) {
  const [data, setData] = useState<DateHelpersStops | null>(null)
  const [going, setGoing] = useState<RosterRow[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [d, roster] = await Promise.all([getDateHelpersStops(occurrenceId), canManage ? getRoster(occurrenceId) : Promise.resolve([])])
      setData(d)
      setGoing(roster.filter((r) => r.rsvp_status === 'going'))
    } catch { /* the card keeps its other numbers */ }
  }, [occurrenceId, canManage])
  useEffect(() => { void load() }, [load])

  async function assign(memberId: string, job: HelperJob | null) {
    setBusy(true)
    setErr(null)
    try {
      setData(await setDateHelper(occurrenceId, memberId, job))
    } catch (e) {
      setErr(errorText(e, "That didn't save. Try again."))
    } finally {
      setBusy(false)
    }
  }

  if (!data) return null
  const help = data.help
  const stops = data.stops.length > 1 ? data.stops : []
  if (!help && !stops.length) return null

  // Crossings still without a guard, in route order (Shift 01745).
  const unguarded = (help?.crossings ?? []).filter((c) => !c.guarded)
  const ask = help ? askText(help.open, dateWords, walk, helpUrl, unguarded.slice(0, help.open.corner).map((c) => c.label)) : null
  const helperIds = new Set(help?.helpers.map((h) => h.member_id) ?? [])
  const free = going.filter((g) => !helperIds.has(g.member_id))

  return (
    <div className="mt-4 grid gap-4 border-t border-(--ev-line) pt-4 sm:grid-cols-2">
      {help && (
        <div>
          <p className="text-[15px] font-semibold text-(--ev-ink)">Helpers</p>
          <ul className="mt-2 space-y-1.5">
            {help.front_is_organizer && (
              <li className="flex items-center gap-2 text-[15px] text-(--ev-ink-85)">
                <span className="w-[116px] shrink-0 text-[14px] font-semibold text-(--ev-ink-75)">Front</span>
                <span className="font-semibold text-(--ev-ink)">{help.organizer_name ? `${help.organizer_name} (organizer)` : 'You'}</span>
              </li>
            )}
            {help.helpers.map((h) => (
              <li key={h.member_id} className="flex items-center gap-2 text-[15px]">
                <span className="w-[116px] shrink-0 text-[14px] font-semibold text-(--ev-ink-75)">{JOB_NAME[h.job]}</span>
                <span className="min-w-0 flex-1 font-semibold text-(--ev-ink)">
                  <span className="block truncate">{h.name}{h.every_date ? <span className="font-normal text-(--ev-ink-75)"> · every date</span> : null}</span>
                  {h.job === 'corner' && h.spot && <span className="block text-[14px] font-normal text-(--ev-ink-75)">{h.spot.label}{h.spot.time ? `, about ${clock(`${h.spot.time}:00`)}` : ''}</span>}
                </span>
                {canManage && (
                  <button type="button" disabled={busy} onClick={() => void assign(h.member_id, null)} aria-label={`Take ${JOB_NAME[h.job].toLowerCase()} off ${h.name} for this date`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-(--ev-ink-75) hover:bg-(--ev-panel)">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
            {(['front', 'sweep', 'corner'] as HelperJob[]).flatMap((j) => Array.from({ length: help.open[j] }, (_, i) => (
              <li key={`${j}-${i}`} className="flex flex-wrap items-center gap-2 text-[15px]">
                <span className="w-[116px] shrink-0 text-[14px] font-semibold text-(--ev-ink-75)">{JOB_NAME[j]}</span>
                <span className="rounded-full bg-[#FFF4D6] px-2.5 py-0.5 text-[13px] font-bold text-[#7A4B00]">Open</span>
                {j === 'corner' && unguarded[i] && <span className="basis-full text-[14px] text-(--ev-ink-75) sm:order-last sm:pl-[124px]">{unguarded[i].label}</span>}
                {canManage && free.length > 0 && (
                  <Select aria-label={`Give ${JOB_NAME[j].toLowerCase()} to someone going`} value="" disabled={busy}
                    onChange={(e) => { if (e.target.value) void assign(e.target.value, j) }} className="!min-h-[36px] !w-auto !py-1">
                    <option value="">Give it to…</option>
                    {free.map((g) => <option key={g.member_id} value={g.member_id}>{g.display_name}</option>)}
                  </Select>
                )}
              </li>
            )))}
          </ul>
          {ask && (
            <div className="mt-3">
              <Button size="sm" onClick={() => onAsk(ask)}><Megaphone className="h-4 w-4" aria-hidden />Ask for help</Button>
            </div>
          )}
          {err && <p className="mt-2 text-[14px] font-semibold text-(--ev-danger)" role="alert">{err}</p>}
        </div>
      )}
      {stops.length > 0 && (
        <div>
          <p className="text-[15px] font-semibold text-(--ev-ink)">Where people join</p>
          <ul className="mt-2 space-y-1.5">
            {stops.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2 text-[15px]">
                <span className={cx('min-w-0 flex-1', s.going ? 'text-(--ev-ink)' : 'text-(--ev-ink-75)')}>
                  <span className="block font-semibold leading-snug">{s.label}</span>
                  {s.time ? <span className="block text-[14px] text-(--ev-ink-75)">{i === 0 ? 'Start · ' : 'About '}{clock(`${s.time}:00`)}</span> : null}
                  {s.names.length > 0 && <span className="block truncate text-[14px] text-(--ev-ink-75)">{s.names.join(', ')}</span>}
                </span>
                <span className="shrink-0 font-display text-[20px] font-extrabold leading-none text-(--ev-ink)">{s.going}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
