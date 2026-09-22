'use client'

import { NEARBY_LOCALES, NEARBY_LOCALE_LABELS, type NearbyLocale } from '@/lib/nearby/i18n'
import { useNearbyLocale, useNearbySetLocale } from './NearbyI18n'

/**
 * EN / ES / PT / 中文 switcher. Flips the locale in React state immediately
 * (see NearbyI18n) and mirrors it into `?lang=` on the current URL — dropped
 * for English so shared coordinate links stay clean — preserving every other
 * param (lat/lng/label/partner). The URL write goes through
 * history.replaceState like the rest of this page's URL upkeep: no router
 * navigation, no server fetch, nothing that can leave a tap unanswered.
 */
export default function NearbyLanguagePill({ className = '' }: { className?: string }) {
  const locale = useNearbyLocale()
  const setLocale = useNearbySetLocale()

  const switchTo = (next: NearbyLocale) => {
    setLocale(next)
    try {
      const url = new URL(window.location.href)
      if (next === 'en') url.searchParams.delete('lang')
      else url.searchParams.set('lang', next)
      window.history.replaceState(window.history.state, '', url.toString())
    } catch { /* the page already switched; the URL is a courtesy */ }
  }

  return (
    <div className={`inline-flex items-center rounded-full bg-(--nb-panel-raised) p-0.5 text-[0.68rem] font-bold ${className}`}>
      {NEARBY_LOCALES.map(loc => {
        const active = loc === locale
        return (
          <button
            key={loc}
            type="button"
            onClick={() => switchTo(loc)}
            aria-pressed={active}
            className={`rounded-full px-2 py-1 transition-colors ${
              active ? 'bg-(--nb-accent-fill) text-(--nb-on-accent-fill)' : 'text-(--nb-ink-70) hover:text-(--nb-ink)'
            }`}
          >
            {NEARBY_LOCALE_LABELS[loc]}
          </button>
        )
      })}
    </div>
  )
}
