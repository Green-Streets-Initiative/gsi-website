import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import TogetherShell, { type ShellAudience, type ShellVariant } from '@/components/together/TogetherShell'
import { PHOTOS, SHARE_IMAGE } from '@/components/together/photos'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { togetherStrings } from '@/lib/site-strings/together'
import { togetherMoreStrings } from '@/lib/site-strings/together-more'

/**
 * Shift Together's page frame in the page's language: the site's own header
 * and footer (terms, privacy, the language switch), like /rides/manage, around
 * the sign-in shell. Each /together page resolves its language and renders
 * this, since a layout can't read ?lang= (translation plan, batch 5).
 * /logan passes variant 'logan' (its own sign-in words). /together?kind=guide
 * passes audience 'guide': the sign-in speaks to someone offering to go with a neighbor;
 * ?kind=newcomer passes 'newcomer' (what to know first, and a link for people who already ride).
 */
export default function TogetherFrame({ locale, variant = 'together', audience, children }: { locale: SiteLocale; variant?: ShellVariant; audience?: ShellAudience; children: ReactNode }) {
  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      {/* /logan wears the website's look (Design Lead 2026-11-20; Keith the same day: "can we address this now"): Trebuchet text
          via .street, and Overpass for the headings, which say font-display here. /together keeps the app's type for now. */}
      <main
        className={variant === 'logan' ? 'street bg-cream' : 'bg-cream'}
        style={variant === 'logan' ? ({ paddingTop: '60px', '--font-display': 'var(--font-headline)' } as CSSProperties) : { paddingTop: '60px' }}
      >
        <TogetherShell locale={locale} variant={variant} audience={audience}>{children}</TogetherShell>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}

export function togetherMetadata(locale: SiteLocale, audience?: ShellAudience): Metadata {
  const t = translator(togetherStrings, locale)
  const guide = audience === 'guide'
  const walk = audience === 'walk'
  // A shared link (the newsletter, texts, social) shows the page's own photo: two riders taking their
  // bikes on the commuter rail at Concord, cropped to 1200x630 (credited on the page; see together/photos.tsx).
  // /together/walk shows its own: people walking across Boston Common.
  const share = walk ? `Shift Together: ${translator(togetherMoreStrings, locale)('walk.title')}` : `Shift Together: ${t(guide ? 'guide.title' : 'signin.title')}`
  const description = t(walk ? 'walk_signin.meta_description' : guide ? 'guide.meta_description' : 'meta.description')
  const image = walk
    ? { url: PHOTOS.commonWalk.src, width: PHOTOS.commonWalk.width, height: PHOTOS.commonWalk.height, alt: t('walk_signin.photo_alt') }
    : { url: SHARE_IMAGE, width: 1200, height: 630, alt: t('hero.alt') }
  return {
    title: t(walk ? 'walk_signin.meta_title' : guide ? 'guide.meta_title' : 'meta.title'),
    description,
    openGraph: {
      title: share,
      description,
      url: walk ? 'https://www.gogreenstreets.org/together/walk' : 'https://www.gogreenstreets.org/together',
      siteName: 'Green Streets Initiative',
      type: 'website',
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: share, description, images: [image.url] },
  }
}
