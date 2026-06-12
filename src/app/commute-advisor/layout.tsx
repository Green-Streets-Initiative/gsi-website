import { Source_Sans_3 } from 'next/font/google'
import type { Metadata } from 'next'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
})

const TITLE = 'Commute Advisor — Find a better way to get to work'
const DESCRIPTION =
  'Compare walking, biking, transit, and driving for your commute. Personalized recommendations from Green Streets Initiative.'
const OG_IMAGE = '/og/commute-advisor.png'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: 'https://www.gogreenstreets.org/commute-advisor',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://www.gogreenstreets.org/commute-advisor',
    siteName: 'Green Streets Initiative',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Commute Advisor — Find a better way to get to work',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
}

export default function CommuteAdvisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={sourceSans.variable}
      style={{ fontFamily: "'Source Sans 3', var(--font-source-sans), var(--font-sans), system-ui, sans-serif" }}
    >
      {children}
    </div>
  )
}
