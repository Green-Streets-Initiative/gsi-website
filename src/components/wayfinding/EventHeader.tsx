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

  const logos = event.organizer_logo_url
    ? event.organizer_logo_url.split(',').map(entry => {
        const trimmed = entry.trim()
        const [imgUrl, linkUrl] = trimmed.split('|').map(s => s.trim())
        return { imgUrl, linkUrl: linkUrl || null }
      }).filter(l => l.imgUrl)
    : []

  const logoHeight = logos.length === 1 ? 'h-20' : 'h-12'

  return (
    <header className="flex-shrink-0 bg-white border-b border-gray-100">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          {event.eyebrow && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              {event.organizer_url ? (
                <a href={event.organizer_url} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">
                  {event.eyebrow}
                </a>
              ) : (
                event.eyebrow
              )}
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <h1
              className="text-xl font-bold leading-tight truncate"
              style={{ color: 'var(--accent)', fontFamily: 'var(--font-bricolage)' }}
            >
              {event.event_url ? (
                <a href={event.event_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {event.name}
                </a>
              ) : (
                event.name
              )}
            </h1>
            {event.event_url && (
              <a
                href={event.event_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Event website"
              >
                <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
                  <path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z" />
                </svg>
              </a>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {event.venue_name && <span className="font-medium">{event.venue_name} · </span>}
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
      </div>

      {logos.length > 0 && (
        <div className="px-4 pb-2 flex items-center gap-3">
          {logos.map((logo, i) =>
            logo.linkUrl ? (
              <a key={i} href={logo.linkUrl} target="_blank" rel="noopener noreferrer">
                <img src={logo.imgUrl} alt={event.organizer_name ?? ''} className={`${logoHeight} object-contain hover:opacity-80 transition-opacity`} />
              </a>
            ) : (
              <img key={i} src={logo.imgUrl} alt={event.organizer_name ?? ''} className={`${logoHeight} object-contain`} />
            )
          )}
        </div>
      )}
    </header>
  )
}
