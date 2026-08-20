'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { NEARBY_LOCALES, NEARBY_LOCALE_LABELS, type NearbyLocale } from '@/lib/nearby/i18n'
import { useNearbyLocale } from './NearbyI18n'

/**
 * EN / ES / PT / 中文 switcher. Sets `?lang=` on the current URL (dropping it
 * for English so shared coordinate links stay clean), preserving every other
 * param (lat/lng/label/partner). Mirrors the wayfinding LanguagePill.
 */
export default function NearbyLanguagePill({ className = '' }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useNearbyLocale()

  const switchTo = (next: NearbyLocale) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'en') params.delete('lang')
    else params.set('lang', next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className={`inline-flex items-center rounded-full bg-white/[0.08] p-0.5 text-[0.68rem] font-bold ${className}`}>
      {NEARBY_LOCALES.map(loc => {
        const active = loc === locale
        return (
          <button
            key={loc}
            onClick={() => switchTo(loc)}
            aria-pressed={active}
            className={`rounded-full px-2 py-1 transition-colors ${
              active ? 'bg-[#BAF14D] text-[#191A2E]' : 'text-white/75 hover:text-white'
            }`}
          >
            {NEARBY_LOCALE_LABELS[loc]}
          </button>
        )
      })}
    </div>
  )
}
