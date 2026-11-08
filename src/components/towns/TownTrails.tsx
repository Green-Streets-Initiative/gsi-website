import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { SectionHeading, ArrowLink } from '@/components/org/Section'
import type { TownTrail } from '@/lib/trails/town'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { townsStrings } from '@/lib/site-strings/towns'

function miles(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)
}

/**
 * Trails in and near a town (2026-11-04): each as a card with its own line
 * drawn small, its length, and a closure flag, linking to its trail page.
 */
export default function TownTrails({ trails, townName, locale = 'en' }: { trails: TownTrail[]; townName: string; locale?: SiteLocale }) {
  const tr = translator(townsStrings, locale)
  return (
    <div>
      <SectionHeading
        title={tr('tr.title', { town: townName })}
        lede={tr('tr.lede')}
        aside={<ArrowLink href={withLang('/trails', locale)}>{tr('tr.all')}</ArrowLink>}
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trails.map((t) => (
          <li key={t.id} className="min-w-0">
            <Link
              href={withLang(`/trails/${t.id}`, locale)}
              className="group flex min-h-[96px] items-center gap-4 rounded-[16px] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] transition-shadow hover:shadow-[0_4px_14px_rgba(25,26,46,0.08),0_0_0_1px_rgba(25,26,46,0.08)]"
            >
              <span className="flex h-[72px] w-[96px] shrink-0 items-center justify-center rounded-[10px] bg-cream">
                {t.path ? (
                  <svg viewBox="0 0 120 72" className="h-[64px] w-[88px]" aria-hidden>
                    <path d={t.path} fill="none" stroke="#2D6A4F" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold leading-snug text-navy group-hover:underline group-hover:underline-offset-4">{t.name}</span>
                {t.from && t.to && <span className="mt-0.5 line-clamp-2 block text-[0.875rem] leading-snug text-ink-soft">{tr('tr.from_to', { from: t.from, to: t.to })}</span>}
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  {t.miles ? (
                    <span className="rounded-full bg-cream px-2.5 py-0.5 text-[0.8125rem] font-semibold tabular-nums text-navy">{tr('unit.mi', { n: miles(t.miles) })}</span>
                  ) : null}
                  {t.closed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF6F0] px-2.5 py-0.5 text-[0.8125rem] font-semibold text-[#9A3412]">
                      <TriangleAlert size={12} aria-hidden /> {tr('tr.closed')}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
