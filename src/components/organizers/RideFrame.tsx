'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ExternalLink, MessageSquareText } from 'lucide-react'
import { scheduleText } from '@/lib/rides/public'
import { errorText, getRide } from '@/lib/organizers/api'
import { loadDatePhotos, photoDates } from '@/lib/organizers/photos'
import type { RideDetail } from '@/lib/organizers/types'
import { ASSISTANT_CHANGED_EVENT, openAssistant } from './AssistantPanel'
import { useConsole } from './ConsoleContext'
import { rideStateBadges } from './Dashboard'
import { Badge, Button, Card, Spinner, cx } from './ui'

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

export default function RideFrame({ id, children }: { id: string; children: ReactNode }) {
  const [detail, setDetail] = useState<RideDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const path = usePathname()
  const { assistant } = useConsole()

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
    { href: `${base}/team`, label: 'Leaders', short: 'Leaders' },
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-[clamp(26px,3.4vw,36px)] font-extrabold leading-tight">{r.name}</h1>
              <p className="mt-1 text-[15px] text-(--ev-ink-80)">
                {scheduleText(r)}{r.meetup_name ? ` · ${r.meetup_name}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rideStateBadges({ ...r, my_role: detail.my_role }).map((b) => <Badge key={b.text} tone={b.tone}>{b.text}</Badge>)}
                {detail.my_role === 'admin' && detail.organizer_person && <Badge>Organizer: {detail.organizer_person}</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {assistant && (
                <button type="button" onClick={() => openAssistant('What needs doing next on this ride?')}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-3.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                  <MessageSquareText className="h-4 w-4" aria-hidden />Ask about this {thing}
                </button>
              )}
              <a href={ridePageUrl(r.invite_code)} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-3.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                {thing === 'walk' ? 'Walk page' : 'Ride page'}<ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </div>
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
