'use client'

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { SheetSnap } from '@/lib/wayfinding/types'

const SNAP_POINTS: Record<SheetSnap, number> = {
  peek: 56,
  half: typeof window !== 'undefined' ? window.innerHeight * 0.45 : 400,
  full: typeof window !== 'undefined' ? window.innerHeight * 0.9 : 800,
}

const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full']
const VELOCITY_THRESHOLD = 0.5

interface Props {
  snap: SheetSnap
  onSnapChange: (snap: SheetSnap) => void
  children: React.ReactNode
}

export interface BottomSheetRef {
  snapTo: (snap: SheetSnap) => void
}

function getSnapPoints(): Record<SheetSnap, number> {
  if (typeof window === 'undefined') return SNAP_POINTS
  return {
    peek: 56,
    half: window.innerHeight * 0.45,
    full: window.innerHeight * 0.9,
  }
}

const BottomSheet = forwardRef<BottomSheetRef, Props>(function BottomSheet({ snap, onSnapChange, children }, ref) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startY: number; startHeight: number; startTime: number } | null>(null)

  useImperativeHandle(ref, () => ({
    snapTo: (s: SheetSnap) => {
      onSnapChange(s)
    },
  }))

  useEffect(() => {
    if (!sheetRef.current) return
    const points = getSnapPoints()
    sheetRef.current.style.height = `${points[snap]}px`
  }, [snap])

  const findNearestSnap = useCallback((height: number, velocity: number): SheetSnap => {
    const points = getSnapPoints()
    const currentIdx = SNAP_ORDER.indexOf(snap)

    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      const dir = velocity > 0 ? 1 : -1
      const nextIdx = Math.max(0, Math.min(SNAP_ORDER.length - 1, currentIdx + dir))
      return SNAP_ORDER[nextIdx]
    }

    let closest: SheetSnap = 'peek'
    let minDist = Infinity
    for (const s of SNAP_ORDER) {
      const dist = Math.abs(height - points[s])
      if (dist < minDist) {
        minDist = dist
        closest = s
      }
    }
    return closest
  }, [snap])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!sheetRef.current) return
    dragState.current = {
      startY: e.touches[0].clientY,
      startHeight: sheetRef.current.offsetHeight,
      startTime: Date.now(),
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.current || !sheetRef.current) return
    const deltaY = dragState.current.startY - e.touches[0].clientY
    const newHeight = Math.max(56, Math.min(window.innerHeight * 0.9, dragState.current.startHeight + deltaY))
    sheetRef.current.style.height = `${newHeight}px`
    sheetRef.current.style.transition = 'none'
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragState.current || !sheetRef.current) return
    const endY = e.changedTouches[0].clientY
    const deltaY = dragState.current.startY - endY
    const elapsed = (Date.now() - dragState.current.startTime) / 1000
    const velocity = deltaY / (elapsed * window.innerHeight)
    const currentHeight = sheetRef.current.offsetHeight

    sheetRef.current.style.transition = 'height 0.3s cubic-bezier(0.2, 0, 0, 1)'
    const newSnap = findNearestSnap(currentHeight, velocity)
    onSnapChange(newSnap)
    dragState.current = null
  }, [findNearestSnap, onSnapChange])

  return (
    <div
      ref={sheetRef}
      className="bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col"
      style={{
        height: `${getSnapPoints()[snap]}px`,
        transition: 'height 0.3s cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      <div
        className="flex-shrink-0 py-3 cursor-grab active:cursor-grabbing touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  )
})

export default BottomSheet
