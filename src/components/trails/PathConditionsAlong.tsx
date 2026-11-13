'use client'

import { useEffect, useMemo, useState } from 'react'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { trailStrings } from '@/lib/site-strings/trails'
import { fetchPathsAlong, pathLine, placeName, type PathAlong } from '@/lib/trails/conditionsAlong'

/*
 * "Paths on this route": how the trails and protected bike lanes on a route
 * are today, one line each ("Minuteman Bikeway: Icy patches between
 * Arlington Center and Lexington Center, 7:40 AM"), from the last day's
 * reports or the last three days' snow (Shift 01784). Nothing at all when
 * no path on the route has anything to say, which is most days.
 *
 * Paints from the Nearby colour tokens; tone="light" brings the light set
 * for pages outside Nearby, as RouteNotes does.
 */

type Pt = { lat: number; lng: number }

export function siteLocaleOf(l: string): SiteLocale {
  return l === 'es' || l === 'pt-BR' || l === 'zh-Hans' ? l : 'en'
}

export function usePathsAlong(points: Pt[] | null | undefined, nearM?: number): PathAlong[] {
  const [result, setResult] = useState<{ key: string; rows: PathAlong[] }>({ key: '', rows: [] })
  const pts = useMemo(() => (points ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)), [points])
  // One fetch per line: keyed on its ends and length.
  const key = pts.length === 0 ? '' : `${nearM ?? '-'}:${pts.length}:${pts[0].lat.toFixed(5)},${pts[0].lng.toFixed(5)}:${pts[pts.length - 1].lat.toFixed(5)},${pts[pts.length - 1].lng.toFixed(5)}`
  useEffect(() => {
    if (!key) return
    let live = true
    void fetchPathsAlong(pts, nearM).then((rows) => { if (live) setResult({ key, rows }) })
    return () => { live = false }
    // pts is keyed by its ends and length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return result.key === key ? result.rows : []
}

export function PathLines({ rows, locale = 'en', showName = true }: { rows: PathAlong[]; locale?: SiteLocale; showName?: boolean }) {
  const now = new Date()
  return (
    <ul className="m-0 list-none p-0">
      {rows.map((p) => {
        const { text, color } = pathLine(p, now, locale)
        if (!text) return null
        return (
          <li key={p.place_id} className="flex items-start gap-2 py-1 text-[0.875rem] leading-snug text-(--nb-ink-80)">
            <i className="mt-[5px] inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            <span>
              {showName && <span className="font-semibold text-(--nb-ink)">{placeName(p, locale)}: </span>}
              {text}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default function PathConditionsAlong({
  points,
  locale = 'en',
  tone,
  className = '',
}: {
  /** The route, in the order it's ridden or walked. */
  points: Pt[] | null | undefined
  locale?: SiteLocale
  tone?: 'light'
  className?: string
}) {
  const rows = usePathsAlong(points)
  if (rows.length === 0) return null
  const tr = translator(trailStrings, locale)
  return (
    <section
      aria-label={tr('along.title')}
      className={`${tone === 'light' ? 'nearby-tone-light ' : ''}mt-3 rounded-xl bg-(--nb-panel) px-3.5 py-3 ${className}`}
    >
      <h3 className="text-[0.875rem] font-bold text-(--nb-ink-80)">{tr('along.title')}</h3>
      <div className="mt-1">
        <PathLines rows={rows} locale={locale} />
      </div>
    </section>
  )
}
