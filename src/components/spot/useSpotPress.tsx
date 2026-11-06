'use client'

import { useCallback, useState, type ReactNode } from 'react'
import posthog from 'posthog-js'
import ReportSpotSheet from './ReportSpotSheet'
import { useSpotSwitch } from './useSpotSwitch'

/**
 * Report a spot from a map: hand `onSpotPress` to NearbyMap (press and hold,
 * or right-click) and render `sheet`. While the switch is off, onSpotPress
 * is undefined and the map's gesture does nothing.
 */
export function useSpotPress(surface: 'web_map' = 'web_map'): {
  onSpotPress: ((p: { lat: number; lng: number }) => void) | undefined
  sheet: ReactNode
} {
  const on = useSpotSwitch()
  const [at, setAt] = useState<{ lat: number; lng: number } | null>(null)
  const press = useCallback((p: { lat: number; lng: number }) => {
    posthog.capture('spot_map_pressed', { surface })
    setAt(p)
  }, [surface])
  const close = useCallback(() => setAt(null), [])
  return {
    onSpotPress: on ? press : undefined,
    sheet: on ? (
      <ReportSpotSheet surface={surface} open={!!at} spot={at ?? { lat: 0, lng: 0 }} onClose={close} />
    ) : null,
  }
}
