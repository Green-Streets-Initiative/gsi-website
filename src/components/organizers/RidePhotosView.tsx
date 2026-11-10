'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Link2, Play, Trash2 } from 'lucide-react'
import { clockTime, countLine, shortDate, type AlbumPhoto } from '@/app/events/[id]/photos/photo-api'
import { errorText } from '@/lib/organizers/api'
import { loadDatePhotos, photoDates, removeDatePhoto, type DateAlbum } from '@/lib/organizers/photos'
import { dateLabel } from '@/lib/organizers/ride-words'
import { track } from '@/lib/organizers/track'
import { useRide } from './RideFrame'
import { Badge, Button, Card, Empty, Notice, SectionTitle, Spinner, cx } from './ui'

/**
 * The console's Photos tab (Shift ride photos, 2026-10-31 design): one
 * date's shared album at a time, newest first. Riders add photos in the app
 * and on the ride page for a week after each date; the organizer and leaders
 * can take any photo down here, for everyone, at once. Nothing to set up or
 * approve: the automatic check already keeps out what shouldn't show.
 */
const PILLS = 5

export default function RidePhotosView() {
  const { detail } = useRide()
  const thing = detail.ride.activity === 'walk' ? 'walk' : 'ride'
  // Every started date stays reachable: the newest as buttons, the rest of a long season in a list.
  const dates = useMemo(() => photoDates(detail.occurrences), [detail.occurrences])
  const [pick, setPick] = useState<string | null>(null)
  const current = dates.find((d) => d.id === pick) ?? dates[0] ?? null

  // A link to one date (?date=YYYY-MM-DD) opens on it.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('date')
    const hit = want ? dates.find((d) => d.date === want) : null
    if (hit) setPick(hit.id)
  }, [dates])

  const [album, setAlbum] = useState<{ id: string; data: DateAlbum | null } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(async (id: string) => {
    setErr(null)
    try {
      const data = await loadDatePhotos(id)
      setAlbum({ id, data })
    } catch (e) {
      setErr(errorText(e, 'The photos didn’t load. Try again.'))
    }
  }, [])
  useEffect(() => { if (current) void load(current.id) }, [current, load])

  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function remove(p: AlbumPhoto) {
    if (!current || !album?.data) return
    setBusy(p.id)
    setErr(null)
    try {
      await removeDatePhoto(p.id, current.id)
      setAlbum({ id: album.id, data: { ...album.data, photos: album.data.photos.filter((x) => x.id !== p.id) } })
      setConfirming(null)
    } catch (e) {
      setErr(errorText(e, 'That photo could not be removed. Try again.'))
    } finally {
      setBusy(null)
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      track('organizer_photo_link_copied', { occurrence_id: current?.id ?? null })
    } catch { /* the link is on screen to copy by hand */ }
  }

  if (!current) {
    return (
      <Empty title="No photos yet">
        Once your first date has started, riders can add their photos and videos from it, and they show here.
      </Empty>
    )
  }

  const data = album?.id === current.id ? album.data : undefined
  const photos = data?.photos ?? []
  // The server's count of who added them; after a removal, never more than are left.
  const people = Math.min(data?.album.people ?? 0, photos.length)
  const closesAt = data?.album.add_closes_at ?? null
  const open = data?.album.state === 'open'
  const closed = data?.album.state === 'closed'

  return (
    <div className="grid gap-5">
      <SectionTitle
        hint={`Riders add photos and videos from each date in the Shift app and on the ${thing} page, for a week after. Remove any that shouldn’t be there: it comes off the album for everyone, right away.`}
      >
        Photos
      </SectionTitle>

      {/* One date at a time, newest first. */}
      {dates.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Which date">
          {dates.slice(0, PILLS).map((d) => {
            const on = d.id === current.id
            return (
              <button key={d.id} type="button" aria-pressed={on} onClick={() => { setPick(d.id); setConfirming(null) }}
                className={cx('min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] font-semibold',
                  on ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) bg-white text-(--ev-ink-85) hover:text-(--ev-ink)')}>
                {dateLabel(d.date)}
              </button>
            )
          })}
          {dates.length > PILLS && (
            <select aria-label="An earlier date" value={dates.slice(PILLS).some((d) => d.id === current.id) ? current.id : ''}
              onChange={(e) => { if (e.target.value) { setPick(e.target.value); setConfirming(null) } }}
              className={cx('min-h-[44px] shrink-0 rounded-full border px-4 text-[14px] font-semibold',
                dates.slice(PILLS).some((d) => d.id === current.id) ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) bg-white text-(--ev-ink-85)')}>
              <option value="">Earlier dates</option>
              {dates.slice(PILLS).map((d) => <option key={d.id} value={d.id}>{dateLabel(d.date)}</option>)}
            </select>
          )}
        </div>
      )}

      {err && <Notice tone="off" onClose={() => setErr(null)}>{err}</Notice>}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-[19px] font-extrabold leading-tight text-(--ev-ink)">{dateLabel(current.date)}</h3>
            {data && (
              <p className="mt-1 text-[14px] text-(--ev-ink-75)">
                {photos.length > 0 ? countLine(photos, people) : 'No photos yet'}
                {closesAt && open ? ` · Riders can add theirs until ${shortDate(closesAt)}` : closesAt && closed ? ` · Adding closed ${shortDate(closesAt)}` : ''}
              </p>
            )}
          </div>
          {data?.share_url && photos.length > 0 && (
            <Button size="sm" onClick={() => void copyLink(data.share_url!)} aria-live="polite">
              {copied ? <><Check className="h-4 w-4" aria-hidden />Link copied</> : <><Link2 className="h-4 w-4" aria-hidden />Copy album link</>}
            </Button>
          )}
        </div>

        {data === undefined && !err ? <Spinner label="Loading the photos" /> : data === null ? (
          <p className="mt-4 text-[15px] text-(--ev-ink-80)">This date has no album.</p>
        ) : photos.length === 0 ? (
          <p className="mt-4 text-[15px] text-(--ev-ink-80)">
            {open ? 'Nobody has added photos from this date yet. They show here as riders add them.'
              : closed ? 'Nobody added photos from this date.' : 'This date hasn’t started yet. Riders can add photos once it starts.'}
          </p>
        ) : (
          // Compact tiles, so a busy date (60+ photos) scans quickly on a phone:
          // Remove sits on the photo, and its confirm covers the photo.
          <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-(--ev-line-mid) bg-white">
                <div className="relative aspect-square bg-(--ev-panel)">
                  <a href={p.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block h-full w-full"
                    aria-label={`${p.kind === 'video' ? 'Video' : 'Photo'} from ${p.poster_name}, opens full size`}>
                    {p.thumb_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs */
                      <img src={p.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[#191A2E] text-white"><Play className="h-7 w-7" aria-hidden /></span>
                    )}
                    {p.kind === 'video' && p.thumb_url && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[13px] font-semibold text-white">Video</span>
                    )}
                  </a>
                  {p.can_remove && confirming !== p.id && (
                    <button type="button" onClick={() => setConfirming(p.id)} aria-label={`Remove the ${p.kind === 'video' ? 'video' : 'photo'} from ${p.poster_name}`}
                      className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-(--ev-ink) shadow-sm hover:bg-white">
                      <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                  )}
                  {confirming === p.id && (
                    <div className="absolute inset-0 flex flex-col items-stretch justify-center gap-2 bg-[#191A2E]/90 p-3" role="group" aria-label="Remove it for everyone?">
                      <p className="text-center text-[14px] font-semibold leading-snug text-white">Remove it for everyone?</p>
                      <Button size="sm" variant="danger" busy={busy === p.id} onClick={() => void remove(p)}>Remove</Button>
                      <button type="button" disabled={busy === p.id} onClick={() => setConfirming(null)}
                        className="min-h-[44px] rounded-[10px] border border-white/60 text-[14px] font-semibold text-white hover:bg-white/10">Keep</button>
                    </div>
                  )}
                </div>
                <div className="px-2.5 py-2">
                  <p className="truncate text-[14px] font-semibold text-(--ev-ink)">{p.poster_name}</p>
                  <p className="text-[13px] text-(--ev-ink-75)">{clockTime(p.taken_at ?? p.created_at ?? current.date)}</p>
                  {(p.status === 'pending' || p.status === 'app_only') && (
                    <Badge className="mt-1.5" tone={p.status === 'pending' ? 'plain' : 'warn'}>
                      {p.status === 'pending' ? 'Being checked' : 'In the app only'}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
