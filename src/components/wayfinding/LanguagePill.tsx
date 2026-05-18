'use client'

import { useRouter, usePathname } from 'next/navigation'
import { WayfindingEvent, Locale } from '@/lib/wayfinding/types'

interface Props {
  event: WayfindingEvent
  locale: Locale
  variant?: 'light' | 'dark' | 'accent'
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

  const bgClass = variant === 'dark' ? 'bg-white/15'
    : variant === 'accent' ? 'bg-black/10'
    : 'bg-gray-100'

  const btnClass = (loc: string) => {
    const isActive = loc === locale
    if (variant === 'dark') {
      return isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-white/75 hover:text-white'
    }
    if (variant === 'accent') {
      return isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-black/60 hover:text-black/80'
    }
    return isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
  }

  return (
    <div className={`inline-flex items-center rounded-full p-0.5 text-xs font-medium ${bgClass}`}>
      {event.locales.map(loc => (
        <button
          key={loc}
          onClick={() => switchLocale(loc as Locale)}
          className={`px-2.5 py-1 rounded-full transition-colors ${btnClass(loc)}`}
        >
          {LABELS[loc as Locale] ?? loc.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
