'use client'

import { useRouter, usePathname } from 'next/navigation'
import { WayfindingEvent, Locale } from '@/lib/wayfinding/types'

interface Props {
  event: WayfindingEvent
  locale: Locale
}

const LABELS: Record<Locale, string> = { en: 'EN', es: 'ES', pt: 'PT' }

export default function LanguagePill({ event, locale }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  if (event.locales.length <= 1) return null

  const switchLocale = (newLocale: Locale) => {
    const base = `/wayfinding/${event.slug}`
    const newPath = newLocale === 'en' ? base : `${base}/${newLocale}`
    router.push(newPath)
  }

  return (
    <div className="flex items-center bg-gray-100 rounded-full p-0.5 text-xs font-medium">
      {event.locales.map(loc => (
        <button
          key={loc}
          onClick={() => switchLocale(loc as Locale)}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            loc === locale
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
