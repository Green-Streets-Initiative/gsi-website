'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, X } from 'lucide-react'
import { parseVideoEmbed } from './CreatorVideo'
import { gaEvent } from '@/lib/ga'

/**
 * The roam's photo slot. When a creator has made a video of the route, a
 * "Watch the video" button sits on the photo and opens the creator's own
 * player in a dialog sized to fit it, so nobody has to scroll inside a frame
 * on the page (Keith 2026-10-19). With a video and no photo, the button fills
 * the slot. The credit names the creator and links to their account.
 */
export default function RoamHeroMedia({
  roamId,
  name,
  photoUrl,
  photoCredit,
  photoCreditUrl,
  videoUrl,
  videoCredit,
  videoCreditUrl,
}: {
  roamId: string
  name: string
  photoUrl: string | null
  photoCredit: string | null
  photoCreditUrl: string | null
  videoUrl: string | null
  videoCredit: string | null
  videoCreditUrl: string | null
}) {
  const embed = parseVideoEmbed(videoUrl)
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!photoUrl && !embed) return null

  const watch = embed ? (
    <button
      type="button"
      onClick={() => {
        setOpen(true)
        gaEvent('roam_video_opened', { roam_id: roamId, platform: embed.platform })
      }}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-[0.9375rem] font-semibold text-navy shadow-[0_2px_10px_rgba(25,26,46,0.25)] hover:bg-cream"
    >
      <Play size={16} className="fill-navy" aria-hidden />
      Watch the video{videoCredit ? ` by ${videoCredit}` : ''}
    </button>
  ) : null

  return (
    <>
      <figure className="relative m-0 overflow-hidden rounded-[18px] bg-navy shadow-[0_1px_2px_rgba(25,26,46,0.06)] lg:mt-2">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="h-[150px] w-full object-cover sm:h-[280px] lg:h-[360px]" />
        ) : (
          <div className="h-[150px] w-full bg-gradient-to-br from-navy to-[#2D6A4F] sm:h-[280px] lg:h-[360px]" aria-hidden />
        )}
        {watch && <div className="absolute bottom-3 left-3">{watch}</div>}
        {photoUrl && photoCredit && (
          <figcaption className="absolute bottom-2 right-2 max-w-[70%] truncate rounded-full bg-navy/60 px-2.5 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
            {photoCreditUrl ? (
              <a href={photoCreditUrl} target="_blank" rel="noopener noreferrer">{photoCredit}</a>
            ) : (
              photoCredit
            )}
          </figcaption>
        )}
      </figure>

      {open && embed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name}: video${videoCredit ? ` by ${videoCredit}` : ''}`}
          className="fixed inset-0 z-[60] flex justify-center overflow-y-auto bg-navy/80 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="relative my-auto w-full max-w-[380px] pt-14">
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the video"
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy"
            >
              <X size={20} aria-hidden />
            </button>
            {/* Tall enough for the platform's header, video and footer, so it never scrolls inside. */}
            <iframe
              src={embed.src}
              title={`${name}: video${videoCredit ? ` by ${videoCredit}` : ''}`}
              allow="encrypted-media; picture-in-picture; autoplay"
              allowFullScreen
              scrolling="no"
              className={`w-full rounded-[12px] border-0 bg-white ${embed.vertical ? 'h-[min(860px,calc(100vh-150px))]' : 'aspect-video'}`}
            />
            <p className="mt-2 text-center text-[0.875rem] text-white">
              Video by{' '}
              {videoCreditUrl ? (
                <a href={videoCreditUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
                  {videoCredit ?? embed.platform}
                </a>
              ) : (
                <span className="font-semibold">{videoCredit ?? embed.platform}</span>
              )}
              {videoCredit ? ` on ${embed.platform}` : ''}.{videoCreditUrl ? ' Follow them for more rides like this.' : ''}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
