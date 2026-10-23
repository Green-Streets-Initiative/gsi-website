'use client'

import { useCallback, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * The event's flyer pages, side by side: the front, then an event map or a
 * second page (Shift 01250). One image renders as the plain framed picture
 * it always was. Two or more become a paged strip: swipe on a phone, the
 * arrows or the left/right keys on a keyboard, the dots to jump. No count
 * badge on the picture: flyers put stickers in their corners, and the dots
 * already say where you are.
 */
export default function EventImageCarousel({ images, title }: { images: string[]; title: string }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const total = images.length

  const goTo = useCallback((i: number) => {
    const track = trackRef.current
    if (!track) return
    const next = Math.max(0, Math.min(total - 1, i))
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' })
    setIndex(next)
  }, [total])

  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    const next = Math.round(track.scrollLeft / track.clientWidth)
    if (next !== index && next >= 0 && next < total) setIndex(next)
  }, [index, total])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1) }
  }, [goTo, index])

  if (total === 0) return null

  if (total === 1) {
    return (
      <div className="mb-6 overflow-hidden rounded-2xl border border-(--ev-line)">
        <img src={images[0]} alt={title} className="w-full object-contain" />
      </div>
    )
  }

  const arrowClass =
    'absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-(--ev-toast) text-(--ev-ink-on-toast) shadow-md transition-opacity hover:opacity-90 disabled:opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ev-accent)'

  return (
    <div className="mb-6">
      <div
        className="relative overflow-hidden rounded-2xl border border-(--ev-line) bg-(--ev-card)"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title}: ${total} images`}
      >
        <div
          ref={trackRef}
          tabIndex={0}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          className="no-scrollbar flex snap-x snap-mandatory items-start overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--ev-accent)"
        >
          {images.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="w-full shrink-0 snap-center"
              role="group"
              aria-roledescription="slide"
              aria-label={`Image ${i + 1} of ${total}`}
            >
              <img
                src={src}
                alt={i === 0 ? title : `${title}, image ${i + 1}`}
                className="w-full object-contain"
                loading={i === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous image"
          className={`${arrowClass} left-3`}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
          aria-label="Next image"
          className={`${arrowClass} right-3`}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-2 flex justify-center" role="tablist" aria-label="Choose an image">
        {images.map((src, i) => (
          <button
            key={`dot-${src}-${i}`}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Image ${i + 1} of ${total}`}
            onClick={() => goTo(i)}
            className="flex h-8 w-8 items-center justify-center focus-visible:outline-none"
          >
            <span
              className={`block h-2 w-2 rounded-full transition-colors ${
                i === index ? 'bg-(--ev-ink)' : 'bg-(--ev-line-strong)'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
