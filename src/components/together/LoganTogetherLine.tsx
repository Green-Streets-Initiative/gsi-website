'use client'

import posthog from 'posthog-js'
import { gaEvent } from '@/lib/ga'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { loganStrings } from '@/lib/site-strings/logan'

/**
 * One short card pointing to /logan (Going to Logan together) from the
 * college pages and /parking/logan-airport. The parent decides whether it
 * shows (loganTogetherOpen() in lib/logan-together.ts); the click is
 * logan_together_click with the placement, in PostHog and GA4.
 * Plan: Shift docs/programs/launches/logan-together/plan.md.
 * `locale`: the page's language (the parent translates `title`).
 */
export default function LoganTogetherLine({
  title,
  placement,
  page,
  locale = 'en',
}: {
  title: string
  placement: 'semester' | 'parking'
  page: string
  locale?: SiteLocale
}) {
  const t = translator(loganStrings, locale)
  const href = withLang(`/logan?from=${placement}-${page}`, locale)
  return (
    <div className="mt-8 max-w-[640px] rounded-[16px] border border-navy/10 bg-white p-5 sm:p-6">
      <p className="text-[1.125rem] font-bold leading-snug text-navy">{title}</p>
      <p className="mt-2 text-[1rem] leading-[1.6] text-navy/80">
        {t('logan.line_body')}
      </p>
      <a
        href={href}
        onClick={() => {
          const params = { placement, page }
          posthog.capture('logan_together_click', params)
          gaEvent('logan_together_click', params)
        }}
        className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-forest px-5 text-[1rem] font-bold text-white hover:opacity-90"
      >
        {t('logan.line_cta')}
      </a>
    </div>
  )
}
