'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { t, type NearbyLocale } from '@/lib/nearby/i18n'

/**
 * Locale context for the /nearby tree. NearbySnapshot resolves the locale from
 * `?lang=` (see resolveNearbyLocale) and provides it here; every nearby
 * component reads it through the `useNearbyT()` hook instead of threading a
 * `locale` prop through the deep component tree.
 */
const NearbyLocaleContext = createContext<NearbyLocale>('en')

export function NearbyI18nProvider({ locale, children }: { locale: NearbyLocale; children: ReactNode }) {
  return <NearbyLocaleContext.Provider value={locale}>{children}</NearbyLocaleContext.Provider>
}

export function useNearbyLocale(): NearbyLocale {
  return useContext(NearbyLocaleContext)
}

/** Bound translate function: `const tr = useNearbyT(); tr('lists.no_transit')`. */
export function useNearbyT() {
  const locale = useContext(NearbyLocaleContext)
  return (key: string, replacements?: Record<string, string | number | null | undefined>) =>
    t(locale, key, replacements)
}
