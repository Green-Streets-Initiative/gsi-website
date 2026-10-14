'use client'

import posthog from 'posthog-js'
import { FilePdf } from '@phosphor-icons/react'
import { gaEvent } from '@/lib/ga'

export type CheatSheetTranslation = {
  /** BCP 47 tag, also the event's `lang`, e.g. 'es', 'zh-Hans'. */
  lang: string
  /** The language's own name for itself, e.g. 'Español'. */
  label: string
  href: string
}

/**
 * A printable one-page PDF for a guide, free with no sign-up. The click is the
 * guide's "meaningful action" for Google Ad Grants, so it fires the GA4 event
 * `cheat_sheet_download` (with `lang`, 'en' for the main button). The PDF opens
 * in a new tab (same as the store badges) so this page stays loaded while the
 * event is sent. Translations, if any, sit on one line under the button, each
 * named in its own language.
 */
export default function CheatSheetDownload({
  href,
  sheet,
  placement,
  label,
  detail,
  translationsLabel,
  translations = [],
  className = '',
  variant = 'box',
}: {
  href: string
  /** Stable id for reporting, e.g. 't-cheat-sheet'. */
  sheet: string
  placement: string
  label: string
  detail: string
  /** Lead-in for the translations line, e.g. 'Also in'. */
  translationsLabel?: string
  translations?: CheatSheetTranslation[]
  className?: string
  /**
   * 'box' is the bordered card under the title. 'inline' is one sentence with a
   * link, for repeating the offer where a section answers a narrower question
   * (which pass, who pays less) so an ad landing mid-page still finds it.
   */
  variant?: 'box' | 'inline'
}) {
  const track = (lang: string) => {
    const props = { sheet, placement, lang }
    gaEvent('cheat_sheet_download', props)
    posthog.capture('cheat_sheet_download', props)
  }

  if (variant === 'inline') {
    return (
      <p className={`text-[0.9375rem] leading-relaxed text-ink-muted ${className}`}>
        {detail}{' '}
        <a
          href={href}
          target="_blank"
          rel="noopener"
          onClick={() => track('en')}
          className="font-semibold text-forest underline decoration-forest/40 underline-offset-4 hover:decoration-forest"
        >
          {label}
        </a>
      </p>
    )
  }

  return (
    <div className={className}>
      <a
        href={href}
        target="_blank"
        rel="noopener"
        onClick={() => track('en')}
        className="group flex items-center gap-4 rounded-[14px] border-2 border-forest bg-white px-5 py-4 no-underline transition-colors hover:bg-forest/5"
      >
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-forest text-white">
          <FilePdf size={26} weight="regular" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[1rem] font-semibold leading-snug text-forest underline decoration-forest/40 underline-offset-4 group-hover:decoration-forest">
            {label}
          </span>
          <span className="mt-0.5 block text-[0.875rem] leading-snug text-ink-muted">{detail}</span>
        </span>
      </a>
      {translations.length > 0 && (
        <p className="mt-2 px-1 text-[0.9375rem] leading-relaxed text-ink-muted">
          {translationsLabel && <span className="mr-1">{translationsLabel}:</span>}
          {translations.map((t, i) => (
            <span key={t.lang}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              <a
                href={t.href}
                hrefLang={t.lang}
                lang={t.lang}
                target="_blank"
                rel="noopener"
                onClick={() => track(t.lang)}
                className="font-semibold text-forest underline decoration-forest/40 underline-offset-4 hover:decoration-forest"
              >
                {t.label}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
