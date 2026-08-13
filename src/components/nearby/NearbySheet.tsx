'use client'

import {
  useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle,
} from 'react'
import type { SheetSnap } from '@/lib/wayfinding/types'

/**
 * Dark-theme draggable bottom sheet for the /nearby app shell — the
 * wayfinding BottomSheet's snap mechanics, rebuilt on sturdier plumbing:
 * snap heights derive from the PARENT container (which tracks dvh, so the
 * iOS toolbar collapse just works) via ResizeObserver, dragging uses
 * pointer events (mouse + touch), and the peek height accounts for the
 * home-indicator safe area. Drag surface is the handle + header only; the
 * body scrolls normally — deliberately no scroll-position drag handoff.
 */

const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full']
const VELOCITY_THRESHOLD = 0.5
const TRANSITION = 'height 0.3s cubic-bezier(0.2, 0, 0, 1)'

interface Props {
  snap: SheetSnap
  onSnapChange: (snap: SheetSnap, source: 'drag' | 'tap') => void
  /** Pinned under the grab handle; part of the drag surface (tab bar +
   *  mode chips). Its real height is MEASURED for the peek snap, so
   *  whatever rides here stays fully visible when the sheet is tucked. */
  header?: React.ReactNode
  children: React.ReactNode
  /** Pre-measure fallback for the peek height, before safe-area (default 76) */
  peekContentPx?: number
}

export interface NearbySheetRef {
  snapTo: (snap: SheetSnap) => void
}

const NearbySheet = forwardRef<NearbySheetRef, Props>(function NearbySheet(
  { snap, onSnapChange, header, children, peekContentPx = 76 },
  ref,
) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startY: number; startHeight: number; startTime: number; moved: boolean } | null>(null)
  const [containerH, setContainerH] = useState(0)
  const [safeBottom, setSafeBottom] = useState(0)
  const [headerH, setHeaderH] = useState(0)

  // Peek must show the whole drag surface (handle + tabs + chips), whose
  // height varies — chips wrap on narrow phones and the painted toggle
  // comes and goes — so measure it rather than trusting a constant
  useEffect(() => {
    const el = dragRef.current
    if (!el) return
    const measure = () => setHeaderH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useImperativeHandle(ref, () => ({
    snapTo: (s: SheetSnap) => onSnapChange(s, 'tap'),
  }))

  // Snap heights derive from the shell container, not the window — the
  // container is h-[calc(100dvh-60px)], so rotation and browser-toolbar
  // changes flow through the ResizeObserver automatically
  useEffect(() => {
    const parent = sheetRef.current?.parentElement
    if (!parent) return
    const measure = () => setContainerH(parent.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  // env(safe-area-inset-bottom) isn't readable from JS — measure a probe
  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);width:0;visibility:hidden'
    document.body.appendChild(probe)
    const raf = requestAnimationFrame(() => {
      setSafeBottom(probe.offsetHeight)
      probe.remove()
    })
    return () => {
      cancelAnimationFrame(raf)
      probe.remove()
    }
  }, [])

  const points = useCallback((): Record<SheetSnap, number> => ({
    peek: (headerH || peekContentPx) + safeBottom,
    // full leaves a sliver of map — "there's a map behind this" stays legible
    half: Math.round(containerH * 0.45),
    full: Math.max(0, containerH - 12),
  }), [containerH, safeBottom, peekContentPx, headerH])

  // Apply the current snap height (also re-applies on container resize)
  useEffect(() => {
    const el = sheetRef.current
    if (!el || containerH === 0) return
    el.style.transition = TRANSITION
    el.style.height = `${points()[snap]}px`
  }, [snap, containerH, safeBottom, points])

  const settle = useCallback((height: number, velocity: number): SheetSnap => {
    const pts = points()
    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      const dir = velocity > 0 ? 1 : -1
      const nextIdx = Math.max(0, Math.min(SNAP_ORDER.length - 1, SNAP_ORDER.indexOf(snap) + dir))
      return SNAP_ORDER[nextIdx]
    }
    let closest: SheetSnap = 'peek'
    let minDist = Infinity
    for (const s of SNAP_ORDER) {
      const dist = Math.abs(height - pts[s])
      if (dist < minDist) {
        minDist = dist
        closest = s
      }
    }
    return closest
  }, [points, snap])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!sheetRef.current) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragState.current = {
      startY: e.clientY,
      startHeight: sheetRef.current.offsetHeight,
      startTime: Date.now(),
      moved: false,
    }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragState.current
    const el = sheetRef.current
    if (!drag || !el) return
    const deltaY = drag.startY - e.clientY
    if (Math.abs(deltaY) > 6) drag.moved = true
    const pts = points()
    const newHeight = Math.max(pts.peek, Math.min(pts.full, drag.startHeight + deltaY))
    el.style.transition = 'none'
    el.style.height = `${newHeight}px`
  }, [points])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragState.current
    const el = sheetRef.current
    if (!drag || !el) return
    dragState.current = null
    const deltaY = drag.startY - e.clientY
    const elapsed = Math.max(0.01, (Date.now() - drag.startTime) / 1000)
    const velocity = containerH > 0 ? deltaY / (elapsed * containerH) : 0
    const next = settle(el.offsetHeight, velocity)
    // Always restore an authoritative height — the snap effect won't re-run
    // when the settled snap equals the current one
    el.style.transition = TRANSITION
    el.style.height = `${points()[next]}px`
    if (next !== snap) onSnapChange(next, 'drag')
  }, [containerH, settle, points, snap, onSnapChange])

  // Tapping (not dragging) the handle cycles peek → half → full → peek
  const onHandleClick = useCallback(() => {
    if (dragState.current?.moved) return
    const nextIdx = (SNAP_ORDER.indexOf(snap) + 1) % SNAP_ORDER.length
    onSnapChange(SNAP_ORDER[nextIdx], 'tap')
  }, [snap, onSnapChange])

  return (
    <div
      ref={sheetRef}
      className="absolute bottom-0 left-0 right-0 z-20 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/[0.08] bg-[#1F2030] shadow-[0_-8px_28px_rgba(0,0,0,0.4)]"
      style={{ height: containerH ? undefined : `${peekContentPx}px`, transition: TRANSITION }}
    >
      {/* Drag surface: handle + header */}
      <div
        ref={dragRef}
        className="shrink-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          onClick={onHandleClick}
          aria-label="Resize panel"
          className="block w-full cursor-grab py-2.5 active:cursor-grabbing"
        >
          <span className="mx-auto block h-1 w-10 rounded-full bg-white/[0.25]" />
        </button>
        {header}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {children}
      </div>
    </div>
  )
})

export default NearbySheet
