'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { t, type NearbyLocale } from '@/lib/nearby/i18n'

/**
 * Locale context for the /nearby tree. NearbySnapshot resolves the locale from
 * `?lang=` (see resolveNearbyLocale) and provides it here; every nearby
 * component reads it through the `useNearbyT()` hook instead of threading a
 * `locale` prop through the deep component tree.
 *
 * `setLocale` is how the language pill switches: it flips this state on the
 * spot, no navigation involved. The pill used to change `?lang=` through the
 * Next router and wait for the app-router round trip to re-render the page;
 * when that navigation stalled (any pending transition, a slow or failed
 * server fetch), the tap did nothing and the pill read as dead (Keith,
 * 2026-09-22). The URL still gets `?lang=` — for shareable links — but as a
 * side effect, never as the source of truth for what is on screen.
 */
const NearbyLocaleContext = createContext<NearbyLocale>('en')
const NearbySetLocaleContext = createContext<(next: NearbyLocale) => void>(() => {})

export function NearbyI18nProvider({ locale, setLocale, children }: {
  locale: NearbyLocale
  setLocale?: (next: NearbyLocale) => void
  children: ReactNode
}) {
  return (
    <NearbyLocaleContext.Provider value={locale}>
      <NearbySetLocaleContext.Provider value={setLocale ?? (() => {})}>
        {children}
      </NearbySetLocaleContext.Provider>
    </NearbyLocaleContext.Provider>
  )
}

export function useNearbyLocale(): NearbyLocale {
  return useContext(NearbyLocaleContext)
}

export function useNearbySetLocale(): (next: NearbyLocale) => void {
  return useContext(NearbySetLocaleContext)
}

/** Bound translate function: `const tr = useNearbyT(); tr('lists.no_transit')`. */
export function useNearbyT() {
  const locale = useContext(NearbyLocaleContext)
  return (key: string, replacements?: Record<string, string | number | null | undefined>) =>
    t(locale, key, replacements)
}
