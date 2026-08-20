import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep private application surfaces out of the index. These are
        // authenticated portals, magic-link dashboards, and personal/utility
        // pages with no search value; the belt-and-suspenders `noindex`
        // metadata on the portal layouts covers pages already crawled.
        disallow: [
          '/admin',
          '/api',
          '/shift/employers/portal',
          '/shift/employers/login',
          '/shift/rewards-partners/dashboard',
          '/whatmovesus/dashboard',
          '/prize',
          '/record',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
