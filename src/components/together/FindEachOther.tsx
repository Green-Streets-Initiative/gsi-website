'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Crosshair, MessageSquare, Navigation, TriangleAlert } from 'lucide-react'
import PinMap, { type Pin } from '@/components/together/PinMap'
import { Button, cx } from '@/components/organizers/ui'
import { SITE_LOCALE_TAG, translator, type SiteLocale } from '@/lib/site-i18n'
import { togetherMoreStrings } from '@/lib/site-strings/together-more'
import { track } from '@/lib/together'
import { directionsUrl, meetStatus, milesBetween, publishMeetPosition, sameLocalDay, setMeetSharing, type MeetStatus } from '@/lib/together-more'

/**
 * "Find each other" on the web (the app's FindEachOtherCard and
 * partner-meet screen in one card; Shift 01627). On the day of a first trip
 * or a carpool pickup, each person can choose to share where they are with
 * the other around the meeting time. Only those two see it, you see theirs
 * only while you share yours, and it stops on its own once they're together:
 * the server enforces every one of those.
 *
 * The browser has no background location, so this page sends the browser's
 * position only while it's open (watchPosition, at most every 15 seconds,
 * only inside the window), and says so. While both share, the map shows the
 * spot, you and them, and checks for their dot every 10 seconds.
 *
 * Renders nothing outside the day's window, or when the server doesn't have
 * a meet-up for this match.
 */

type Way = 'walk' | 'bike' | 'transit' | 'drive'
const POLL_IDLE_MS = 30_000
const POLL_LIVE_MS = 10_000
const SEND_MS = 15_000
/** About 80 m: close enough to say they're there, given phone accuracy. */
const AT_SPOT_MI = 0.05
/** A dot older than this fades: their phone stopped checking in. */
const STALE_MS = 5 * 60_000

