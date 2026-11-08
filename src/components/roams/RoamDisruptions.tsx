'use client'

import { useState } from 'react'
import { TriangleAlert, ExternalLink, ChevronDown } from 'lucide-react'
import { gaEvent } from '@/lib/ga'
import type { RoamDisruption } from '@/lib/roams/queries'
import DetourPanel from './DetourPanel'
import { siteDate, translator, type SiteLocale, type T } from '@/lib/site-i18n'
import { roamStrings, type RoamKey } from '@/lib/site-strings/roams'

/** "Oct 19, 2026" from a YYYY-MM-DD date. */
function day(d: string, locale: SiteLocale): string {
  return siteDate(locale, `${d}T12:00:00-04:00`, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

/**
 * Path closures near the top of the roam page, the way MBTA disruptions sit
 * at the top of Around You. Compact until tapped (Keith 2026-10-20, same as
 * the app): what is closed, in one line; "Details and detour" opens the
 * summary, the detour by direction and the source with the date it was
 * last checked. An "access" closure is on a path that connects to the roam,
 * so it says who it affects ("Coming from Davis Square?", or "If you come in
 * on Linear Park" with no place stored) and that the route itself is open
 * (Keith 2026-10-29: "It may or may not be 'on the way here' depending on
 * where someone is coming from").
 */
function who(d: RoamDisruption, subject: 'route' | 'trail', t: T<RoamKey>): string {
  if (d.affects === 'route') return subject === 'trail' ? t('dis.closed_trail') : t('dis.closed_route')
  return d.from_label ? t('dis.coming_from', { place: d.from_label }) : t('dis.if_on', { trail: d.trail_name })
}

function Notice({ d, subject, locale }: { d: RoamDisruption; subject: 'route' | 'trail'; locale: SiteLocale }) {
  const t = translator(roamStrings, locale)
  const [open, setOpen] = useState(false)
  const hasDetour = !!(d.detours && d.detours.length > 0)
  return (
    <section
      aria-label={d.affects === 'route' ? t(subject === 'trail' ? 'dis.aria_trail' : 'dis.aria_route') : t(subject === 'trail' ? 'dis.aria_access_trail' : 'dis.aria_access_route', { trail: d.trail_name })}
      className="rounded-[14px] border border-[#C2410C]/25 bg-[#FFF6F0] px-4 py-3 sm:px-5"
    >
      <div className="flex gap-3">
        <TriangleAlert size={18} className="mt-[3px] shrink-0 text-[#B4410C]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold text-[#9A3412]">
            {who(d, subject, t)}
          </p>
          <h2 className="text-[1rem] font-semibold leading-snug text-navy">{d.title}</h2>
          {d.affects === 'access' ? <p className="text-[0.9375rem] leading-snug text-ink-soft">{t(subject === 'trail' ? 'dis.open_trail' : 'dis.open_route')}</p> : null}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`notice-${d.id}`}
            onClick={() => {
              if (!open) gaEvent('roam_detour_opened', { disruption: d.id })
              setOpen((o) => !o)
            }}
            className="mt-1 inline-flex min-h-[36px] items-center gap-1 text-[0.9375rem] font-semibold text-[#9A3412] underline decoration-[#9A3412]/40 underline-offset-4 hover:decoration-[#9A3412]"
          >
            {open ? t('dis.hide') : hasDetour ? t('dis.details_detour') : t('dis.details')}
            <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
      {open && (
            <div id={`notice-${d.id}`} className="pb-1 sm:pl-[30px]">
              <p className="mt-1 max-w-[68ch] text-[0.9375rem] leading-relaxed text-ink-soft">
                {d.summary}
                {d.ends_note ? ` ${d.ends_note}` : ''}
              </p>
              {hasDetour ? <DetourPanel id={d.id} detours={d.detours!} closed={d.closed_geometry} bare locale={locale} /> : null}
              <p className="mt-3 text-[0.8125rem] text-ink-soft">
                <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest underline underline-offset-4">
                  {d.source_name} <ExternalLink size={12} aria-hidden />
                </a>
                {' · '}{t('dis.checked', { date: day(d.checked_on, locale) })}
              </p>
            </div>
      )}
    </section>
  )
}

/** subject: 'trail' on the /trails pages; roam pages keep 'route'. */
export default function RoamDisruptions({ items, subject = 'route', locale = 'en' }: { items: RoamDisruption[]; subject?: 'route' | 'trail'; locale?: SiteLocale }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-3">
      {items.map((d) => (
        <Notice key={d.id} d={d} subject={subject} locale={locale} />
      ))}
    </div>
  )
}
