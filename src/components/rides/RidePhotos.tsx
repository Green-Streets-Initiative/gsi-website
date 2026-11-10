'use client'

import { useEffect, useState } from 'react'
import { ImagePlus, Images, Lock } from 'lucide-react'
import { fetchAlbum, readGuest, type AlbumResponse } from '@/app/events/[id]/photos/photo-api'
import { dateShort, dayShort } from '@/lib/rides/public'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

/**
 * The ride's newest date's photos on its public page (Shift ride photos,
 * design 2026-10-31, screen 5 "their last ride"): four of them and the count,
 * opening the date's album (/rides/<code>/photos/<date>), where people add
 * theirs for a week after. Shows only when the server hands over an album:
 * the `event_photos` switch is on (or the page has the date's preview key).
 *
 * An invite-only ride's photos are for people who said Going (Keith
 * 2026-11-09): the server hands the page a locked album, and the card says so
 * in one line with the way in. When this browser already confirmed an email
 * on the album page, the card asks again with it and shows the photos.
 *
 * The day after a ride, before anyone adds theirs, the empty album leads with
 * Add yours and the last date with photos sits under it ("Earlier photos").
 */
export default function RidePhotos({ album: initial, href, albumRef, preview = '', locale = 'en' }: {
  album: AlbumResponse
  href: string
  albumRef?: { ride: string; date: string }
  preview?: string
  locale?: SiteLocale
}) {
  const t = translator(ridesStrings, locale)
  const [album, setAlbum] = useState(initial)
  useEffect(() => {
    if (!initial.album.locked || !albumRef) return
    const g = readGuest()
    if (!g) return
    let gone = false
    fetchAlbum(albumRef, preview, g.token).then((a) => { if (a && !gone) setAlbum(a) }).catch(() => {})
    return () => { gone = true }
  }, [initial, albumRef, preview])

  const { photos } = album
  const locked = album.album.locked ?? null
  const canAdd = !locked && album.album.can_add && album.album.state === 'open'
  if (locked ? album.album.count === 0 && album.album.state !== 'open' : photos.length === 0 && !canAdd) return null
  const date = `${dayShort(album.event.date, locale)}, ${dateShort(album.event.date, locale)}`
  const thumbs = photos.filter((p) => p.thumb_url).slice(0, 4)
  const more = photos.length - thumbs.length
  const code = albumRef?.ride ?? album.event.ride_code ?? null
  const earlier = !locked && photos.length === 0 && code ? album.last_ride ?? null : null
  const earlierThumbs = earlier ? earlier.photos.filter((p) => p.thumb_url).slice(0, 4) : []
  const earlierDate = earlier ? `${dayShort(earlier.date, locale)}, ${dateShort(earlier.date, locale)}` : ''

  return (
    <section aria-label={t('photos.title', { date })} className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-4 shadow-(--ev-shadow) sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold text-(--ev-ink)">{t('photos.title', { date })}</h2>
        {photos.length > 0 && (
          <p className="shrink-0 text-[14px] font-medium text-(--ev-ink-75)">
            {photos.some((p) => p.kind === 'video') ? t('photos.count_media', { n: photos.length })
              : photos.length === 1 ? t('photos.count_one') : t('photos.count_other', { n: photos.length })}
          </p>
        )}
      </div>

      {locked ? (
        <>
          <p className="mt-2 flex items-start gap-2 text-[15px] text-(--ev-ink-85)">
            <Lock size={16} className="mt-[3px] shrink-0 text-(--ev-ink-75)" aria-hidden />
            {t(locked === 'code' && album.album.count > 0 ? 'photos.locked_code' : 'photos.locked_list')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {locked === 'code' ? (
              <a href={`${href}${href.includes('?') ? '&' : '?'}add=1`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] bg-(--ev-accent-fill) px-4 py-2 text-[14px] font-bold text-(--ev-on-accent-fill) hover:opacity-90">
                {album.album.count > 0 ? <><Images size={15} /> {t('photos.locked_open')}</> : <><ImagePlus size={15} /> {t('photos.add')}</>}
              </a>
            ) : (
              <a href="#going" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] bg-(--ev-accent-fill) px-4 py-2 text-[14px] font-bold text-(--ev-on-accent-fill) hover:opacity-90">
                {t('photos.say_going')}
              </a>
            )}
          </div>
        </>
      ) : thumbs.length > 0 ? (
        <a href={href} aria-label={t('photos.open', { date })} className="mt-3 grid grid-cols-4 gap-1.5 overflow-hidden rounded-xl">
          {thumbs.map((p, i) => (
            <span key={p.id} className="relative aspect-square overflow-hidden bg-(--ev-panel)">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs */}
              <img src={p.thumb_url!} alt="" loading="lazy" className="h-full w-full object-cover" />
              {i === thumbs.length - 1 && more > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[18px] font-bold text-white">+{more}</span>
              )}
            </span>
          ))}
        </a>
      ) : (
        <p className="mt-1 text-[15px] text-(--ev-ink-80)">{t('photos.empty')}</p>
      )}

      {!locked && <div className="mt-3 flex flex-wrap gap-2">
        {photos.length > 0 && (
          <a href={href} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
            <Images size={15} /> {t('photos.see_all')}
          </a>
        )}
        {canAdd && (
          <a href={`${href}${href.includes('?') ? '&' : '?'}add=1`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] bg-(--ev-accent-fill) px-4 py-2 text-[14px] font-bold text-(--ev-on-accent-fill) hover:opacity-90">
            <ImagePlus size={15} /> {t('photos.add')}
          </a>
        )}
      </div>}

      {earlier && earlierThumbs.length > 0 && (
        <a href={withLang(`/rides/${encodeURIComponent(code!)}/photos/${earlier.date}`, locale)} aria-label={t('photos.open', { date: earlierDate })} className="mt-4 block border-t border-(--ev-line-mid) pt-4">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-bold text-(--ev-ink)">{t('photos.earlier')}</span>
            <span className="shrink-0 text-[14px] font-medium text-(--ev-ink-75)">
              {earlierDate} · {earlier.count === 1 ? t('photos.count_one') : t('photos.count_other', { n: earlier.count })}
            </span>
          </span>
          <span className="mt-2 grid grid-cols-4 gap-1.5 overflow-hidden rounded-xl">
            {earlierThumbs.map((p) => (
              <span key={p.id} className="relative aspect-square overflow-hidden bg-(--ev-panel)">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs */}
                <img src={p.thumb_url!} alt="" loading="lazy" className="h-full w-full object-cover" />
              </span>
            ))}
          </span>
        </a>
      )}
    </section>
  )
}
