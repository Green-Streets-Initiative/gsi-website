'use client'

import { WayfindingEvent, Locale } from '@/lib/wayfinding/types'
import { t } from '@/lib/wayfinding/i18n'
import LanguagePill from './LanguagePill'

interface Props {
  event: WayfindingEvent
  locale: Locale
  displayDate: string
}

function formatDate(dateStr: string, locale: Locale): string {
  const date = new Date(dateStr + 'T00:00:00')
  const loc = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US'
  return date.toLocaleDateString(loc, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function EventHeader({ event, locale, displayDate }: Props) {
  const dateLabel = formatDate(displayDate, locale)
  const timeLabel = event.time_start && event.time_end
    ? `${formatTime(event.time_start)}–${formatTime(event.time_end)}`
    : ''

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, url })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between" style={{ height: '64px' }}>
      <div className="min-w-0">
        {event.eyebrow && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            {event.eyebrow}
          </div>
        )}
        <h1
          className="text-xl font-bold leading-tight truncate"
          style={{ color: 'var(--accent)', fontFamily: 'var(--font-bricolage)' }}
        >
          {event.name}
        </h1>
        <div className="text-xs text-gray-500">
          {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <LanguagePill event={event} locale={locale} />
        <button
          onClick={handleShare}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label={t(locale, 'share')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      </div>
    </header>
  )
}
