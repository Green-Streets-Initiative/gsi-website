'use client'

import { WayfindingEvent, Locale } from '@/lib/wayfinding/types'
import { t } from '@/lib/wayfinding/i18n'

interface Props {
  event: WayfindingEvent
  locale: Locale
  displayDate: string
}

export default function RainBanner({ event, locale, displayDate }: Props) {
  const loc = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US'
  const formattedDate = new Date(displayDate + 'T00:00:00').toLocaleDateString(loc, {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  if (event.is_cancelled) {
    return (
      <div className="bg-red-50 border-b border-red-100 px-4 py-2 text-center">
        <span className="text-sm text-red-700 font-medium">
          {event.name} {t(locale, 'banner_cancelled')}
        </span>
      </div>
    )
  }

  if (event.is_rain_date) {
    return (
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-center">
        <span className="text-sm text-amber-800 font-medium">
          {event.name} — {t(locale, 'banner_rain', { date: formattedDate })}
        </span>
      </div>
    )
  }

  return null
}
