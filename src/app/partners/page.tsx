import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PartnerSignupForm from './PartnerSignupForm'

/**
 * Self-service co-branding for outreach partners (brokers, property
 * managers, movers): add a name + logo, get a co-branded
 * /nearby?partner=<slug> link and its print version on the spot. Rows land
 * in `partners` as status='pending'; review happens post-hoc in the admin
 * dashboard. Distinct from /events/.../partners (sponsorship intake).
 */

export const metadata: Metadata = {
  title: 'Co-brand the neighborhood snapshot | Green Streets Initiative',
  description:
    'Put your logo on the Green Streets neighborhood snapshot. Enter your name, add a logo, and get a shareable co-branded link for any Greater Boston address — in about 30 seconds.',
}

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-[#191A2E] text-white font-sans">
      <Nav />

      <section className="px-8 pt-20 pb-12">
        <div className="max-w-[840px] mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.08em] text-[#52B788] mb-4">
            For brokers, property managers &amp; movers
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] font-extrabold leading-[1.1] text-white mb-5">
            Your brand on the
            <br />
            <span className="text-[#BAF14D]">neighborhood snapshot.</span>
          </h1>
          <p className="text-[1.125rem] leading-[1.7] text-white/80 max-w-[680px]">
            The Green Streets neighborhood snapshot shows anyone moving to — or living
            in — Greater Boston how their new address connects: nearby transit and how
            often it runs, comfortable bike routes, Bluebikes docks, and how far a walk
            or ride really reaches. Set up a co-branded version and every page your
            clients open carries your logo next to ours.
          </p>
        </div>
      </section>

      <section className="px-8 pb-12">
        <div className="max-w-[840px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <HowStep n="1" title="Add your name + logo" body="Thirty seconds, no account needed." />
          <HowStep n="2" title="Get your link" body="It works immediately, for any address in Greater Boston." />
          <HowStep n="3" title="Share it" body="Listing emails, welcome packets, lobby prints, your signature." />
        </div>
      </section>

      <section className="px-8 pb-24">
        <div className="max-w-[840px] mx-auto">
          <PartnerSignupForm />
        </div>
      </section>

      <Footer />
    </div>
  )
}

function HowStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="bg-[#242538] rounded-[10px] border border-white/[0.08] p-6">
      <div className="font-display text-[1.5rem] font-extrabold text-[#BAF14D] mb-2">{n}</div>
      <div className="text-sm font-bold text-white mb-1">{title}</div>
      <p className="text-[0.8125rem] text-white/75 leading-relaxed">{body}</p>
    </div>
  )
}
