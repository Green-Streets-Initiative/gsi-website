'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ExternalLink, MessageSquareText } from 'lucide-react'
import { scheduleText } from '@/lib/rides/public'
import { errorText, getRide } from '@/lib/organizers/api'
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
  const base = `/organizers/rides/${id}`
  const tabs = [
    { href: base, label: 'Dates & updates' },
    { href: `${base}/roster`, label: "Who's coming" },
    { href: `${base}/turnout`, label: 'Turnout' },
    { href: `${base}/team`, label: 'Co-organizers' },
    ...(detail.can_edit ? [{ href: `${base}/edit`, label: 'Edit ride' }] : []),
  ]
  const editing = path === `${base}/edit`

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
                <button type="button" onClick={() => openAssistant(`About my ride "${r.name}" (id ${r.id}): what needs doing next?`)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-3.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                  <MessageSquareText className="h-4 w-4" aria-hidden />Ask about this ride
                </button>
              )}
              <a href={ridePageUrl(r.invite_code)} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-3.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                Ride page<ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>

          <nav aria-label="Ride" className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex min-w-max gap-1 border-b border-(--ev-line-mid)">
              {tabs.map((t) => {
                const active = t.href === base ? path === base : path.startsWith(t.href)
                return (
                  <li key={t.href}>
                    <Link href={t.href} aria-current={active ? 'page' : undefined}
                      className={cx('-mb-px inline-block border-b-2 px-3 py-2.5 text-[14px] font-semibold',
                        active ? 'border-(--ev-accent-fill) text-(--ev-ink)' : 'border-transparent text-(--ev-ink-75) hover:text-(--ev-ink)')}>
                      {t.label}
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
