'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { errorText, saveRide, uploadFlyer } from '@/lib/organizers/api'
import { DAY_LABELS, PACE_OPTIONS, TAG_OPTIONS, WEEK_OPTIONS } from '@/lib/organizers/ride-words'
import type { Frequency, Pace, RideRow, RouteDraft } from '@/lib/organizers/types'
import { useConsole } from './ConsoleContext'
import RouteMap from './RouteMap'
import RouteSection from './RouteSection'
import { Button, Card, Field, Input, Notice, Select, SectionTitle, Textarea, Toggle, cx } from './ui'

interface Form {
  name: string
  description: string
  flyer_url: string | null
  schedule: 'one_time' | 'recurring'
  ride_date: string
  frequency: Frequency
  days: number[]
  week_of_month: number
  season_start: string
  season_end: string
  start_time: string
  end_time: string
  meetup_name: string
  meetup_address: string
  meetup_lat: number | null
  meetup_lng: number | null
  route: RouteDraft | null
  route_google_maps_url: string
  pace: Pace | ''
  no_drop: boolean
  tags: string[]
  registration_url: string
  contact_url: string
  live_sharing: 'off' | 'members' | 'link'
  visibility: 'public' | 'invite'
  event_organizer_id: string
  organizer_name: string
  organizer_url: string
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')

function blank(): Form {
  return {
    name: '', description: '', flyer_url: null,
    schedule: 'recurring', ride_date: '', frequency: 'weekly', days: [6], week_of_month: 1,
    season_start: '', season_end: '', start_time: '10:00', end_time: '',
    meetup_name: '', meetup_address: '', meetup_lat: null, meetup_lng: null,
    route: null, route_google_maps_url: '',
    pace: '', no_drop: false, tags: [],
    registration_url: '', contact_url: '', live_sharing: 'off',
    visibility: 'public', event_organizer_id: '', organizer_name: '', organizer_url: '',
  }
}

function fromRow(r: RideRow): Form {
  return {
    name: r.name, description: r.description ?? '', flyer_url: r.flyer_url,
    schedule: r.ride_date ? 'one_time' : 'recurring', ride_date: r.ride_date ?? '',
    frequency: r.frequency, days: r.days ?? [], week_of_month: r.week_of_month ?? 1,
    season_start: r.season_start ?? '', season_end: r.season_end ?? '',
    start_time: hhmm(r.start_time), end_time: hhmm(r.end_time),
    meetup_name: r.meetup_name ?? '', meetup_address: r.meetup_address ?? '',
    meetup_lat: r.meetup_lat, meetup_lng: r.meetup_lng,
    route: r.route_waypoints?.length >= 2 ? {
      waypoints: r.route_waypoints, pins: r.route_pins ?? [], flags: r.route_flags ?? [],
      comfortSegments: r.comfort_segments, comfortRating: r.comfort_rating, comfortSummary: r.comfort_summary,
      elevation: r.route_elevation, source: 'saved',
    } : null,
    route_google_maps_url: r.route_google_maps_url ?? '',
    pace: r.pace ?? '', no_drop: !!r.no_drop, tags: r.tags ?? [],
    registration_url: r.registration_url ?? '', contact_url: r.contact_url ?? '',
    live_sharing: r.live_sharing ?? 'off',
    visibility: r.visibility === 'invite' ? 'invite' : 'public',
    event_organizer_id: r.event_organizer_id ?? '',
    organizer_name: r.organizer_name ?? '', organizer_url: r.organizer_url ?? '',
  }
}

function toPayload(f: Form): Record<string, unknown> {
  const r = f.route
  return {
    name: f.name, description: f.description, flyer_url: f.flyer_url,
    schedule: f.schedule, ride_date: f.ride_date || null, frequency: f.frequency,
    days: f.frequency === 'daily' ? [] : f.days, week_of_month: f.frequency === 'monthly' ? f.week_of_month : null,
    season_start: f.season_start || null, season_end: f.season_end || null,
    start_time: f.start_time, end_time: f.end_time || null,
    meetup_name: f.meetup_name, meetup_address: f.meetup_address, meetup_lat: f.meetup_lat, meetup_lng: f.meetup_lng,
    route_waypoints: r?.waypoints ?? [], route_pins: r?.pins ?? [], route_flags: r?.flags ?? [],
    comfort_segments: r?.comfortSegments ?? null, comfort_rating: r?.comfortRating ?? null,
    comfort_summary: r?.comfortSummary ?? null, route_elevation: r?.elevation ?? null,
    route_google_maps_url: f.route_google_maps_url,
    pace: f.pace || null, no_drop: f.no_drop, tags: f.tags,
    registration_url: f.registration_url, contact_url: f.contact_url, live_sharing: f.live_sharing,
    visibility: f.visibility, event_organizer_id: f.event_organizer_id || null,
    organizer_name: f.organizer_name, organizer_url: f.organizer_url,
  }
}

/** What still stands between this form and a ride, in the app's words. */
function blocking(f: Form): string | null {
  if (!f.name.trim()) return 'Give the ride a name'
  if (f.schedule === 'one_time' && !f.ride_date) return 'Pick a date'
  if (f.schedule === 'recurring' && f.frequency !== 'daily' && f.days.length === 0) return 'Pick at least one day'
  if (!f.start_time) return 'Pick a start time'
  if (f.meetup_lat == null || f.meetup_lng == null) return 'Pick a meeting point'
  if (f.end_time && f.end_time <= f.start_time) return 'The end time is before the start'
  if (f.schedule === 'recurring' && f.season_start && f.season_end && f.season_end < f.season_start) return 'The season ends before it starts'
  return null
}

const LINK_OK = (v: string, mail = false) => !v.trim() || (mail ? /^(https?:\/\/|mailto:)\S+$/i : /^https?:\/\/\S+$/i).test(v.trim())

export default function RideEditor({ ride, onSaved }: { ride: RideRow | null; onSaved?: () => Promise<void> }) {
  const router = useRouter()
  const { me } = useConsole()
  const draftKey = `shift-organizer-draft:${ride?.id ?? 'new'}`
  const initial = useMemo(() => (ride ? fromRow(ride) : blank()), [ride])
  const [f, setF] = useState<Form>(initial)
  const [dirty, setDirty] = useState(false)
  const [restored, setRestored] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const [flyerBusy, setFlyerBusy] = useState(false)
  const [meetupFit, setMeetupFit] = useState(0)
  const restoredOnce = useRef(false)

  // Unsaved work survives a closed tab or a lost sign-in.
  useEffect(() => {
    if (restoredOnce.current) return
    restoredOnce.current = true
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const saved = JSON.parse(raw) as { form: Form; at: number }
      if (Date.now() - saved.at > 14 * 864e5) { localStorage.removeItem(draftKey); return }
      setF({ ...blank(), ...saved.form })
      setDirty(true)
      setRestored(true)
    } catch { /* storage unavailable */ }
  }, [draftKey])

  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify({ form: f, at: Date.now() })) } catch { /* full or blocked */ }
    }, 500)
    return () => clearTimeout(t)
  }, [f, dirty, draftKey])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setF((prev) => ({ ...prev, [k]: v }))
    setDirty(true)
  }, [])

  const discardDraft = () => {
    try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
    setF(initial)
    setDirty(false)
    setRestored(false)
  }

  const orgs = me?.orgs ?? []
  const pickOrg = (id: string) => {
    const org = orgs.find((o) => o.id === id)
    setF((prev) => ({
      ...prev,
      event_organizer_id: id,
      organizer_name: org ? org.name : prev.organizer_name,
      organizer_url: org ? (org.url ?? '') : prev.organizer_url,
      // A new ride takes the organization's usual ride style, as the calendar does.
      ...(org && !ride ? {
        tags: Array.from(new Set([...prev.tags, ...org.ride_tags])),
        no_drop: prev.no_drop || org.rides_no_drop,
      } : {}),
    }))
    setDirty(true)
  }

  const reason = blocking(f)
  const linkErr = !LINK_OK(f.registration_url) || !LINK_OK(f.route_google_maps_url) || !LINK_OK(f.organizer_url) || !LINK_OK(f.contact_url, true)

  async function save() {
    setTried(true)
    if (reason || linkErr) { setErr(reason ?? 'Links start with https://'); return }
    setSaving(true)
    setErr(null)
    try {
      const res = await saveRide(ride?.id ?? null, toPayload(f))
      try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
      setDirty(false)
      await onSaved?.().catch(() => {})
      router.push(`/organizers/rides/${res.id}?${res.created ? 'created' : 'saved'}=1`)
    } catch (e) {
      setErr(errorText(e, "We couldn't save the ride. Your changes are kept here; try again."))
      setSaving(false)
    }
  }

  async function onFlyer(file: File) {
    setFlyerBusy(true)
    setErr(null)
    try { set('flyer_url', await uploadFlyer(file)) } catch (e) { setErr(errorText(e)) } finally { setFlyerBusy(false) }
  }

  const meetup = f.meetup_lat != null && f.meetup_lng != null ? { lat: f.meetup_lat, lng: f.meetup_lng, label: f.meetup_name || undefined } : null
  const toggleDay = (d: number) => set('days', f.frequency === 'monthly' ? [d] : f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort())
  const weekdays = f.days.length === 5 && [1, 2, 3, 4, 5].every((d) => f.days.includes(d))

  return (
    <div className="pb-28">
      <Link href={ride ? `/organizers/rides/${ride.id}` : '/organizers'} className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-(--ev-ink-80) hover:text-(--ev-ink)">
        <ArrowLeft className="h-4 w-4" aria-hidden />{ride ? ride.name : 'Your rides'}
      </Link>
      <h1 className="font-display text-[clamp(28px,3.6vw,38px)] font-extrabold leading-tight">{ride ? 'Edit ride' : 'New ride'}</h1>
      <p className="mt-1 max-w-2xl text-[15px] leading-snug text-(--ev-ink-80)">
        {ride
          ? 'Changes show on your ride page and in the app right away. To change a single date, use that date on the ride page.'
          : 'A ride you set up here shows up in the Shift app too, with a ride page you can share anywhere.'}
      </p>

      {restored && (
        <div className="mt-4">
          <Notice tone="info">
            We kept the changes you hadn&rsquo;t saved.{' '}
            <button type="button" className="font-semibold underline" onClick={discardDraft}>Start over instead</button>
          </Notice>
        </div>
      )}

      <div className="mt-6 grid gap-5">
        <Card>
          <SectionTitle>The ride</SectionTitle>
          <div className="grid gap-4">
            <Field label="Name" htmlFor="ride-name" error={tried && !f.name.trim() ? 'Give the ride a name' : null}>
              <Input id="ride-name" value={f.name} maxLength={120} onChange={(e) => set('name', e.target.value)} placeholder="Saturday Coffee Ride" />
            </Field>
            <Field label="Description" htmlFor="ride-desc" optional hint="What the ride is like, where it goes, what to bring. A first-timer reads this to decide whether to come.">
              <Textarea id="ride-desc" value={f.description} maxLength={4000} onChange={(e) => set('description', e.target.value)} rows={5}
                placeholder="An easy loop along the river with a coffee stop halfway. Bring lights after October." />
            </Field>
            <Field label="Flyer" optional hint="A square or portrait image works best. It shows on your ride page and in the app.">
              {f.flyer_url ? (
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.flyer_url} alt="Ride flyer" className="h-28 w-28 rounded-lg border border-(--ev-line-mid) object-cover" />
                  <Button size="sm" variant="ghost" onClick={() => set('flyer_url', null)}><Trash2 className="h-4 w-4" aria-hidden />Remove</Button>
                </div>
              ) : (
                <>
                  <input id="flyer" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFlyer(file); e.target.value = '' }} />
                  <label htmlFor="flyer" className={cx('inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)', flyerBusy && 'pointer-events-none opacity-60')}>
                    <ImagePlus className="h-4 w-4" aria-hidden />{flyerBusy ? 'Uploading…' : 'Add a flyer'}
                  </label>
                </>
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle>When</SectionTitle>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Schedule">
              <Toggle on={f.schedule === 'recurring'} onClick={() => set('schedule', 'recurring')}>Repeats</Toggle>
              <Toggle on={f.schedule === 'one_time'} onClick={() => set('schedule', 'one_time')}>One date</Toggle>
            </div>

            {f.schedule === 'one_time' ? (
              <Field label="Date" htmlFor="ride-date" error={tried && !f.ride_date ? 'Pick a date' : null}>
                <Input id="ride-date" type="date" value={f.ride_date} onChange={(e) => set('ride_date', e.target.value)} className="max-w-[220px]" />
              </Field>
            ) : (
              <>
                <Field label="How often" htmlFor="ride-freq">
                  <Select id="ride-freq" value={f.frequency} className="max-w-[260px]"
                    onChange={(e) => {
                      const v = e.target.value as Frequency
                      setF((p) => ({ ...p, frequency: v, days: v === 'monthly' ? p.days.slice(0, 1) : p.days }))
                      setDirty(true)
                    }}>
                    <option value="weekly">Every week</option>
                    <option value="biweekly">Every two weeks</option>
                    <option value="monthly">Once a month</option>
                    <option value="daily">Every day</option>
                  </Select>
                </Field>
                {f.frequency === 'monthly' && (
                  <Field label="Which week">
                    <div className="flex flex-wrap gap-2">
                      {WEEK_OPTIONS.map((w) => <Toggle key={w.key} on={f.week_of_month === w.key} onClick={() => set('week_of_month', w.key)}>{w.label}</Toggle>)}
                    </div>
                  </Field>
                )}
                {f.frequency !== 'daily' && (
                  <Field label={f.frequency === 'monthly' ? 'Day' : 'Days'} error={tried && f.days.length === 0 ? 'Pick at least one day' : null}>
                    <div className="flex flex-wrap gap-2">
                      {DAY_LABELS.map((d) => (
                        <Toggle key={d.key} on={f.days.includes(d.key)} onClick={() => toggleDay(d.key)} aria-label={d.long}>{d.short}</Toggle>
                      ))}
                      {f.frequency !== 'monthly' && (
                        <Button size="sm" variant="ghost" onClick={() => set('days', weekdays ? [] : [1, 2, 3, 4, 5])}>{weekdays ? 'Clear' : 'Weekdays'}</Button>
                      )}
                    </div>
                  </Field>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Season starts" htmlFor="season-start" optional hint="Leave empty to start now.">
                    <Input id="season-start" type="date" value={f.season_start} onChange={(e) => set('season_start', e.target.value)} />
                  </Field>
                  <Field label="Season ends" htmlFor="season-end" optional hint="Leave empty to keep going.">
                    <Input id="season-end" type="date" value={f.season_end} onChange={(e) => set('season_end', e.target.value)} />
                  </Field>
                </div>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts at" htmlFor="start-time">
                <Input id="start-time" type="time" value={f.start_time} onChange={(e) => set('start_time', e.target.value)} />
              </Field>
              <Field label="Back by" htmlFor="end-time" optional>
                <Input id="end-time" type="time" value={f.end_time} onChange={(e) => set('end_time', e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle hint="Where people gather before you roll out.">Meeting point</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="grid content-start gap-4">
              <Field label="Search for the place" error={tried && !meetup ? 'Pick a meeting point' : null}>
                <AddressAutocomplete
                  value={f.meetup_address}
                  onChange={(v) => set('meetup_address', v)}
                  onPlaceSelected={(p) => {
                    setF((prev) => ({
                      ...prev,
                      meetup_address: p.address,
                      meetup_lat: p.lat,
                      meetup_lng: p.lng,
                      meetup_name: prev.meetup_name || p.address.split(',')[0],
                    }))
                    setDirty(true)
                    setMeetupFit((k) => k + 1)
                  }}
                  label="Search for the place"
                  hideLabel
                  placeholder="Davis Square, or a street address"
                />
              </Field>
              <Field label="What to call it" htmlFor="meetup-name" hint="The spot people look for when they arrive.">
                <Input id="meetup-name" value={f.meetup_name} onChange={(e) => set('meetup_name', e.target.value)} placeholder="The bike racks by the Davis T entrance" />
              </Field>
              {meetup && <p className="text-[13px] text-(--ev-ink-75)">Click the map to move the pin to the exact spot.</p>}
            </div>
            <RouteMap
              line={[]}
              stops={[]}
              meetup={meetup}
              pick
              onPick={(p) => { setF((prev) => ({ ...prev, meetup_lat: p.lat, meetup_lng: p.lng })); setDirty(true) }}
              fitKey={meetupFit}
              className="h-[260px] w-full overflow-hidden rounded-xl border border-(--ev-line-mid)"
              label="Meeting point map. Click to place the pin."
            />
          </div>
        </Card>

        <Card>
          <SectionTitle hint="Optional, and worth it: people decide on distance, hills and how comfortable the streets are.">Route</SectionTitle>
          <RouteSection route={f.route} onRoute={(r) => set('route', r)} meetup={meetup} pace={f.pace || null} />
          <div className="mt-4">
            <Field label="Link to the route elsewhere" htmlFor="route-link" optional hint="Strava, Komoot, Google Maps. Shown on the ride page as a link."
              error={!LINK_OK(f.route_google_maps_url) ? 'Links start with https://' : null}>
              <Input id="route-link" value={f.route_google_maps_url} onChange={(e) => set('route_google_maps_url', e.target.value)} placeholder="https://www.strava.com/routes/…" inputMode="url" />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle>What to expect</SectionTitle>
          <div className="grid gap-5">
            <Field label="Pace" hint="The speed the group actually holds, so people can tell whether they'll keep up.">
              <div className="flex flex-wrap gap-2">
                <Toggle on={f.pace === ''} onClick={() => set('pace', '')}>Not stated</Toggle>
                {PACE_OPTIONS.map((p) => <Toggle key={p.key} on={f.pace === p.key} onClick={() => set('pace', p.key)}>{p.label}</Toggle>)}
              </div>
            </Field>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={f.no_drop} onChange={(e) => set('no_drop', e.target.checked)} className="mt-1 h-5 w-5 accent-(--ev-accent-fill)" />
              <span>
                <span className="block text-[15px] font-semibold text-(--ev-ink)">Nobody gets dropped</span>
                <span className="block text-[13px] text-(--ev-ink-75)">The group waits or regroups so slower people stay with it.</span>
              </span>
            </label>
            <Field label="Tags" optional>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((t) => (
                  <Toggle key={t.key} on={f.tags.includes(t.key)} onClick={() => set('tags', f.tags.includes(t.key) ? f.tags.filter((x) => x !== t.key) : [...f.tags, t.key])}>{t.label}</Toggle>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle>Sign-ups and contact</SectionTitle>
          <div className="grid gap-4">
            <Field label="Registration link" htmlFor="reg" optional hint="If people must sign up or sign a waiver somewhere else. Everyone can still say they're going here."
              error={!LINK_OK(f.registration_url) ? 'Links start with https://' : null}>
              <Input id="reg" value={f.registration_url} onChange={(e) => set('registration_url', e.target.value)} placeholder="https://…" inputMode="url" />
            </Field>
            <Field label="How people reach you" htmlFor="contact" optional hint="A WhatsApp or Discord group, or a mailto: link. Only people on the ride see it."
              error={!LINK_OK(f.contact_url, true) ? 'Start with https:// or mailto:' : null}>
              <Input id="contact" value={f.contact_url} onChange={(e) => set('contact_url', e.target.value)} placeholder="https://chat.whatsapp.com/…" inputMode="url" />
            </Field>
            <Field label="Live location on the day" htmlFor="live" hint="While a date is running, the organizer's phone (with the Shift app) shows where the group is, as one dot. Nothing to tap on the day.">
              <Select id="live" value={f.live_sharing} onChange={(e) => set('live_sharing', e.target.value as Form['live_sharing'])} className="max-w-[320px]">
                <option value="off">Off</option>
                <option value="members">People on this ride</option>
                <option value="link">Anyone with the ride link</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle>Who it&rsquo;s from, and who can find it</SectionTitle>
          <div className="grid gap-5">
            <Field label="Visibility">
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ['public', 'Public', 'On the Green Streets events calendar and in the app, after a quick review. Straight away when your organization is verified.'],
                  ['invite', 'Invite only', 'Only people with your ride link or code can find it.'],
                ] as const).map(([v, label, hint]) => (
                  <button key={v} type="button" aria-pressed={f.visibility === v} onClick={() => set('visibility', v)}
                    className={cx('rounded-xl border p-3 text-left transition', f.visibility === v ? 'border-(--ev-accent-fill) bg-(--ev-panel) ring-1 ring-(--ev-accent-fill)' : 'border-(--ev-line-strong) bg-white hover:bg-(--ev-panel-faint)')}>
                    <span className="block text-[15px] font-semibold text-(--ev-ink)">{label}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-(--ev-ink-75)">{hint}</span>
                  </button>
                ))}
              </div>
            </Field>
            {orgs.length > 0 && (
              <Field label="Organization" htmlFor="org">
                <Select id="org" value={f.event_organizer_id} onChange={(e) => pickOrg(e.target.value)} className="max-w-[420px]">
                  <option value="">Just me</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.claim === 'pending' ? ' (verification pending)' : ''}</option>)}
                </Select>
              </Field>
            )}
            {!f.event_organizer_id && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Host name" htmlFor="host-name" optional hint="Shown as who runs the ride.">
                  <Input id="host-name" value={f.organizer_name} onChange={(e) => set('organizer_name', e.target.value)} placeholder="Somerville Slow Rollers" />
                </Field>
                <Field label="Host website" htmlFor="host-url" optional error={!LINK_OK(f.organizer_url) ? 'Links start with https://' : null}>
                  <Input id="host-url" value={f.organizer_url} onChange={(e) => set('organizer_url', e.target.value)} placeholder="https://…" inputMode="url" />
                </Field>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-(--ev-line) bg-(--ev-bar) backdrop-blur">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <p className={cx('mr-auto text-[14px]', err ? 'font-semibold text-(--ev-danger)' : 'text-(--ev-ink-75)')} role={err ? 'alert' : undefined}>
            {err ?? (reason ? `Still needed: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}` : dirty ? 'Unsaved changes' : ride ? 'No changes yet' : '')}
          </p>
          <Link href={ride ? `/organizers/rides/${ride.id}` : '/organizers'} className="inline-flex min-h-[44px] items-center rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-85) hover:bg-(--ev-panel)">
            Cancel
          </Link>
          <Button variant="primary" onClick={() => void save()} busy={saving} disabled={!!ride && !dirty}>
            {ride ? 'Save changes' : 'Create ride'}
          </Button>
        </div>
      </div>
    </div>
  )
}
