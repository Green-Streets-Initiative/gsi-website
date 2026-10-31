'use client'

import { useEffect, useState } from 'react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { clock } from '@/lib/rides/public'
import { changeDate, errorText, noticeReach, sendCancelNotice, sendChangeNotice, setDateCanceled, type Sent } from '@/lib/organizers/api'
import { dateLabel, plural } from '@/lib/organizers/ride-words'
import type { DetailDate, RideRow } from '@/lib/organizers/types'
import { sentLine } from './PostUpdate'
import { Button, Dialog, Field, Input, Notice } from './ui'

/** Who a notice for this date reaches, from the notice function's dry run. */
function useReach(occurrenceId: string | undefined, kind: 'cancel' | 'change'): number | null {
  const [reach, setReach] = useState<number | null>(null)
  useEffect(() => {
    if (!occurrenceId) return
    let live = true
    noticeReach(occurrenceId, kind).then((n) => { if (live) setReach(n) })
    return () => { live = false }
  }, [occurrenceId, kind])
  return reach
}

/** The sentence under a dialog: who hears about it. */
function reachLine(reach: number | null, what: string): string {
  if (reach == null) return `Everyone on the ride, except people who said they can't make it, will hear ${what}, by app or email.`
  if (reach === 0) return 'Nobody else is on the ride yet, so no one gets a notice.'
  return `This tells ${plural(reach, 'person', 'people')} on the ride ${what}, by app or email.`
}

/**
 * The change went through but its notice didn't: say so, and offer to send it
 * again rather than claiming it was posted.
 */
function NoticeFailed({ what, err }: { what: string; err: string | null }) {
  return (
    <div className="mt-3">
      <Notice tone="off">{err ?? `${what}, but the notice didn't go out. Send it again so people hear about it.`}</Notice>
    </div>
  )
}

