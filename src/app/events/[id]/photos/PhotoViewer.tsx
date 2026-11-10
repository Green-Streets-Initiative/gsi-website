'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Flag, Trash2, UserX, X } from 'lucide-react'
import EmailCode from './EmailCode'
import { ApiError, clockTime, fileName, post, type AlbumPhoto, type AlbumRef, type Guest } from './photo-api'

type Reason = 'in_photo' | 'remove' | 'report'

/**
 * One photo or video at a time, full screen. Swipe or use the arrow keys;
 * Esc closes. Save downloads the original. "I'm in this" takes it down at
 * once for everyone after one inline confirm, with no review; Remove is for
 * the person who posted it and the organizer; Report hides it too. Taking a
 * photo down needs a confirmed email, so a first-timer confirms right here.
 */
export default function PhotoViewer({ photos, index, onIndex, onClose, guest, onGuest, onRemoved, albumRef, preview }: {
  photos: AlbumPhoto[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  guest: Guest | null
  onGuest: (g: Guest) => void
  onRemoved: (id: string) => void
  albumRef: AlbumRef
  preview: string
}) {
  const photo = photos[index]
  const [confirm, setConfirm] = useState<Reason | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)

  const go = (d: number) => {
    const next = index + d
    if (next < 0 || next >= photos.length) return
    setConfirm(null)
    setError(null)
    onIndex(next)
  }

  useEffect(() => {
    closeRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null)
        else onClose()
      } else if (e.target instanceof HTMLInputElement) {
        // Arrow keys move the cursor in the email and code fields.
      } else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!photo) return null
  const noun = photo.kind === 'video' ? 'video' : 'photo'
  const when = photo.taken_at ?? photo.created_at ?? null

  async function takeDown(reason: Reason, token: string) {
    setBusy(true)
    setError(null)
    try {
      // A Shift ride date's album carries its link code: that's what opens it on the web.
      await post({ action: 'remove', web: true, preview, photo_id: photo.id, reason, ...('ride' in albumRef ? { ride: albumRef.ride } : {}) }, token)
      setConfirm(null)
      onRemoved(photo.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again in a minute.')
    } finally {
      setBusy(false)
    }
  }

  const ask: Record<Reason, { title: string; body: string; yes: string }> = {
    in_photo: { title: `Take this ${noun} down?`, body: 'It comes off the album right away, for everyone.', yes: 'Take it down' },
    remove: { title: `Remove this ${noun}?`, body: 'It comes off the album for everyone.', yes: 'Remove' },
    report: { title: `Report this ${noun}?`, body: 'It comes off the album right away, for everyone.', yes: 'Report it' },
  }

  const action = 'inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-white/25 px-4 text-[15px] font-semibold text-white hover:bg-white/10'
  const saveHref = photo.url ? `${photo.url}${photo.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(fileName(photo, index))}` : null

  return (
    <div role="dialog" aria-modal="true" aria-label={`${noun} ${index + 1} of ${photos.length}`} className="fixed inset-0 z-[100] flex flex-col bg-[#0E0F1A] text-white">
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold">{photo.poster_name}</p>
          <p className="text-[14px] text-white/80">
            {when ? `${clockTime(when)} · ` : ''}{index + 1} of {photos.length}
          </p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
          <X size={24} />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={(e) => {
          const t = touch.current
          touch.current = null
          if (!t) return
          const dx = e.changedTouches[0].clientX - t.x
          const dy = e.changedTouches[0].clientY - t.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
        }}
      >
        {photo.kind === 'video' ? (
          <video key={photo.id} src={photo.url ?? undefined} poster={photo.thumb_url ?? undefined} controls playsInline className="max-h-full max-w-full" />
        ) : photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={photo.id} src={photo.url} alt={`Photo by ${photo.poster_name}`} className="max-h-full max-w-full select-none object-contain" />
        ) : null}
        {photo.status === 'pending' && (
          <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[14px] font-semibold text-white">
            Being checked. Only you can see it for now.
          </p>
        )}
        {index > 0 && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex">
            <ChevronLeft size={26} />
          </button>
        )}
        {index < photos.length - 1 && (
          <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex">
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      <div className="px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        {confirm ? (
          <div className="events-tone events-tone-light mx-auto max-w-[480px] rounded-2xl bg-white p-5 text-(--ev-ink)">
            {guest ? (
              <>
                <p className="text-[17px] font-bold">{ask[confirm].title}</p>
                <p className="mt-1 text-[15px] text-(--ev-ink-80)">{ask[confirm].body}</p>
                {error && <p role="alert" className="mt-2 text-[14px] font-semibold text-(--ev-danger)">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => { setConfirm(null); setError(null) }} className="min-h-[46px] flex-1 rounded-[10px] border border-(--ev-line-strong) text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                    Keep it
                  </button>
                  <button type="button" disabled={busy} onClick={() => takeDown(confirm, guest.token)} className="min-h-[46px] flex-1 rounded-[10px] bg-(--ev-danger) text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-60">
                    {busy ? 'Taking it down…' : ask[confirm].yes}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[17px] font-bold">{ask[confirm].title}</p>
                <p className="mt-1 text-[15px] text-(--ev-ink-80)">{ask[confirm].body}</p>
                {error && <p role="alert" className="mt-2 text-[14px] font-semibold text-(--ev-danger)">{error}</p>}
                <div className="mt-3">
                  <EmailCode
                    albumRef={albumRef} preview={preview}
                    intro="First, confirm your email. We'll send you a 6-digit code."
                    onVerified={(g) => { onGuest(g); takeDown(confirm, g.token) }}
                    onCancel={() => { setConfirm(null); setError(null) }}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {saveHref && (
              <a href={saveHref} download={fileName(photo, index)} className={action}>
                <Download size={18} /> Save
              </a>
            )}
            <button type="button" onClick={() => setConfirm('in_photo')} className={action}>
              <UserX size={18} /> I&apos;m in this
            </button>
            {photo.can_remove && (
              <button type="button" onClick={() => setConfirm('remove')} className={action}>
                <Trash2 size={18} /> Remove
              </button>
            )}
            <button type="button" onClick={() => setConfirm('report')} className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] px-3 text-[15px] font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              <Flag size={16} /> Report
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
