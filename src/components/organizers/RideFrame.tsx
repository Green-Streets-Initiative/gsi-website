'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, CopyPlus, ExternalLink, MapPin, MessageSquareText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { todayKey } from '@/lib/organizers/ride-words'
import { errorText, getRide } from '@/lib/organizers/api'
import { loadDatePhotos, photoDates } from '@/lib/organizers/photos'
import type { RideDetail } from '@/lib/organizers/types'
import { ASSISTANT_CHANGED_EVENT, openAssistant } from './AssistantPanel'
import { useConsole } from './ConsoleContext'
import { rideStateBadges, whenText } from './Dashboard'
import { Badge, Button, Card, Spinner, cx } from './ui'
import RouteMap from './RouteMap'

interface RideCtx {
  detail: RideDetail
  reload: () => Promise<void>
}

const Ctx = createContext<RideCtx | null>(null)

export function useRide(): RideCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRide outside RideFrame')
  return v
}

export function ridePageUrl(code: string): string {
  return `https://www.gogreenstreets.org/rides/${code}`
}

type Face = { name: string; avatar: string | null }

function dayLabel(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** The ride itself, at the top of every ride tab: its map (route, or the meeting pin), its flyer,
 * and the faces of who's going next (Keith 2026-11-20: the console was all text). */
function RideHero({ detail, faces }: { detail: RideDetail; faces: Record<string, Face[]> }) {
  const r = detail.ride
  const today = todayKey()
  const dates = [...detail.occurrences].sort((a, b) => a.date.localeCompare(b.date))
  const next = dates.find((d) => d.status === 'scheduled' && d.date >= today) ?? null
  const last = [...dates].reverse().find((d) => d.date < today && d.status !== 'canceled') ?? null
  const shown = next ?? last
  const line = (r.route_waypoints ?? []).length >= 2 ? r.route_waypoints : []
  const lat = shown?.meetup_lat ?? r.meetup_lat
  const lng = shown?.meetup_lng ?? r.meetup_lng
  const pin = lat != null && lng != null ? { lat, lng } : null
  const flyer = shown?.flyer_url ?? r.flyer_url
  const people = shown ? faces[shown.id] ?? [] : []
  const count = next ? next.going : last ? last.attended : 0
  return (
    <div className="overflow-hidden rounded-2xl border border-(--ev-line-mid) bg-white shadow-sm">
      <div className="relative">
        {line.length || pin ? (
          <RouteMap line={line} stops={[]} meetup={pin} pick={false} fitKey={`${r.id}-${line.length}`}
            className="h-[150px] w-full lg:h-[190px]" label={`Map of ${r.name}`} />
        ) : flyer ? null : (
          <Link href={`/organizers/rides/${r.id}/edit`}
            className="flex h-[120px] flex-col items-center justify-center gap-1.5 bg-(--ev-panel-faint) px-6 text-center text-[14px] text-(--ev-ink-75) hover:text-(--ev-ink)">
            <MapPin className="h-5 w-5" aria-hidden />Add a meeting point or a route to see the map here
          </Link>
        )}
        {flyer && (line.length || pin) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flyer} alt="Flyer" className="absolute bottom-2 left-2 z-[500] h-[72px] w-[56px] rounded-md border-2 border-white bg-white object-cover shadow-md" />
        ) : flyer ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flyer} alt="Flyer" className="h-[190px] w-full bg-(--ev-panel-faint) object-contain" />
        ) : null}
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        {people.length > 0 && (
          <div className="flex -space-x-2" aria-hidden>
            {people.slice(0, 5).map((p, i) => p.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img key={i} src={p.avatar} alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover" />
              : <span key={i} className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-(--ev-ink) text-[12px] font-bold text-white">{p.name.slice(0, 1).toUpperCase()}</span>)}
          </div>
        )}
        <p className="min-w-0 text-[15px] text-(--ev-ink-85)">
          {shown ? (
            <><span className="font-semibold text-(--ev-ink)">{next ? `Next: ${dayLabel(next.date)}` : `Last: ${dayLabel(last!.date)}`}</span>
              {' · '}{count === 0 ? (next ? 'nobody yet' : 'no count yet') : `${count} ${next ? 'going' : 'came'}`}</>
          ) : r.status === 'draft' ? 'No date yet' : 'No dates yet'}
        </p>
      </div>
    </div>
  )
}

