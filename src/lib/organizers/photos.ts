'use client'

/**
 * Ride photos in the organizer console: one date's shared album, and taking
 * a photo down. Both go to Shift's `event-photos` function as the signed-in
 * organizer, the way the app does, so the same rules apply: the
 * `event_photos` switch must be on for them (it answers 404 otherwise), and
 * the ride's organizer, its leaders and GSI admins may remove any photo.
 */
import type { AlbumResponse } from '@/app/events/[id]/photos/photo-api'
import { accessToken } from './api'
import { todayKey } from './ride-words'
import { track } from './track'

const FN = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1/event-photos`
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export type DateAlbum = AlbumResponse & { album: AlbumResponse['album'] & { is_organizer?: boolean } }

/** One ride date's album, or null: the switch is off for them, the date has no album, or no sign-in. */
export async function loadDatePhotos(occurrenceId: string): Promise<DateAlbum | null> {
  let token: string
  try { token = await accessToken() } catch { return null }
  const res = await fetch(`${FN}?occurrence=${encodeURIComponent(occurrenceId)}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`event-photos ${res.status}`)
  const json = (await res.json()) as DateAlbum
  return json?.album && json.album.state !== 'none' ? json : null
}

/** Takes one photo off the album, for everyone. Throws the server's own words. */
export async function removeDatePhoto(photoId: string, occurrenceId: string): Promise<void> {
  const token = await accessToken()
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'remove', photo_id: photoId, reason: 'remove' }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { message?: string }).message ?? 'That photo could not be removed. Try again.')
  track('organizer_photo_removed', { occurrence_id: occurrenceId })
}

/**
 * The dates that have started, newest first: the ones that can have photos.
 * Today's date counts only once its start time has passed, so the tab never
 * opens on tonight's empty album while last week's has the photos.
 */
export function photoDates<T extends { date: string; status: string; start_time?: string | null }>(dates: T[], now = new Date()): T[] {
  const today = todayKey(now)
  const clock = now.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false })
  return dates
    .filter((d) => d.status !== 'canceled' && (d.date < today || (d.date === today && (d.start_time ?? '00:00') <= clock)))
    .sort((a, b) => b.date.localeCompare(a.date))
}
