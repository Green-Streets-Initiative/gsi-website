'use client'

import { useState } from 'react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { clock } from '@/lib/rides/public'
import { changeDate, errorText, setDateCanceled } from '@/lib/organizers/api'
import { dateLabel, plural } from '@/lib/organizers/ride-words'
import type { DetailDate, RideRow } from '@/lib/organizers/types'
import { sentLine } from './PostUpdate'
import { Button, Dialog, Field, Input, Notice } from './ui'

/** Cancel one date: the app's set_ride_occurrence_canceled, then the notice. */
export function CancelDateDialog({ date, onClose, onDone }: { date: DetailDate | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!date) return null
  const told = date.going + date.maybe
  async function go() {
    if (!date) return
    setBusy(true)
    setErr(null)
    try {
      const sent = await setDateCanceled(date.id, true)
      onDone(`${dateLabel(date.date)} is cancelled. ${sentLine(sent)}`)
    } catch (e) {
      setErr(errorText(e))
      setBusy(false)
    }
  }
  return (
    <Dialog open onClose={onClose} title={`Cancel ${dateLabel(date.date)}?`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Keep it</Button>
        <Button variant="danger" onClick={() => void go()} busy={busy}>Cancel this date</Button>
      </>}>
      <p className="text-[15px] leading-relaxed text-(--ev-ink-85)">
        {told > 0
          ? `${plural(told, 'person', 'people')} said Going or Maybe. They'll hear it's cancelled, by app or email, and the ride page will say so.`
          : "Nobody has answered for this date yet. The ride page and calendar will show it's cancelled."}
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
  if (!date) return null

  const timeChanged = !!time && time !== date.start_time.slice(0, 5)
  const anyChange = timeChanged || !!place
  const told = date.going + date.maybe

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
      onDone(r.changed ? `${dateLabel(date.date)} is updated. ${sentLine(r.sent)}` : 'Nothing changed.')
    } catch (e) {
      setErr(errorText(e))
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Change ${dateLabel(date.date)}`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={() => void go()} busy={busy} disabled={!anyChange}>Save and tell people</Button>
      </>}>
      <p className="text-[14px] leading-snug text-(--ev-ink-80)">
        Just this date. {told > 0 ? `${plural(told, 'person', 'people')} who said Going or Maybe will hear about it.` : 'Nobody has answered for it yet.'}
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
