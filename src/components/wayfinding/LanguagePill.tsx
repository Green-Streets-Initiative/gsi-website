'use client'

import { useRouter, usePathname } from 'next/navigation'
import { WayfindingEvent, Locale } from '@/lib/wayfinding/types'

interface Props {
  event: WayfindingEvent
  locale: Locale
  variant?: 'light' | 'dark'
}

const LABELS: Record<Locale, string> = { en: 'EN', es: 'ES', pt: 'PT' }

export default function LanguagePill({ event, locale, variant = 'light' }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  if (event.locales.length <= 1) return null

  const switchLocale = (newLocale: Locale) => {
    const base = `/wayfinding/${event.slug}`
    const newPath = newLocale === 'en' ? base : `${base}/${newLocale}`
    router.push(newPath)
  }

  return (
    <div className={`flex items-center rounded-full p-0.5 text-xs font-medium ${
      variant === 'dark' ? 'bg-white/15' : 'bg-gray-100'
    }`}>
      {event.locales.map(loc => (
        <button
          key={loc}
          onClick={() => switchLocale(loc as Locale)}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            variant === 'dark'
              ? loc === locale
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-white/75 hover:text-white'
              : loc === locale
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {LABELS[loc as Locale] ?? loc.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
