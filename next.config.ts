import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Shift leaderboard shortcut
      {
        source: '/shift/leaderboard',
        destination: '/events/shift-your-summer',
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
        destination: '/programs',
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
        destination: '/programs/what-moves-us/cambridge-bike-shoppers',
        permanent: true,
      },
      {
        source: '/what-moves-mgh-ihp',
        destination: '/programs/what-moves-us/mgh-ihp',
        permanent: true,
      },
      {
        source: '/what-moves-boston-area-green-commuters',
        destination: '/programs/what-moves-us/boston-area-commuters',
        permanent: true,
      },
      {
        source: '/português-what-moves-everett-fair',
        destination: '/programs/what-moves-us/everett-transportation-fair',
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
        destination: '/programs/what-moves-us/everett-transportation-fair',
        permanent: true,
      },
      {
        source: '/what-moves-everett-transportation-celebration',
        destination: '/programs/what-moves-us/everett-transportation-fair',
        permanent: true,
      },
      {
        source: '/what-moves-everett-schools-information',
        destination: '/programs/what-moves-us/everett-schools',
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

      // Old misc pages
      {
        source: '/transportation-resources',
        destination: '/commute-calculator',
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
