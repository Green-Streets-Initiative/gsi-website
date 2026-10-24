'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react'
import { clock } from '@/lib/rides/public'
import { errorText, saveDateDetails, uploadFlyer } from '@/lib/organizers/api'
import { dateLabel } from '@/lib/organizers/ride-words'
import { decodePlan, draftOf, routePayload } from '@/lib/organizers/saved-route'
import type { DetailDate, RideRow, RouteDraft } from '@/lib/organizers/types'
import { ROUTE_IMPORT_KEY } from './AssistantPanel'
import RouteMap from './RouteMap'
import RouteSection from './RouteSection'
import { Button, Card, Field, Input, Notice, Select, SectionTitle, Textarea, Toggle, cx } from './ui'

/**
 * Plan one date (Shift 01432): its own name, description, flyer and route.
 * Most groups ride somewhere new each time; anything left empty uses the
 * ride's usual details.
 */
interface Form {
  title: string
  description: string
  flyer_url: string | null
  own: boolean
  route: RouteDraft | null
  link: string
}

function fromDate(d: DetailDate): Form {
  return {
    title: d.title ?? '', description: d.description ?? '', flyer_url: d.flyer_url,
    own: d.own_route, route: draftOf(d.route), link: d.route?.route_google_maps_url ?? '',
  }
}

const LINK_OK = (v: string) => !v.trim() || /^https?:\/\/\S+$/i.test(v.trim())

