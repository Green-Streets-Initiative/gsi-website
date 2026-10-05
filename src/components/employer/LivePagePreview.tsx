'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

/**
 * A scaled, non-interactive live view of one of our own pages inside a
 * browser-chrome frame, so an admin can see what employees will see
 * instead of reading a description of it (Keith 2026-09-30). The iframe is
 * created only when the frame scrolls near the viewport and is dropped
 * again when it is far away, so a map page is never kept alive off-screen.
 * Clicking anywhere opens the real page in a new tab.
 */
export default function LivePagePreview({
  src,
  title,
  pageWidth = 1280,
  pageHeight = 800,
  openHref,
  fallback,
  className = '',
}: {
  src: string
  title: string
  pageWidth?: number
  pageHeight?: number
  openHref?: string
  /** Shown when the page fails to load or never answers. */
  fallback: ReactNode
  className?: string
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [state, setState] = useState<'idle' | 'mounted' | 'loaded' | 'failed'>('idle')
  const href = openHref ?? src

  // Measure the frame so the page scales to fit it.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Mount near the viewport, unmount far from it.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setState((s) => (s === 'idle' ? 'mounted' : s))
      },
      { rootMargin: '300px 0px' },
    )
    const far = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) setState((s) => (s === 'failed' ? s : 'idle'))
      },
      { rootMargin: '1500px 0px' },
    )
    near.observe(el)
    far.observe(el)
    return () => {
      near.disconnect()
      far.disconnect()
    }
  }, [])

  // A page that never answers falls back after ten seconds.
  useEffect(() => {
    if (state !== 'mounted') return
    const t = setTimeout(() => setState((s) => (s === 'mounted' ? 'failed' : s)), 10000)
    return () => clearTimeout(t)
  }, [state])

  const scale = width > 0 ? width / pageWidth : 0
  const height = Math.round(pageHeight * scale)
  const showFrame = state === 'mounted' || state === 'loaded'
  let pretty = src
  try {
    const u = new URL(src, 'https://www.gogreenstreets.org')
    pretty = `${u.host}${u.pathname}`
  } catch {
    /* keep src */
  }

  return (
    <div className={`overflow-hidden rounded-[12px] border border-line bg-surface-2 shadow-sm ${className}`}>
      <div className="flex h-7 items-center gap-1.5 border-b border-line bg-surface px-3">
        <span className="h-2 w-2 rounded-full bg-ink-icon/60" />
        <span className="h-2 w-2 rounded-full bg-ink-icon/60" />
        <span className="h-2 w-2 rounded-full bg-ink-icon/60" />
        <span className="ml-2 truncate text-[11px] text-ink-tertiary">{pretty}</span>
      </div>
      <div ref={frameRef} className="relative w-full" style={{ height: height || 200 }}>
        {state === 'failed' ? (
          <div className="absolute inset-0 grid place-items-center p-4">{fallback}</div>
        ) : (
          <>
            {state !== 'loaded' && <div className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden />}
            {showFrame && scale > 0 && (
              <iframe
                src={src}
                title={title}
                loading="lazy"
                tabIndex={-1}
                aria-hidden
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => setState('loaded')}
                onError={() => setState('failed')}
                style={{
                  width: pageWidth,
                  height: pageHeight,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  pointerEvents: 'none',
                  border: 0,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: state === 'loaded' ? 1 : 0,
                  transition: 'opacity 200ms',
                }}
              />
            )}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${title}`}
              className="absolute inset-0 no-underline"
            >
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-white shadow-md">
                <ExternalLink size={13} strokeWidth={2} />
                Open page
              </span>
            </a>
          </>
        )}
      </div>
    </div>
  )
}
