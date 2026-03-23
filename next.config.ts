import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/shift/leaderboard',
        destination: '/events/shift-your-summer',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
