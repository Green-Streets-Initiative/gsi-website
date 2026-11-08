'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChallengeView, EntryView } from '../_lib/api'
import { categoryLabel, prizeFor } from '../_lib/api'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { creativeStrings } from '@/lib/site-strings/challenges'

/** TikTok plays tall; YouTube and Vimeo wide. */
export const tall = (e: EntryView) => e.platform === 'tiktok'

/** The platform's own player, or ours for an uploaded file. */
export function Player({ entry, autoPlay = false, locale = 'en' }: { entry: EntryView; autoPlay?: boolean; locale?: SiteLocale }) {
  if (entry.platform === 'upload') return <FilePlayer entry={entry} autoPlay={autoPlay} locale={locale} />
  if (!entry.embed_url) return null
  const src = autoPlay && entry.platform !== 'tiktok'
    ? `${entry.embed_url}${entry.embed_url.includes('?') ? '&' : '?'}autoplay=1`
    : entry.embed_url
  return (
    <div className={`overflow-hidden rounded-[16px] bg-navy ${tall(entry) ? 'mx-auto aspect-[9/16] max-h-[78vh] w-full max-w-[420px]' : 'aspect-video w-full'}`}>
      <iframe
        src={src}
        title={entry.title}
        className="h-full w-full"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

/**
 * An uploaded ad. The link to the file lasts a few hours, so a page left open
 * overnight reloads it. Tall videos play tall. If the browser can't play the
 * file's format (an iPhone HEVC video in an older browser), say so plainly and
 * offer the file itself.
 */
function FilePlayer({ entry, autoPlay, locale }: { entry: EntryView; autoPlay: boolean; locale: SiteLocale }) {
  const t = translator(creativeStrings, locale)
  const [portrait, setPortrait] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!entry.video_url) return null
  const box = portrait ? 'mx-auto aspect-[9/16] max-h-[78vh] w-full max-w-[420px]' : 'aspect-video w-full'
  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 rounded-[16px] bg-navy px-6 text-center ${box}`}>
        <p className="text-[16px] text-white/85">{t('video.cant_play')}</p>
        <a href={entry.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-bold text-lime underline-offset-4 hover:underline">
          {t('video.open_file')}
        </a>
      </div>
    )
  }
  return (
    <div className={`overflow-hidden rounded-[16px] bg-navy ${box}`}>
      <video
        src={entry.video_url}
        poster={entry.thumbnail_url ?? undefined}
        controls
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        className="h-full w-full"
        aria-label={entry.title}
        onLoadedMetadata={(ev) => setPortrait(ev.currentTarget.videoHeight > ev.currentTarget.videoWidth)}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

/** One entry in a grid: its still, title and who made it. Opens the player. */
export function EntryCard({ c, entry, onOpen, footer, locale = 'en' }: {
  c: ChallengeView
  entry: EntryView
  onOpen: (e: EntryView) => void
  footer?: React.ReactNode
  locale?: SiteLocale
}) {
  const t = translator(creativeStrings, locale)
  const prize = prizeFor(c, entry.award)
  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="group relative block aspect-video w-full overflow-hidden rounded-[14px] bg-navy text-left"
        aria-label={t('card.play', { title: entry.title })}
      >
        {entry.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-headline text-[1.25rem] font-extrabold text-white">{entry.title}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7z" fill="#191A2E" /></svg>
          </span>
        </span>
        {prize && (
          <span className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-[14px] font-bold text-navy">{prize.label}</span>
        )}
        {!prize && entry.finalist_rank && (
          <span className="absolute left-3 top-3 rounded-full bg-lime px-3 py-1 text-[14px] font-bold text-navy">{t('card.finalist')}</span>
        )}
      </button>
      <div className="mt-3 flex-1">
        <p className="font-headline text-[1.125rem] font-extrabold leading-snug text-navy">{entry.title}</p>
        <p className="mt-1 text-[15px] text-ink-soft">
          {entry.credit_name} · {categoryLabel(c, entry.category, locale)}
        </p>
      </div>
      {footer}
    </li>
  )
}

/** The player in a dialog over the page; Escape or the button closes it. */
export function PlayerDialog({ c, entry, onClose, children, locale = 'en' }: {
  c: ChallengeView
  entry: EntryView | null
  onClose: () => void
  children?: React.ReactNode
  locale?: SiteLocale
}) {
  const t = translator(creativeStrings, locale)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (entry && !d.open) d.showModal()
    if (!entry && d.open) d.close()
  }, [entry])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="m-auto w-[min(960px,calc(100vw-32px))] rounded-[20px] bg-cream p-0 backdrop:bg-navy/70"
    >
      {entry && (
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-headline text-[1.375rem] font-extrabold leading-tight text-navy">{entry.title}</p>
              <p className="mt-1 text-[15px] text-ink-soft">{entry.credit_name} · {categoryLabel(c, entry.category, locale)}</p>
            </div>
            <button type="button" onClick={onClose} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-navy hover:bg-navy/[0.06]" aria-label={t('dialog.close')}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            </button>
          </div>
          <Player entry={entry} autoPlay locale={locale} />
          <p className="mt-4 text-[16px] leading-relaxed text-navy">&ldquo;{entry.says}&rdquo;</p>
          {children}
        </div>
      )}
    </dialog>
  )
}
