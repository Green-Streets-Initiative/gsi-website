'use client'

import { useCallback, useState, type ReactNode } from 'react'
import posthog from 'posthog-js'
import { MapPin } from '@phosphor-icons/react'
import { useNearbyT } from '@/components/nearby/NearbyI18n'
import ReportSpotSheet from './ReportSpotSheet'
import { useSpotSwitch } from './useSpotSwitch'

/**
 * Report a spot from a map: hand `onSpotPress` to NearbyMap (press and hold,
 * or right-click), put `button` over the map, and render `sheet`. The
 * button is the way in people can see ("Report a spot"); it opens the sheet
 * at `start` (the page's place), where they move the pin to the spot. While
 * the switch is off, onSpotPress and button are undefined and null, and the
 * map's gesture does nothing.
 */
export function useSpotPress(surface: 'web_map' = 'web_map', start?: { lat: number; lng: number } | null): {
  onSpotPress: ((p: { lat: number; lng: number }) => void) | undefined
  button: ReactNode
  sheet: ReactNode
} {
  const on = useSpotSwitch()
  const tr = useNearbyT()
  const [at, setAt] = useState<{ lat: number; lng: number } | null>(null)
  const press = useCallback((p: { lat: number; lng: number }) => {
    posthog.capture('spot_map_pressed', { surface })
    setAt(p)
  }, [surface])
  const close = useCallback(() => setAt(null), [])
  const canOpen = on && !!start && Number.isFinite(start.lat) && Number.isFinite(start.lng)
  return {
    onSpotPress: on ? press : undefined,
    button: canOpen ? (
      <button
        type="button"
        onClick={() => {
          posthog.capture('spot_button_tapped', { surface })
          setAt({ lat: start!.lat, lng: start!.lng })
        }}
        aria-haspopup="dialog"
        title={tr('spot.open_hint')}
        className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-(--nb-line-mid) bg-(--nb-bg)/90 px-3.5 text-[0.8125rem] font-semibold text-(--nb-ink) shadow-[0_1px_4px_rgba(0,0,0,0.25)] backdrop-blur transition-colors hover:bg-(--nb-panel-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--nb-accent)"
      >
        <MapPin size={16} weight="bold" aria-hidden />
        {tr('spot.open_button')}
      </button>
    ) : null,
    sheet: on ? (
      <ReportSpotSheet surface={surface} open={!!at} spot={at ?? { lat: 0, lng: 0 }} onClose={close} />
    ) : null,
  }
}
