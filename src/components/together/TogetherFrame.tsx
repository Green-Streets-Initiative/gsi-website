import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import TogetherShell, { type ShellVariant } from '@/components/together/TogetherShell'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { togetherStrings } from '@/lib/site-strings/together'

/**
 * Shift Together's page frame in the page's language: the site's own header
 * and footer (terms, privacy, the language switch), like /rides/manage, around
 * the sign-in shell. Each /together page resolves its language and renders
 * this, since a layout can't read ?lang= (translation plan, batch 5).
 * /logan passes variant 'logan' (its own sign-in words).
 */
export default function TogetherFrame({ locale, variant = 'together', children }: { locale: SiteLocale; variant?: ShellVariant; children: ReactNode }) {
  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <TogetherShell locale={locale} variant={variant}>{children}</TogetherShell>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}

export function togetherMetadata(locale: SiteLocale): Metadata {
  const t = translator(togetherStrings, locale)
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    // Not listed until Keith launches it (held 2026-10-27).
    robots: { index: false, follow: false },
  }
}