export default function FindEachOther({ matchId, name: fallbackName, way, locale }: { matchId: string; name: string; way: Way; locale: SiteLocale }) {
  const t = translator(togetherMoreStrings, locale)
  const [status, setStatus] = useState<MeetStatus | null | undefined>(undefined)
  const [now, setNow] = useState(() => Date.now())
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  /** The browser said no to location for this page. */
  const [blocked, setBlocked] = useState(false)
  const lastSent = useRef(0)
  const stopped = useRef(false)

  const load = useCallback(async () => {
    const s = await meetStatus(matchId)
    setStatus(s)
    setNow(Date.now())
    if (s && !s.i_share) stopped.current = false
  }, [matchId])

  const start = status ? new Date(status.starts_at) : null
  const end = status ? new Date(status.ends_at) : null
  const today = !!start && !!end && sameLocalDay(start) && now <= end.getTime()
  const open = !!start && !!end && now >= start.getTime() && now <= end.getTime()
  const sharingLive = !!status?.i_share && open && !status.met_at

  // Check every 30 s while nothing is happening, every 10 s while the window is open.
  useEffect(() => {
    let live = true
    const tick = () => meetStatus(matchId).then((s) => {
      if (!live) return
      setStatus(s)
      setNow(Date.now())
      if (s && !s.i_share) stopped.current = false
    })
    void tick()
    const timer = setInterval(() => void tick(), sharingLive ? POLL_LIVE_MS : POLL_IDLE_MS)
    return () => { live = false; clearInterval(timer) }
  }, [matchId, sharingLive])

  // This page's own position, only while sharing is on and the window is open.
  useEffect(() => {
    if (!sharingLive || typeof navigator === 'undefined' || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setBlocked(false)
        if (stopped.current || Date.now() - lastSent.current < SEND_MS) return
        lastSent.current = Date.now()
        void publishMeetPosition(matchId, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }).then((r) => {
          if (r.stop) stopped.current = true
        })
      },
      (err) => { if (err.code === err.PERMISSION_DENIED) setBlocked(true) },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [sharingLive, matchId])

  if (!status || !start || !end || !today) return null

  const name = status.other_name ?? fallbackName
  const clock = (d: Date) => d.toLocaleTimeString(SITE_LOCALE_TAG[locale], { hour: 'numeric', minute: '2-digit' })
  const carpool = status.kind === 'carpool'
  const spot = status.meet_lat != null && status.meet_lng != null ? { lat: status.meet_lat, lng: status.meet_lng } : null
  const spotName = status.meet_label ?? t(carpool ? 'pk.spot' : 'meet.spot_meet')
  const other = status.other
  const me = status.me
  const otherAge = other?.updated_at ? now - new Date(other.updated_at).getTime() : null
  const stale = otherAge != null && otherAge > STALE_MS
  const away = other && spot ? milesBetween(other, spot) : null
  const ended = now > end.getTime()
  const noGeo = typeof navigator === 'undefined' || !navigator.geolocation

  async function toggle(next: boolean) {
    if (saving) return
    setSaving(true)
    setFailed(false)
    const r = await setMeetSharing(matchId, next)
    track('together_meet_sharing_toggled', { kind: status?.kind ?? null, on: next, ok: r.ok, window_open: open })
    if (!r.ok) setFailed(true)
    else {
      stopped.current = false
      lastSent.current = 0
      await load()
    }
    setSaving(false)
  }

  if (status.met_at) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-(--ev-accent) bg-white p-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-(--ev-accent)" aria-hidden />
        <p className="text-[17px] font-bold">{t('meet.found')}</p>
      </div>
    )
  }

  const headline =
    ended ? t('meet.ended')
    : !status.i_share ? t('meet.share_to_see', { name })
    : !open ? t('meet.starts_at', { start: clock(start) })
    : !status.they_share ? t('meet.not_sharing_yet', { name })
    : !other ? t('meet.looking_for', { name })
    : away != null && away <= AT_SPOT_MI ? t('meet.at_spot', { name, spot: spotName })
    : away != null ? t('meet.away_from', { name, miles: Math.max(0.1, Math.round(away * 10) / 10).toFixed(1), spot: spotName })
    : t('meet.sharing', { name })
  const ago = otherAge == null ? null
    : otherAge < 60_000 ? t('meet.just_now')
    : t(Math.round(otherAge / 60_000) === 1 ? 'meet.min_ago_one' : 'meet.min_ago_other', { count: Math.round(otherAge / 60_000) })
  const showMap = status.i_share && open && status.they_share
  const pins: Pin[] = [
    ...(spot ? [{ ...spot, kind: 'spot' as const, label: spotName }] : []),
    ...(me ? [{ lat: me.lat, lng: me.lng, kind: 'home' as const, label: t('meet.you') }] : []),
    ...(other && !stale ? [{ lat: other.lat, lng: other.lng, kind: 'match' as const, label: name }] : []),
  ]

  return (
    <section aria-label={t('meet.title')} className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-accent) bg-white p-4">
      <div className="flex items-center gap-3">
        <Crosshair className="h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />
        <h3 className="flex-1 text-[17px] font-bold">{t('meet.title')}</h3>
      </div>
      <p className="text-[15px] text-(--ev-ink-85)">{t('meet.body', { name, start: clock(start) })}</p>
      {/* The browser can't share in the background: say so before they rely on it. */}
      <p className="text-[15px] font-semibold">{t('meet.web_open')}</p>

      <p className="text-[17px] font-bold" aria-live="polite">{headline}</p>
      {status.i_share && open && other && ago ? <p className="text-[14px] text-(--ev-ink-80)">{ago}</p> : null}
      {status.i_share && !open && !ended ? <p className="text-[15px] text-(--ev-ink-80)">{t('meet.turns_on_at', { start: clock(start) })}</p> : null}
      {status.i_share && open && !status.they_share ? <p className="text-[15px] text-(--ev-ink-80)">{t('meet.waiting_for_them', { name })}</p> : null}

      {sharingLive && (blocked || noGeo) ? (
        <p className="flex items-start gap-2 rounded-xl bg-(--ev-panel) p-3 text-[15px]">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-ink-80)" aria-hidden />
          {noGeo ? t('meet.web_none') : t('meet.web_blocked', { name })}
        </p>
      ) : null}

      {showMap && pins.length ? (
        <PinMap pins={pins} title={t('meet.map_alt', { name })} boxClassName="aspect-[4/3] sm:aspect-[16/9]" width={560} height={360} maxZoom={17} quiet={false} />
      ) : null}

      {failed ? <p role="alert" className="text-[15px] font-semibold text-(--ev-danger)">{t('pk.failed')}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        {!status.i_share && !ended ? (
          <Button variant="primary" busy={saving} onClick={() => void toggle(true)}>{t('meet.share_now')}</Button>
        ) : null}
        {status.other_phone ? (
          <a
            href={`sms:${status.other_phone}`}
            onClick={() => track('together_meet_text_tapped', { kind: status.kind })}
            className={cx(
              'inline-flex min-h-[44px] items-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold',
              status.i_share ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border border-(--ev-line-strong) bg-white',
            )}
          >
            <MessageSquare className="h-4 w-4" aria-hidden /> {t('meet.text', { name })}
          </a>
        ) : null}
        {spot ? (
          <a
            href={directionsUrl(spot, way)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('together_meet_directions_tapped', { kind: status.kind, way })}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold"
          >
            <Navigation className="h-4 w-4" aria-hidden /> {t('meet.directions_to', { spot: spotName })}
          </a>
        ) : null}
        {status.i_share && !ended ? (
          <button type="button" disabled={saving} onClick={() => void toggle(false)} className="min-h-[44px] text-[15px] font-semibold underline">
            {t('meet.stop')}
          </button>
        ) : null}
      </div>
      {status.i_share && open ? <p className="text-[15px] text-(--ev-ink-80)">{t('meet.only_them', { name, end: clock(end) })}</p> : null}
    </section>
  )
}
