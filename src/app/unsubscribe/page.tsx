import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import UnsubscribeForm from './UnsubscribeForm'

/**
 * gogreenstreets.org/unsubscribe: the one opt-out link for Keith's one-to-one
 * outreach (any audience) and the newsletter. The person confirms their own
 * address; /api/unsubscribe records it. Opening the page never opts anyone
 * out, so corporate link scanners are harmless.
 */

export const metadata: Metadata = {
  title: 'Stop emails | Green Streets Initiative',
  description: 'Stop emails from Green Streets Initiative.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/unsubscribe' },
}

const GSI_FONT = "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif"

export default function UnsubscribePage() {
  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <Nav variant="light" street />
      <main className="mx-auto w-full max-w-[560px] px-6 pb-20 pt-[100px] md:pt-[124px]">
        <UnsubscribeForm />
        {/* No site footer here: its newsletter sign-up reads as a contradiction
            under "Stop emails". The mailing address stays. */}
        <p className="mt-16 border-t border-navy/10 pt-6 text-[14px] leading-[1.6] text-ink-soft">
          Green Streets Initiative, 519 Somerville Ave, Ste 2, Box 103, Somerville, MA 02143
        </p>
      </main>
    </div>
  )
}
