'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Which surface the /nearby tree is painting on. The components take their
 * colors from the `--nb-*` variables (globals.css: `.nearby-tone` is the
 * app-dark original, `.nearby-tone-light` the site's cream system); this
 * context carries the same choice to the one place CSS can't reach — the
 * MapLibre basemap style and its line casings.
 */
export type NearbyTone = 'dark' | 'light'

const Ctx = createContext<NearbyTone>('dark')

export function NearbyToneProvider({ tone, children }: { tone: NearbyTone; children: ReactNode }) {
  return <Ctx.Provider value={tone}>{children}</Ctx.Provider>
}

export const useNearbyTone = () => useContext(Ctx)

export const BASEMAP_STYLE: Record<NearbyTone, string> = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
}

/** Casing drawn under corridor lines so they read on the basemap. */
export const CORRIDOR_CASING: Record<NearbyTone, string> = { dark: '#191A2E', light: '#ffffff' }
