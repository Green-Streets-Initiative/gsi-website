import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-bricolage)', 'sans-serif'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
      colors: {
        lime: '#BAF14D',
        blue: {
          DEFAULT: '#2966E5',
          shift: '#2966E5',
        },
        navy: '#191A2E',
        card: '#242538',
        gold: '#EDB93C',
        fire: '#FF8C35',
        gray: {
          shift: '#8A8DA8',
        },
      },
      letterSpacing: {
        tight: '-0.02em',
        tighter: '-0.03em',
        tightest: '-0.04em',
      },
    },
  },
  plugins: [],
}

export default config
