import type { Metadata } from 'next'

/**
 * Single source of truth for the canonical site origin.
 *
 * Everything the crawler sees — canonical tags, OpenGraph `url`, sitemap
 * entries, robots — must agree on ONE host or search engines split ranking
 * signals between duplicates. We standardize on the `www` apex that
 * `metadataBase` already uses; apex (`gogreenstreets.org`) 308-redirects here.
 *
 * Import this instead of re-declaring the string. `sitemap.ts` and `robots.ts`
 * both used to keep their own copies.
 */
export const SITE_URL = 'https://www.gogreenstreets.org'
export const SITE_NAME = 'Green Streets Initiative'

interface PageMetaInput {
  /**
   * The full <title>, including the "— Green Streets Initiative" suffix.
   * This codebase's convention is that each page writes its own complete
   * title (there is deliberately no root `title.template`, because ~40 pages
   * already bake the org name in and a template would double the suffix).
   */
  title: string
  description: string
  /** Absolute path beginning with `/`, e.g. `/guides/winter-biking`. */
  path: string
  /** Optional share image (absolute path or full URL). */
  ogImage?: string
}

/**
 * Build a Metadata object with a correct per-page canonical, OpenGraph, and
 * Twitter card. Use for any new page or any `'use client'` page that needs
 * metadata via a sibling `layout.tsx`.
 */
export function pageMetadata({ title, description, path, ogImage }: PageMetaInput): Metadata {
  const url = `${SITE_URL}${path}`
  const images = ogImage
    ? [{ url: ogImage, width: 1200, height: 630, alt: title }]
    : undefined

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'en_US',
      type: 'website',
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}
