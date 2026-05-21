'use client'

import type { BusDetourConfig, Locale } from '@/lib/wayfinding/types'
import { t } from '@/lib/wayfinding/i18n'

interface Props {
  detours: BusDetourConfig
  locale: Locale
}

export default function DetourBanner({ detours, locale }: Props) {
  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-center">
      <span className="text-sm text-blue-700 font-medium">
        {t(locale, 'banner_detour', {
          routes: detours.routes_affected.join(', '),
          time: detours.time_window,
        })}
      </span>
    </div>
  )
}
