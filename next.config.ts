import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep the Playwright + Chromium binary out of Next.js's bundler so its
  // /var/task/node_modules/@sparticuz/chromium/bin path resolves correctly
  // on Vercel's serverless runtime. Used by /api/render-social-image.
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core', 'jspdf'],
  // Vercel's output-file tracer doesn't pick up the .br binaries because
  // nothing imports them directly — they're read at runtime. Force them
  // into the deployed lambda for the render route.
  outputFileTracingIncludes: {
    '/api/render-social-image': [
      './node_modules/@sparticuz/chromium/bin/**',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'xyqcpgwbqrhykpgpqbdi.supabase.co' },
    ],
  },
  async redirects() {
    return [
      // /app → /shift now that the app is live
      {
        source: '/app',
        destination: '/shift',
        permanent: false,
      },

      // New Routes campaign URL → neighborhood snapshot page
      {
        source: '/new-routes',
        destination: '/nearby',
        permanent: false,
      },

      // Shift Your Semester print-friendly short URLs (posters carry these)
      {
        source: '/semester',
        destination: '/shift-your-semester',
        permanent: false,
      },
      {
        source: '/semester/:school',
        destination: '/shift-your-semester/:school',
        permanent: false,
      },

      // Shift Together guide renamed 2026-11-09 (it was a draft at the old
      // slug, so this only catches links copied before the rename)
      {
        source: '/guides/showing-someone-the-way',
        destination: '/guides/going-together-the-first-time',
        permanent: true,
      },
      {
        source: '/:locale(es|pt-BR|zh-Hans)/guides/showing-someone-the-way',
        destination: '/:locale/guides/going-together-the-first-time',
        permanent: true,
      },

      // Shift leaderboard shortcut
      {
        source: '/shift/leaderboard',
        destination: '/challenges',
        permanent: true,
      },

      // Cloudflare Worker links to /shift-your-summer-rules; actual page lives under /events/
      {
        source: '/shift-your-summer-rules',
        destination: '/events/shift-your-summer/rules',
        permanent: true,
      },

      // Old Wix team/people pages
      {
        source: '/ourteam',
        destination: '/about',
        permanent: true,
      },
      // Old program pages
      {
        source: '/walkridedays',
        destination: '/programs/walk-ride-days',
        permanent: true,
      },
      {
        source: '/corporate-challenge',
        destination: '/shift/employers',
        permanent: true,
      },
      {
        source: '/become-a-sponsor',
        destination: '/contact',
        permanent: true,
      },
      {
        source: '/sponsor',
        destination: '/contact',
        permanent: false,
      },
      // Self-serve partner signup superseded by the rewards-partners page,
      // whose apply form posts to the sponsor-intake function. The old page
      // wrote to a `partners` table nobody reads, so send visitors to the live one.
      {
        source: '/partners',
        destination: '/shift/rewards-partners',
        permanent: true,
      },
      {
        source: '/volunteer',
        destination: '/get-involved',
        permanent: true,
      },
      {
        source: '/friends-of-green-streets',
        destination: '/get-involved',
        permanent: true,
      },

      // Old What Moves Us campaign pages
      {
        source: '/what-moves-frisoli',
        destination: '/programs/what-moves-us/frisoli-youth-center',
        permanent: true,
      },
      {
        source: '/what-moves-everett-schools',
        destination: '/programs/what-moves-us/everett-schools',
        permanent: true,
      },
      {
        source: '/what-moves-cambridge-shop-by-bike-ers',
        destination: '/programs/what-moves-us/cambridge-shop-by-bike',
        permanent: true,
      },
      {
        source: '/what-moves-mgh-ihp',
        destination: '/programs/what-moves-us/mgh-ihp',
        permanent: true,
      },
      {
        source: '/what-moves-boston-area-green-commuters',
        destination: '/programs/what-moves-us/boston-area-active-commuters',
        permanent: true,
      },
      // The old Wix fair pages in other languages. Their addresses carry
      // accented letters, which arrive percent-encoded, so the source must be
      // written encoded: '/português-…' never matched and 404'd (Search
      // Console, 2026-11-12).
      {
        source: '/portugu%C3%AAs-what-moves-everett-fair',
        destination: '/programs/what-moves-us/everett-community-fair',
        permanent: true,
      },
      {
        source: '/krey%C3%B3l-what-moves-everett-fair',
        destination: '/programs/what-moves-us/everett-community-fair',
        permanent: true,
      },
      {
        source: '/espa%C3%B1ol-everett-event-volunteers',
        destination: '/programs/what-moves-us/everett-community-fair',
        permanent: true,
      },
      {
        source: '/participant-voices',
        destination: '/programs/what-moves-us',
        permanent: true,
      },
      {
        source: '/what-moves-everett-community-fair',
        destination: '/programs/what-moves-us/everett-community-fair',
        permanent: true,
      },
      {
        source: '/what-moves-everett-transportation-fair-recap',
        destination: '/programs/what-moves-us/everett-community-fair',
        permanent: true,
      },
      {
        source: '/what-moves-everett-transportation-celebration',
        destination: '/programs/what-moves-us/everett-community-fair',
        permanent: true,
      },
      {
        source: '/cities-what-moves-us-program-information',
        destination: '/programs/what-moves-us',
        permanent: true,
      },
      {
        source: '/what-moves-everett-schools-information',
        destination: '/programs/what-moves-us/everett-schools',
        permanent: true,
      },
      {
        source: '/what-moves-us-program-information',
        destination: '/programs/what-moves-us',
        permanent: true,
      },
      // "What Moves Women Who E-Bike", a What Moves Us story page on Wix.
      {
        source: '/womene-bike',
        destination: '/programs/what-moves-us',
        permanent: true,
      },
      {
        source: '/become-a-partner-or-sponsor',
        destination: '/contact',
        permanent: true,
      },
      {
        source: '/contact-us',
        destination: '/contact',
        permanent: true,
      },
      {
        source: '/shift/cities',
        destination: '/shift/towns',
        permanent: true,
      },

      // Old blog/post pages — catch-all to programs
      {
        source: '/blog',
        destination: '/programs',
        permanent: true,
      },
      {
        source: '/post/:slug*',
        destination: '/programs',
        permanent: true,
      },
      // Wix blog category lists
      {
        source: '/category/categories/monthly-updates-and-newsletters',
        destination: '/newsletter',
        permanent: true,
      },
      {
        source: '/category/:slug*',
        destination: '/programs',
        permanent: true,
      },

      // Old misc pages
      {
        source: '/transportation-resources',
        destination: '/commute-advisor',
        permanent: true,
      },
      {
        source: '/commute-calculator',
        destination: '/commute-advisor',
        permanent: true,
      },
      {
        source: '/green-streets-data',
        destination: '/programs/what-moves-us',
        permanent: true,
      },
      {
        source: '/bostoncollege',
        destination: '/programs/what-moves-us',
        permanent: true,
      },
      {
        source: '/gogreenstreets',
        destination: '/',
        permanent: true,
      },
      {
        source: '/2025-new-ed-info',
        destination: '/about',
        permanent: true,
      },
      {
        source: '/information-use',
        destination: '/privacy',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
