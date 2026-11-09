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
  // A shared link (the newsletter, texts, social) shows what this is and the Shift card, like /shift.
  // No photo of people biking or at a T station is in /public yet; swap one in here when there is.
  const share = `Shift Together: ${t('signin.title')}`
  const image = { url: '/og/shift-og.png', width: 1200, height: 630, alt: 'Shift by Green Streets Initiative' }
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    openGraph: {
      title: share,
      description: t('meta.description'),
      url: 'https://www.gogreenstreets.org/together',
      siteName: 'Green Streets Initiative',
      type: 'website',
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: share, description: t('meta.description'), images: [image.url] },
    // Not listed until Keith launches it (held 2026-10-27).
    robots: { index: false, follow: false },
  }
}