/** Cancel one date: the app's set_ride_occurrence_canceled, then the notice. */
export function CancelDateDialog({ date, onClose, onDone }: { date: DetailDate | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const reach = useReach(date?.id, 'cancel')
  if (!date) return null
  const label = dateLabel(date.date)
  function finish(r: Sent, again: boolean) {
    if (!r.noticeFailed) { onDone(`${label} is cancelled. ${sentLine(r.sent)}`); return }
    setFailed(true)
    if (again) setErr("It still didn't go out. Check your connection and try again.")
    setBusy(false)
  }
  async function go() {
    if (!date) return
    setBusy(true)
    setErr(null)
    try {
      finish(await setDateCanceled(date.id, true), false)
    } catch (e) {
      setErr(errorText(e))
      setBusy(false)
    }
  }
  async function resend() {
    if (!date) return
    setBusy(true)
    setErr(null)
    finish(await sendCancelNotice(date.id), true)
  }
  if (failed) {
    return (
      <Dialog open onClose={() => onDone(`${label} is cancelled. The notice didn't go out.`)} title={`${label} is cancelled`}
        footer={<>
          <Button variant="ghost" onClick={() => onDone(`${label} is cancelled. The notice didn't go out.`)}>Close</Button>
          <Button variant="primary" onClick={() => void resend()} busy={busy}>Send it again</Button>
        </>}>
        <NoticeFailed what="The date is cancelled" err={err} />
      </Dialog>
    )
  }
  return (
    <Dialog open onClose={onClose} title={`Cancel ${label}?`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Keep it</Button>
        <Button variant="danger" onClick={() => void go()} busy={busy}>Cancel this date</Button>
      </>}>
      <p className="text-[15px] leading-relaxed text-(--ev-ink-85)">
        {reachLine(reach, "it's cancelled")} The ride page and calendar will say so.
      </p>
      <p className="mt-3 text-[14px] text-(--ev-ink-75)">The rest of the ride carries on as planned. You can bring a cancelled date back.</p>
      {err && <div className="mt-3"><Notice tone="off">{err}</Notice></div>}
    </Dialog>
  )
}

/** Move one date's time or meeting point: the app's change_ride_occurrence, then the notice. */
export function ChangeDateDialog({ date, ride, onClose, onDone }: {
  date: DetailDate | null; ride: RideRow; onClose: () => void; onDone: (msg: string) => void
}) {
  const [time, setTime] = useState(date ? date.start_time.slice(0, 5) : '')
  const [placeAddr, setPlaceAddr] = useState('')
  const [place, setPlace] = useState<{ name: string; address: string; lat: number; lng: number } | null>(null)
  const [placeName, setPlaceName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const reach = useReach(date?.id, 'change')
  if (!date) return null

  const label = dateLabel(date.date)
  const timeChanged = !!time && time !== date.start_time.slice(0, 5)
  const anyChange = timeChanged || !!place

  async function resend() {
    if (!date) return
    setBusy(true)
    setErr(null)
    const r = await sendChangeNotice(date.id)
    if (!r.noticeFailed) { onDone(`${label} is updated. ${sentLine(r.sent)}`); return }
    setErr("It still didn't go out. Check your connection and try again.")
    setBusy(false)
  }

  async function go(reset?: 'time' | 'meetup') {
    if (!date) return
    setBusy(true)
    setErr(null)
    try {
      const r = await changeDate(date.id, reset === 'time' ? { resetTime: true }
        : reset === 'meetup' ? { resetMeetup: true }
          : {
              startTime: timeChanged ? time : null,
              meetup: place ? { name: placeName.trim() || place.name, address: place.address, lat: place.lat, lng: place.lng } : null,
            })
      if (r.changed && r.noticeFailed) { setFailed(true); setBusy(false); return }
      onDone(r.changed ? `${label} is updated. ${sentLine(r.sent)}` : 'Nothing changed.')
    } catch (e) {
      setErr(errorText(e))
      setBusy(false)
    }
  }

  if (failed) {
    return (
      <Dialog open onClose={() => onDone(`${label} is updated. The notice didn't go out.`)} title={`${label} is updated`}
        footer={<>
          <Button variant="ghost" onClick={() => onDone(`${label} is updated. The notice didn't go out.`)}>Close</Button>
          <Button variant="primary" onClick={() => void resend()} busy={busy}>Send it again</Button>
        </>}>
        <NoticeFailed what="The date is updated" err={err} />
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={onClose} title={`Change ${label}`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={() => void go()} busy={busy} disabled={!anyChange}>Save and tell people</Button>
      </>}>
      <p className="text-[14px] leading-snug text-(--ev-ink-80)">
        Just this date. {reachLine(reach, 'about it')}
      </p>
      <div className="mt-4 grid gap-4">
        <Field label="Start time" htmlFor="chg-time" hint={`Usually ${clock(ride.start_time)}.`}>
          <Input id="chg-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="max-w-[180px]" />
        </Field>
        {date.time_moved && <Button size="sm" variant="ghost" className="w-fit" onClick={() => void go('time')} disabled={busy}>Go back to the usual time</Button>}
        <Field label="Meeting point" hint={`Now: ${date.meetup_name ?? date.meetup_address ?? 'the usual spot'}.`}>
          <AddressAutocomplete value={placeAddr} onChange={setPlaceAddr} label="New meeting point" hideLabel placeholder="Search for a different spot"
            onPlaceSelected={(p) => { setPlace({ name: p.address.split(',')[0], address: p.address, lat: p.lat, lng: p.lng }); setPlaceName(p.address.split(',')[0]) }} />
        </Field>
        {place && (
          <Field label="What to call it" htmlFor="chg-name">
            <Input id="chg-name" value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
          </Field>
        )}
        {date.place_moved && <Button size="sm" variant="ghost" className="w-fit" onClick={() => void go('meetup')} disabled={busy}>Go back to the usual meeting point</Button>}
      </div>
      {err && <div className="mt-3"><Notice tone="off">{err}</Notice></div>}
    </Dialog>
  )
}
