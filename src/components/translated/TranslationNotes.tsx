import Link from 'next/link'
import { SHARED, englishPath, type DraftLocale, type TranslatedPage } from '@/lib/translated-pages'

/**
 * The notes every translated page carries. `AiNote` is the guides' line
 * (GuideView, meta.aiNote): small, under the title. `LegalDraftBanner` is the
 * prominent box on the rules and the privacy policy: an AI translation of a
 * legal text, not yet read by a native speaker, with the English as the
 * version that counts. Both go away when a reviewer signs off (REVIEW.md).
 */

const LINK = 'font-semibold text-forest underline underline-offset-4 hover:opacity-80'

export function ReadInEnglish({ page }: { page: TranslatedPage }) {
  return (
    <Link href={englishPath(page)} hrefLang="en" lang="en" className={`${LINK} text-[15px]`}>
      Read in English
    </Link>
  )
}

export function AiNote({ locale }: { locale: DraftLocale }) {
  const s = SHARED[locale]
  return (
    <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
      {s.aiNote}{' '}
      <a href="mailto:info@gogreenstreets.org" className={LINK}>
        info@gogreenstreets.org
      </a>
      .
    </p>
  )
}

export function LegalDraftBanner({ locale, page }: { locale: DraftLocale; page: TranslatedPage }) {
  const s = SHARED[locale]
  return (
    <div role="note" className="mt-6 rounded-[12px] border-2 border-gold bg-gold/15 p-5">
      <p className="text-[1.0625rem] font-bold leading-snug text-navy">{s.legalBannerTitle}</p>
      <p className="mt-2 text-[1rem] leading-[1.6] text-navy">{s.legalBannerBody}</p>
      <p className="mt-3">
        <Link href={englishPath(page)} hrefLang="en" className={`${LINK} text-[1rem]`}>
          {s.legalBannerLink}
        </Link>
      </p>
    </div>
  )
}
