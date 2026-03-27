import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'What Moves Us — Green Streets Initiative',
  description:
    'Community storytelling that gives commuters a voice in how streets are designed. Video and audio stories in community languages.',
}

export default function WhatMovesUsPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Community storytelling
            </div>
            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              What Moves Us
            </h1>
            <p className="mb-6 max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              Video and audio stories from real commuters — in their own words and community languages. What Moves Us gives everyday people a voice in how streets are designed and transportation is planned.
            </p>
            <p className="max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              These aren&apos;t testimonials. They&apos;re the lived experience of people who move through Greater Boston every day — and their stories are shaping what comes next.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · AUDIENCE CALLOUTS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 pb-24">
          <div className="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-2">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
              <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
                For communities
              </h2>
              <p className="mb-4 text-[0.9375rem] leading-[1.6] text-white">
                Real voices from your neighborhood, in community languages. What Moves Us stories show planners and policymakers what mobility looks like on the ground — not from a spreadsheet, but from the people who live it.
              </p>
              <p className="text-[0.9375rem] leading-[1.6] text-white">
                Commission a campaign to capture the transportation stories your community needs heard.
              </p>
            </div>

            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
              <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
                For commuters
              </h2>
              <p className="mb-4 text-[0.9375rem] leading-[1.6] text-white">
                Share your story, shape your streets, and earn bonus points in Shift. Your commute experience matters — and it can change how your city moves.
              </p>
              <p className="text-[0.9375rem] leading-[1.6] text-white">
                Whether you walk, bike, ride the T, or mix it up — your perspective is part of the bigger picture.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · SHIFT CONNECTION
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8 md:p-12">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
                Powered by Shift
              </div>
              <h3 className="mb-4 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-tight text-white">
                Stories that connect to data.
              </h3>
              <p className="mb-8 max-w-[560px] text-[1.0625rem] leading-[1.65] text-white">
                What Moves Us campaigns connect to the Shift platform. Participants who share their stories can track their own trips, earn points, and see how their community moves — all in one place.
              </p>
              <Link
                href="/shift"
                className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
              >
                Learn about the Shift app &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Commission a What Moves Us campaign.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-white">
              Whether you&apos;re a municipality, transit agency, or community organization — we&apos;ll work with you to capture the stories your community needs heard.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact?inquiry=general"
                className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
              >
                Get in touch &rarr;
              </Link>
              <Link
                href="/programs"
                className="inline-block rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                All programs
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
