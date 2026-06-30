'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Bike, Zap, Package, Footprints, Bus, Megaphone, PartyPopper,
  MapPin, Calendar, GraduationCap, Wrench, Flag, Users,
  ChevronLeft, Bookmark, Share2, Globe, ExternalLink, Ticket,
  Clock, Mail,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import {
  type CommunityEvent, getTypeMeta, getTagMeta, formatTime, dateLong, parseEventDate,
  buildIcs, gcalUrl, directionsUrl,
} from '@/lib/events'

const EventMap = dynamic(() => import('./EventMap'), { ssr: false })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Bike, Zap, Package, Footprints, Bus, Megaphone, PartyPopper,
  MapPin, Calendar, GraduationCap, Wrench, Flag, Users,
}

interface EventDetailProps {
  event: CommunityEvent
}

export default function EventDetail({ event }: EventDetailProps) {
  const meta = getTypeMeta(event.event_type)
  const Icon = ICON_MAP[meta.icon] ?? Calendar
  const evDate = parseEventDate(event.event_date)
  const hasMap = !!(event.location_lat && event.location_lng)
  const hasLeftColumn = !!(event.image_url || hasMap)

  const [saved, setSaved] = useState(false)
  const [calMenuOpen, setCalMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url })
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      showToast('Link copied to clipboard')
    }
  }

  const handleDownloadIcs = () => {
    const ics = buildIcs(event)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()}.ics`
    a.click()
    URL.revokeObjectURL(url)
    setCalMenuOpen(false)
    showToast('Calendar file downloaded')
  }

  const timeStr = event.event_time ? formatTime(event.event_time) : null
  const endTimeStr = event.event_end_time ? formatTime(event.event_end_time) : null
  const location = [event.location_name, event.location_address].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-navy px-8 pb-24 pt-8">
      <div className="mx-auto max-w-[1040px]">
        {/* Back button */}
        <Link href="/events" className="mb-8 inline-flex items-center gap-1 text-[13px] font-medium text-white/60 transition-colors hover:text-white">
          <ChevronLeft size={16} />
          All events
        </Link>

        <div className={`grid gap-10 ${hasLeftColumn ? 'lg:grid-cols-2' : ''}`}>
          {/* ---- LEFT COLUMN ---- */}
          {hasLeftColumn && (
            <div>
              {event.image_url && (
                <div className="mb-6 aspect-[4/5] overflow-hidden rounded-2xl border border-white/[0.07]">
                  <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
                </div>
              )}

              {hasMap && (
                <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-card">
                  <div className={event.image_url ? 'h-48' : 'h-72'}>
                    <EventMap lat={event.location_lat!} lng={event.location_lng!} label={event.location_name} />
                  </div>
                  <div className="p-4">
                    <p className="text-[14px] font-semibold text-white">{event.location_name}</p>
                    {event.location_address && (
                      <p className="mt-0.5 text-[13px] text-white/55">{event.location_address}</p>
                    )}
                    <a
                      href={directionsUrl(event)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] px-4 py-2 text-[13px] font-medium text-white/75 transition-colors hover:bg-white/[0.06]"
                    >
                      <MapPin size={14} />
                      Directions
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- RIGHT COLUMN ---- */}
          <div>
            {/* Type + date header */}
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[13px]"
                style={{ backgroundColor: meta.color + '29' }}
              >
                <Icon size={22} style={{ color: meta.color }} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: meta.color }}>
                  {meta.label}
                </p>
                <p className="text-[13px] text-white/60">
                  {dateLong(evDate)}
                  {timeStr && ` · ${timeStr}`}
                  {endTimeStr && ` – ${endTimeStr}`}
                </p>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => { setSaved(!saved); showToast(saved ? 'Removed from saved' : 'Event saved') }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.14] transition-colors hover:border-white/[0.25]"
                  aria-label={saved ? 'Remove bookmark' : 'Save event'}
                >
                  <Bookmark size={18} className={saved ? 'fill-lime text-lime' : 'text-white/60'} />
                </button>
              </div>
            </div>

            {/* Title */}
            <h1 className="mb-4 font-display text-[clamp(28px,3.5vw,40px)] font-extrabold leading-[1.1] tracking-tight text-white">
              {event.title}
            </h1>

            {/* Tags */}
            {event.tags.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-1.5">
                {event.tags.map(tag => {
                  const tm = getTagMeta(tag)
                  return (
                    <span
                      key={tag}
                      className="inline-block rounded-full px-3 py-1 text-[12px] font-semibold"
                      style={{ color: tm.color, backgroundColor: tm.bg }}
                    >
                      {tm.label}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Action row */}
            <div className="mb-8 flex flex-wrap gap-2">
              {(event.location_lat && event.location_lng) && (
                <a
                  href={directionsUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] bg-lime px-5 py-2.5 text-[13px] font-bold text-navy transition-opacity hover:opacity-85"
                >
                  <MapPin size={15} />
                  Getting there
                </a>
              )}

              {/* Save to calendar */}
              <div className="relative">
                <button
                  onClick={() => setCalMenuOpen(!calMenuOpen)}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-white/[0.18] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.06]"
                >
                  <Calendar size={15} />
                  Save to calendar
                </button>
                {calMenuOpen && (
                  <div className="absolute left-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-white/[0.14] bg-[#2E2F45] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                    <a
                      href={gcalUrl(event)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-white/80 transition-colors hover:bg-white/[0.06]"
                      onClick={() => setCalMenuOpen(false)}
                    >
                      <Globe size={14} />
                      Google Calendar
                    </a>
                    <button
                      onClick={handleDownloadIcs}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-white/80 transition-colors hover:bg-white/[0.06]"
                    >
                      <Calendar size={14} />
                      Apple Calendar (.ics)
                    </button>
                    <button
                      onClick={handleDownloadIcs}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-white/80 transition-colors hover:bg-white/[0.06]"
                    >
                      <ExternalLink size={14} />
                      Download .ics file
                    </button>
                  </div>
                )}
              </div>

              {/* Share */}
              <button
                onClick={handleShare}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/[0.18] text-white/60 transition-colors hover:bg-white/[0.06]"
                aria-label="Share"
              >
                <Share2 size={16} />
              </button>
            </div>

            {/* Description */}
            {event.body && (
              <div className="mb-8 text-[15px] leading-relaxed text-white/75 whitespace-pre-line">
                {event.body}
              </div>
            )}

            {/* Meta list */}
            <div className="mb-8 flex flex-col gap-3 border-t border-white/[0.07] pt-6">
              <div className="flex gap-3">
                <Calendar size={16} className="mt-0.5 shrink-0 text-white/40" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Date</p>
                  <p className="text-[14px] text-white/80">{dateLong(evDate)}</p>
                </div>
              </div>
              {timeStr && (
                <div className="flex gap-3">
                  <Clock size={16} className="mt-0.5 shrink-0 text-white/40" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Time</p>
                    <p className="text-[14px] text-white/80">
                      {timeStr}{endTimeStr && ` – ${endTimeStr}`}
                    </p>
                  </div>
                </div>
              )}
              {event.location_name && event.location_name !== 'See event page for details' && (
                <div className="flex gap-3">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-white/40" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Where</p>
                    <p className="text-[14px] text-white/80">{location}</p>
                  </div>
                </div>
              )}
              {event.organizer_name && (
                <div className="flex gap-3">
                  <Users size={16} className="mt-0.5 shrink-0 text-white/40" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Organizer</p>
                    {event.organizer_url ? (
                      <a href={event.organizer_url} target="_blank" rel="noopener noreferrer" className="text-[14px] text-lime hover:underline">
                        {event.organizer_name} <ExternalLink size={12} className="inline" />
                      </a>
                    ) : (
                      <p className="text-[14px] text-white/80">{event.organizer_name}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Outbound link buttons */}
            <div className="flex flex-wrap gap-2">
              {event.event_url && (
                <a
                  href={event.event_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] border border-white/[0.18] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.06]"
                >
                  <Globe size={15} />
                  Event info
                </a>
              )}
              {event.registration_url && (
                <a
                  href={event.registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] bg-blue px-5 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-85"
                >
                  <Ticket size={15} />
                  Register
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/[0.14] bg-[#2E2F45] px-5 py-3 text-[13px] font-medium text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{ animation: 'animate-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