export default function DateEditor({ ride, date, dates, onSaved }: {
  ride: RideRow; date: DetailDate; dates: DetailDate[]; onSaved?: () => Promise<void>
}) {
  const router = useRouter()
  const back = `/organizers/rides/${ride.id}`
  const draftKey = `shift-organizer-date-draft:${date.id}`
  const initial = useMemo(() => fromDate(date), [date])
  const [f, setF] = useState<Form>(initial)
  const [dirty, setDirty] = useState(false)
  const [restored, setRestored] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [flyerBusy, setFlyerBusy] = useState(false)
  // Remounts the route tool when a whole route is loaded into it.
  const [routeKey, setRouteKey] = useState(0)
  const [planned, setPlanned] = useState<{ stops: { lat: number; lng: number; label?: string }[]; chosen: number[] } | null>(null)
  const [plannedElsewhere, setPlannedElsewhere] = useState(false)
  const [imported, setImported] = useState<{ kind: 'gpx'; route: { name: string | null; waypoints: { lat: number; lng: number }[]; elevation: RouteDraft['elevation'] } } | { kind: 'rwgps'; url: string } | null>(null)
  const restoredOnce = useRef(false)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); setDirty(true) }

  // Unsaved work survives a closed tab or a lost sign-in, as in Edit ride.
  useEffect(() => {
    if (restoredOnce.current) return
    restoredOnce.current = true
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const saved = JSON.parse(raw) as { form: Form; at: number }
      if (Date.now() - saved.at > 14 * 864e5) { localStorage.removeItem(draftKey); return }
      setF({ ...initial, ...saved.form })
      setDirty(true)
      setRestored(true)
      setRouteKey((k) => k + 1)
    } catch { /* storage unavailable */ }
  }, [draftKey, initial])
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

  // A route the assistant planned for this date arrives as ?plan=, like Edit ride's.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('plan')
    if (!raw) return
    const j = decodePlan(raw)
    if (j) {
      const [lat, lng] = j.p[0]
      const m = { lat: date.meetup_lat ?? ride.meetup_lat, lng: date.meetup_lng ?? ride.meetup_lng }
      setPlannedElsewhere(m.lat == null || Math.abs(m.lat - lat) > 0.0005 || Math.abs((m.lng ?? 0) - lng) > 0.0005)
      setPlanned({ stops: j.p.slice(1).map(([la, ln, lb]) => ({ lat: la, lng: ln, ...(lb ? { label: lb } : {}) })), chosen: j.c })
      setF((p) => ({ ...p, own: true }))
      setDirty(true)
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('plan')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }, [date.meetup_lat, date.meetup_lng, ride.meetup_lat, ride.meetup_lng])

  // A route brought to the assistant: a GPX file it kept in this browser
  // (?import=<id>) or a Ride with GPS link (?rwgps=<url>), as in Edit ride.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('import')
    const rw = params.get('rwgps')
    if (id && /^[a-z0-9]{6,24}$/.test(id)) {
      try {
        const raw = localStorage.getItem(ROUTE_IMPORT_KEY(id))
        if (raw) setImported({ kind: 'gpx', route: JSON.parse(raw) })
      } catch { /* storage unavailable: nothing to load */ }
    } else if (rw && /^https:\/\/(www\.)?ridewithgps\.com\//.test(rw)) {
      setImported({ kind: 'rwgps', url: rw })
      setF((p) => ({ ...p, link: p.link || rw }))
    }
    if (id || rw) {
      setF((p) => ({ ...p, own: true }))
      setDirty(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('import')
      url.searchParams.delete('rwgps')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    }
  }, [])

  // Routes to start from: the usual one, and other dates that had their own.
  const sources = useMemo(() => {
    const out: { key: string; label: string; route: RouteDraft | null; link: string }[] = []
    const usual = draftOf(ride)
    if (usual || ride.route_google_maps_url) out.push({ key: 'usual', label: 'The usual route', route: usual, link: ride.route_google_maps_url ?? '' })
    for (const o of [...dates].sort((a, b) => b.date.localeCompare(a.date))) {
      if (o.id === date.id || !o.own_route || !o.route) continue
      out.push({ key: o.id, label: `${dateLabel(o.date)}${o.title ? `: ${o.title}` : ''}`, route: draftOf(o.route), link: o.route.route_google_maps_url ?? '' })
    }
    return out
  }, [ride, dates, date.id])

  function startFrom(key: string) {
    const s = sources.find((x) => x.key === key)
    if (!s) return
    setF((p) => ({ ...p, own: true, route: s.route, link: s.link }))
    setPlanned(null)
    setRouteKey((k) => k + 1)
    setDirty(true)
  }

  const reason = f.own && !f.route && !f.link.trim() ? 'Add a route or a link for this date, or pick the usual route' : null
  const linkErr = !LINK_OK(f.link) || !LINK_OK(f.flyer_url ?? '')

  async function save() {
    if (reason || linkErr) { setErr(reason ?? 'Links start with https://'); return }
    setSaving(true)
    setErr(null)
    try {
      const res = await saveDateDetails(date.id, {
        title: f.title.trim() || null,
        description: f.description.trim() || null,
        flyer_url: f.flyer_url,
        route: f.own ? routePayload(f.route, f.link.trim()) : null,
      })
      try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
      setDirty(false)
      await onSaved?.().catch(() => {})
      router.push(`${back}?saved=date`)
    } catch (e) {
      setErr(errorText(e, "We couldn't save this date. Your changes are kept here; try again."))
      setSaving(false)
    }
  }

  async function onFlyer(file: File) {
    setFlyerBusy(true)
    setErr(null)
    try { set('flyer_url', await uploadFlyer(file)) } catch (e) { setErr(errorText(e)) } finally { setFlyerBusy(false) }
  }

  const meetLat = date.meetup_lat ?? ride.meetup_lat
  const meetLng = date.meetup_lng ?? ride.meetup_lng
  const meetName = date.meetup_name ?? ride.meetup_name
  const meetup = meetLat != null && meetLng != null ? { lat: meetLat, lng: meetLng, label: meetName || undefined } : null
  const usual = draftOf(ride)

  return (
    <div className="pb-28">
      <Link href={back} className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-(--ev-ink-80) hover:text-(--ev-ink)">
        <ArrowLeft className="h-4 w-4" aria-hidden />{ride.name}
      </Link>
      <h1 className="font-display text-[clamp(28px,3.6vw,38px)] font-extrabold leading-tight">Plan {dateLabel(date.date)}</h1>
      <p className="mt-1 text-[15px] text-(--ev-ink-80)">
        {clock(date.start_time)}{meetName ? ` · ${meetName}` : ''}. Anything left empty uses the ride&rsquo;s usual details.
      </p>

      {restored && (
        <div className="mt-4">
          <Notice tone="info">
            We kept the changes you hadn&rsquo;t saved.{' '}
            <button type="button" className="font-semibold underline"
              onClick={() => { try { localStorage.removeItem(draftKey) } catch { /* ignore */ } setF(initial); setDirty(false); setRestored(false); setRouteKey((k) => k + 1) }}>
              Start over instead
            </button>
          </Notice>
        </div>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5">
        <Card>
          <SectionTitle>This date</SectionTitle>
          <div className="grid gap-4">
            <Field label="Name" htmlFor="date-title" optional hint={`Empty uses “${ride.name}”.`}>
              <Input id="date-title" value={f.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder={ride.name} />
            </Field>
            <Field label="What this ride is about" htmlFor="date-desc" optional hint="Empty uses the ride's usual description.">
              <Textarea id="date-desc" rows={5} value={f.description} maxLength={4000} onChange={(e) => set('description', e.target.value)}
                placeholder="Where you're headed, the coffee stop, anything new this time." />
            </Field>
            <Field label="Flyer" optional hint={ride.flyer_url ? 'Empty uses the ride’s usual flyer.' : 'Shows on the ride page and the calendar.'}>
              {f.flyer_url ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.flyer_url} alt="Flyer for this date" className="h-28 w-28 rounded-lg border border-(--ev-line-mid) object-cover" />
                  <Button size="sm" variant="ghost" onClick={() => set('flyer_url', null)}><Trash2 className="h-4 w-4" aria-hidden />Remove</Button>
                </div>
              ) : (
                <div>
                  <input id="date-flyer" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFlyer(file); e.target.value = '' }} />
                  <label htmlFor="date-flyer" className={cx('inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)', flyerBusy && 'pointer-events-none opacity-60')}>
                    <ImagePlus className="h-4 w-4" aria-hidden />{flyerBusy ? 'Uploading…' : 'Add a flyer'}
                  </label>
                </div>
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle hint="People see how far, how hilly and how comfortable it is before they come.">Route</SectionTitle>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Which route">
            <Toggle on={!f.own} onClick={() => set('own', false)}>{usual || ride.route_google_maps_url ? 'The usual route' : 'No route'}</Toggle>
            <Toggle on={f.own} onClick={() => set('own', true)}>A route for this date</Toggle>
          </div>

          {!f.own && usual && (
            <div className="mt-4 grid gap-2">
              <RouteMap line={usual.waypoints} stops={[]} meetup={meetup} pick={false} className="h-[240px] w-full overflow-hidden rounded-xl border border-(--ev-line-mid)" label="The usual route" />
              {ride.route_miles != null && <p className="text-[15px] font-semibold text-(--ev-ink-85)">{ride.route_miles.toFixed(1)} mi</p>}
            </div>
          )}

          {f.own && (
            <div className="mt-4 grid gap-4">
              {sources.length > 0 && (
                <Field label="Start from" htmlFor="date-source" optional hint="Load a route, then change what's different this time.">
                  <Select id="date-source" value="" onChange={(e) => startFrom(e.target.value)} className="max-w-[420px]">
                    <option value="">Pick a route…</option>
                    {sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </Select>
                </Field>
              )}
              {plannedElsewhere && (
                <Notice tone="info">This route starts somewhere other than this date&rsquo;s meeting point. To move the meeting point, use Change on the ride page.</Notice>
              )}
              <RouteSection key={routeKey} route={f.route} onRoute={(r) => set('route', r)} meetup={meetup} pace={ride.pace ?? null} initialPlan={planned} initialImport={imported} />
              <Field label="Link to the route elsewhere" htmlFor="date-link" optional hint="Ride with GPS, Strava, Komoot or Google Maps, shown as a link."
                error={!LINK_OK(f.link) ? 'Links start with https://' : null}>
                <Input id="date-link" value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="https://ridewithgps.com/routes/…" inputMode="url" />
              </Field>
            </div>
          )}
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-(--ev-line) bg-(--ev-bar) backdrop-blur">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <p className={cx('mr-auto text-[14px]', err ? 'font-semibold text-(--ev-danger)' : 'text-(--ev-ink-75)')} role={err ? 'alert' : undefined}>
            {err ?? (reason ? `Still needed: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}` : dirty ? 'Unsaved changes' : 'No changes yet')}
          </p>
          <Link href={back} className="inline-flex min-h-[44px] items-center rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-85) hover:bg-(--ev-panel)">
            Cancel
          </Link>
          <Button variant="primary" onClick={() => void save()} busy={saving} disabled={!dirty}>Save this date</Button>
        </div>
      </div>
    </div>
  )
}
