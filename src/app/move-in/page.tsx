import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { CONTAINER, GSI_FONT, SignHero, SignTop } from './sign'
import { PartnerSignupForm, SignupProvider } from './PartnerSignupForm'
import ResidentPreview from './ResidentPreview'

/**
 * Self-serve co-branding for New Routes outreach partners (property managers,
 * leasing and rental agents, brokers, movers): name, role and an optional
 * logo in, a co-branded /nearby?partner=<slug> link out, live immediately.
 * Rows land in `partners` as status='pending', campaign='newroutes', with the
 * visit's utm tags (signup_utm) so each signup traces to the email that sent it.
 *
 * Layout: the street sign across the top, then the form with a phone
 * beside it showing the page residents get (below the form on phones). The phone redraws
 * its partner strip from the form as they type, so the visitor sees their own
 * name or logo on the real page before they submit.
 *
 * Lives at /move-in, not /partners: that path permanently redirects to the
 * Rewards Partner page (2026-09-02) and browsers cache the redirect.
 * Distinct from /shift/rewards-partners (shops offering rewards).
 */

export const metadata: Metadata = {
  title: 'Help new residents get around from day one | Green Streets Initiative',
  description:
    'Put your logo on a free, live guide to getting around for new residents: the nearest T stops and buses with arrival times, Bluebikes docks, bike routes and what is within a short walk. Ready in about a minute.',
  alternates: { canonical: '/move-in' },
}

export default function MoveInPage() {
  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <Nav variant="light" street />

      <SignHero
        top={<SignTop strong="For property managers, leasing agents, brokers and movers" />}
        title="Help new residents get around from day one."
        lede={
          <p>
            A free page with your logo on it, ready in about a minute. It shows the nearest T stops
            and buses with arrival times, Bluebikes docks, comfortable bike routes and what&rsquo;s
            within a short walk. Share the link in move-in emails, or print it for welcome packets.
          </p>
        }
        after={
          // Who we are and what Shift is, before the offer (explain before
          // mechanics): the reader may never have heard of either.
          <p className="mt-5 max-w-[780px] text-[1.0625rem] leading-[1.6] text-navy">
            Green Streets Initiative is a Massachusetts nonprofit that has helped people walk, bike
            and take transit more since 2006. A move is a great time to start, so your page also
            invites residents to try Shift, our free app for planning and tracking those trips,
            with a $15 welcome offer.
          </p>
        }
      />

      <SignupProvider>
        <section className="bg-cream">
          <div className={`${CONTAINER} pb-20 pt-2 lg:pb-24`}>
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
              <div className="min-w-0">
                <PartnerSignupForm />
              </div>
              <ResidentPreview />
            </div>
          </div>
        </section>
      </SignupProvider>

      <Footer variant="light" />
    </div>
  )
}
