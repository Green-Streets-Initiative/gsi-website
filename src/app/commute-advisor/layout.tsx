import { Source_Sans_3 } from 'next/font/google'
import type { Metadata } from 'next'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
})

// This page already ranks for the questions people actually type — Search
// Console, Jul 4 – Aug 1: "how long does it take to walk a 20 minute drive",
// "2 minute drive to walk", "15 minute drive to walk", "0.5 miles walking
// time", and a dozen more variants, several on page one and one at position
// 1.0. It earned ~46 impressions from that cluster and **zero clicks**.
//
// The ranking is fine; the listing was the problem. Someone asking how long a
// drive takes on foot met a headline about finding a better way to get to work
// and a subtitle about personalized recommendations, neither of which reads as
// an answer to their question, so they picked another result. The title now
// mirrors the question, and the description promises the specific number they
// came for. "Commute Advisor" stays in the title to keep the weaker
// "commute map" / "plan my commute" cluster, which the page also surfaces for.
//
// The claim is honest: the tool reports each mode as "X min vs. Y min driving".
const TITLE = 'How long is that drive on foot or by bike? — Commute Advisor'
const DESCRIPTION =
  'See how many minutes your drive would take walking, biking, or on transit — and what each option costs you per day and per year. Free, no sign-up.'
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
        // Describes the (unchanged) share image rather than echoing TITLE, so
        // it stays true whatever the headline copy does next.
        alt: 'Commute Advisor from Green Streets Initiative',
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
