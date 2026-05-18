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

  const hasPhoto = logos.length === 1 && event.event_photo_url
  const hasLogoNoPhoto = logos.length === 1 && !event.event_photo_url

  if (hasPhoto || hasLogoNoPhoto) {
    return (
      <header className="flex-shrink-0">
        {/* Photo band — only when event has a photo */}
        {hasPhoto && (
          <div className="relative h-[168px] overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.5) 100%), url(${event.event_photo_url})`,
                backgroundPosition: 'center 40%',
              }}
            />
            {event.eyebrow && (
              <div className="absolute top-3 left-3.5 right-3.5">
                {event.organizer_url ? (
                  <a
                    href={event.organizer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/95 hover:text-white transition-colors"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}
                  >
                    {event.eyebrow} ↗
                  </a>
                ) : (
                  <span
                    className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/95"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}
                  >
                    {event.eyebrow}
                  </span>
                )}
              </div>
            )}
            {logos[0].linkUrl ? (
              <a href={logos[0].linkUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-2.5 left-3.5">
                <img
                  src={logos[0].imgUrl}
                  alt={event.organizer_name ?? event.name}
                  className="w-[156px] h-[118px] object-contain object-left"
                  style={{ filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))' }}
                />
              </a>
            ) : (
              <img
                src={logos[0].imgUrl}
                alt={event.organizer_name ?? event.name}
                className="absolute bottom-2.5 left-3.5 w-[156px] h-[118px] object-contain object-left"
                style={{ filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))' }}
              />
            )}
          </div>
        )}

        {/* Meta band — solid accent color */}
        <div className="px-3.5 py-3" style={{ backgroundColor: 'var(--accent)' }}>
          {/* No-photo variant: eyebrow + logo badge */}
          {hasLogoNoPhoto && (
            <>
              <div className="flex justify-between items-center mb-3">
                {event.eyebrow && (
                  event.organizer_url ? (
                    <a
                      href={event.organizer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/95 hover:text-white transition-colors"
                    >
                      {event.eyebrow} ↗
                    </a>
                  ) : (
                    <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/95">
                      {event.eyebrow}
                    </span>
                  )
                )}
                <button
                  onClick={handleShare}
                  className="p-2 rounded-full hover:bg-white/15 transition-colors"
                  aria-label={t(locale, 'share')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-3.5 mb-3">
                <div className="w-[72px] h-[72px] flex-shrink-0 rounded-[14px] bg-[#191A2E] flex items-center justify-center shadow-md">
                  <img
                    src={logos[0].imgUrl}
                    alt={event.organizer_name ?? event.name}
                    className="w-[92%] h-[92%] object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h1
                    className="text-[22px] font-bold leading-tight text-white"
                    style={{ fontFamily: 'var(--font-bricolage)', letterSpacing: '-0.4px' }}
                  >
                    {event.name}
                  </h1>
                  <div className="text-[13px] text-white/90 mt-1 leading-snug">
                    {event.venue_name && <>{event.venue_name}<br /></>}
                    {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Photo variant: title row */}
          {hasPhoto && (
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <h1
                  className="text-2xl font-bold leading-[1.05] text-white"
                  style={{ fontFamily: 'var(--font-bricolage)', letterSpacing: '-0.4px' }}
                >
                  {event.name}
                </h1>
                <div className="text-[13px] text-white/90 mt-1 leading-snug">
                  {event.venue_name && <span>{event.venue_name} · </span>}
                  {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
                </div>
              </div>
              <button
                onClick={handleShare}
                className="flex-shrink-0 w-9 h-9 rounded-full bg-white/[0.18] hover:bg-white/[0.28] text-white flex items-center justify-center transition-colors"
                aria-label={t(locale, 'share')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </button>
            </div>
          )}

          <LanguagePill event={event} locale={locale} variant="dark" />
        </div>
      </header>
    )
  }

  // Multi-logo or no-logo fallback — white header (Carnaval, etc.)
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

      {logos.length > 1 && (
        <div className="px-4 pb-2 flex items-center gap-3">
          {logos.map((logo, i) =>
            logo.linkUrl ? (
              <a key={i} href={logo.linkUrl} target="_blank" rel="noopener noreferrer">
                <img src={logo.imgUrl} alt={event.organizer_name ?? ''} className="h-12 object-contain hover:opacity-80 transition-opacity" />
              </a>
            ) : (
              <img key={i} src={logo.imgUrl} alt={event.organizer_name ?? ''} className="h-12 object-contain" />
            )
          )}
        </div>
      )}
    </header>
  )
}