export default function RideFrame({ id, children }: { id: string; children: ReactNode }) {
  const [detail, setDetail] = useState<RideDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const path = usePathname()
  const { assistant, me } = useConsole()

  const reload = useCallback(async () => {
    try {
      const d = await getRide(id)
      setDetail(d)
      setErr(null)
    } catch (e) {
      setErr(errorText(e, "We couldn't load this ride."))
    }
  }, [id])
  useEffect(() => {
    let live = true
    getRide(id)
      .then((d) => { if (live) setDetail(d) })
      .catch((e) => { if (live) setErr(errorText(e, "We couldn't load this ride.")) })
    const changed = () => { void reload() }
    window.addEventListener(ASSISTANT_CHANGED_EVENT, changed)
    return () => { live = false; window.removeEventListener(ASSISTANT_CHANGED_EVENT, changed) }
  }, [id, reload])

  // The Photos tab, once there's an album to look at: the newest date that
  // has started answers for the whole ride (404 while the event_photos
  // switch is off for this person, and for kids' rides, which have none).
  const [faces, setFaces] = useState<Record<string, Face[]>>({})
  const code = detail?.ride.invite_code ?? null
  useEffect(() => {
    if (!code) return
    let gone = false
    supabase.rpc('get_ride_going_faces', { p_code: code })
      .then(({ data, error }) => { if (!gone && !error && data) setFaces(data as Record<string, Face[]>) })
    return () => { gone = true }
  }, [code])

  const [hasPhotos, setHasPhotos] = useState(false)
  const newestStarted = detail ? photoDates(detail.occurrences)[0]?.id ?? null : null
  useEffect(() => {
    if (!newestStarted) return
    let gone = false
    loadDatePhotos(newestStarted).then((a) => { if (!gone) setHasPhotos(!!a) }).catch(() => {})
    return () => { gone = true }
  }, [newestStarted])

  if (err && !detail) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="text-[15px] text-(--ev-ink-85)">{err}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/organizers" className="inline-flex min-h-[44px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold">Your rides</Link>
          <Button variant="primary" onClick={() => void reload()}>Try again</Button>
        </div>
      </Card>
    )
  }
  if (!detail) return <Spinner label="Loading the ride" />

  const r = detail.ride
  const thing = r.activity === 'walk' ? 'walk' : 'ride'
  const base = `/organizers/rides/${id}`
  const tabs = [
    { href: base, label: 'Dates & updates', short: 'Dates' },
    { href: `${base}/roster`, label: "Who's coming", short: "Who's coming" },
    { href: `${base}/promote`, label: 'Promote', short: 'Promote' },
    { href: `${base}/turnout`, label: 'Turnout', short: 'Turnout' },
    ...(hasPhotos ? [{ href: `${base}/photos`, label: 'Photos', short: 'Photos' }] : []),
    { href: `${base}/team`, label: 'Organizers', short: 'Organizers' },
    ...(detail.can_edit ? [{ href: `${base}/edit`, label: `Edit ${thing}`, short: 'Edit' }] : []),
  ]
  // Edit ride and Plan a date are full-page forms with their own heading.
  const editing = path === `${base}/edit` || path.startsWith(`${base}/dates/`)

  return (
    <Ctx.Provider value={{ detail, reload }}>
      {editing ? children : (
        <>
          <Link href="/organizers" className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-(--ev-ink-80) hover:text-(--ev-ink)">
            <ArrowLeft className="h-4 w-4" aria-hidden />Your rides
          </Link>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-[clamp(26px,3.4vw,36px)] font-extrabold leading-tight">{r.name}</h1>
              <p className="mt-1 text-[15px] text-(--ev-ink-80)">
                {whenText(r)}{r.meetup_name ? ` · ${r.meetup_name}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rideStateBadges({ ...r, my_role: detail.my_role }).map((b) => <Badge key={b.text} tone={b.tone}>{b.text}</Badge>)}
                {detail.my_role === 'admin' && detail.organizer_person && <Badge>Organizer: {detail.organizer_person}</Badge>}
              </div>
            </div>
            {/* One row on a phone (short labels), so none wraps alone onto a second line. */}
            <div className="flex w-full gap-2 *:grow sm:w-auto sm:flex-wrap sm:*:grow-0">
              {assistant && (
                <button type="button" onClick={() => openAssistant('What needs doing next on this ride?')}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-(--ev-line-strong) bg-white px-2.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel) sm:min-h-[40px] sm:px-3.5">
                  <MessageSquareText className="h-4 w-4" aria-hidden /><span className="sm:hidden">Ask</span><span className="hidden sm:inline">Ask about this {thing}</span>
                </button>
              )}
              {/* The next one starts from this one: everything but its dates (Keith 2026-11-19). */}
              {me?.can_create && (
                <Link href={`/organizers/rides/new?copy=${r.id}`}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-(--ev-line-strong) bg-white px-2.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel) sm:min-h-[40px] sm:px-3.5">
                  <CopyPlus className="h-4 w-4" aria-hidden /><span className="sm:hidden">Copy {thing}</span><span className="hidden sm:inline">Copy this {thing}</span>
                </Link>
              )}
              {/* A draft has no page until it has a date (Shift 01833). */}
              {r.status !== 'draft' && (
                <a href={ridePageUrl(r.invite_code)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-(--ev-line-strong) bg-white px-2.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel) sm:min-h-[40px] sm:px-3.5">
                  {thing === 'walk' ? 'Walk page' : 'Ride page'}<ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              )}
            </div>
          </div>
          <RideHero detail={detail} faces={faces} />
          </div>

          {/* Phones get every tab as a pill in a three-across grid (two rows, short
              names), so none hides off-screen and the page starts on screen one. */}
          <nav aria-label="Ride" className="mt-5">
            {/* Seven tabs (Photos on) wrap as two full rows instead of a lone seventh pill. */}
            <ul className={cx(tabs.length > 6 ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-3 gap-1.5', 'sm:flex sm:flex-nowrap sm:gap-1 sm:border-b sm:border-(--ev-line-mid)')}>
              {tabs.map((t) => {
                const active = t.href === base ? path === base : path.startsWith(t.href)
                return (
                  <li key={t.href} className={tabs.length > 6 ? 'grow sm:grow-0' : undefined}>
                    <Link href={t.href} aria-current={active ? 'page' : undefined}
                      className={cx('flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-full border text-[14px] font-semibold sm:inline-flex sm:justify-start',
                        tabs.length > 6 ? 'px-3' : 'px-2',
                        'sm:-mb-px sm:min-h-0 sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-3 sm:py-2.5',
                        active
                          ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill) sm:text-(--ev-ink)'
                          : 'border-(--ev-line-strong) bg-white text-(--ev-ink-85) hover:text-(--ev-ink) sm:border-transparent sm:text-(--ev-ink-75)')}>
                      <span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="mt-6">{children}</div>
        </>
      )}
    </Ctx.Provider>
  )
}
