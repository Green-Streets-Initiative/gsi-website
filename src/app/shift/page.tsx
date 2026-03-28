'use client'

import { useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export default function ShiftPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(186,241,77,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(186,241,77,0.03) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <div className="absolute -right-[10%] top-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(186,241,77,0.07)_0%,transparent_70%)]" />
          </div>

          <div className="relative mx-auto max-w-[1120px] text-center">
            <div className="mb-5 inline-flex items-center gap-2">
              <svg viewBox="0 0 36 28" width="24" height="15" className="shrink-0">
                <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
                <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
              </svg>
              <span className="font-display text-sm font-bold tracking-wider text-white uppercase">The Shift App</span>
            </div>

            <h1 className="mx-auto mb-6 max-w-[640px] font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Move better.<br />Every trip.
            </h1>

            <p className="mx-auto mb-10 max-w-[580px] text-lg leading-[1.7] text-white">
              The Shift app detects your walks, bike rides, and transit trips automatically — no tapping, no logging, no thinking about it. Your commute earns you real rewards while you move.
            </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a href="#" className="inline-flex items-center gap-2 rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#191A2E"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                Download for iOS
              </a>
              <a href="#" className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.832l2.46 1.42c.55.32.55 1.09 0 1.41l-2.46 1.42-2.534-2.534 2.534-2.534v.818zm-3.906-2.54L4.864 3.378l10.928 6.328-2.302 2.302.303.327z"/></svg>
                Download for Android
              </a>
            </div>

            <div className="mt-6">
              <Link href="/commute-calculator" className="text-sm font-semibold text-[#BAF14D]">
                See your savings →
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · HOW IT WORKS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#F4F8EE] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7DB82E]">How it works</div>
            <h2 className="mb-14 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-[#191A2E]">
              Three steps. Zero effort.
            </h2>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Step 1 */}
              <div className="rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-white p-8">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D]/15 font-display text-sm font-extrabold text-[#7DB82E]">1</div>
                <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-[#191A2E]">It just works</h3>
                <p className="text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
                  Grant location and motion access once. Shift detects your walks, bike rides, and transit trips in the background. No tapping required — your streak keeps going even if you never open the app.
                </p>
              </div>

              {/* Step 2 */}
              <div className="rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-white p-8">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D]/15 font-display text-sm font-extrabold text-[#7DB82E]">2</div>
                <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-[#191A2E]">Your commute, working for you</h3>
                <p className="text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
                  Every active trip earns points, automatically. Your tier multiplies your earnings — the more you shift, the more you earn. Redeem for real rewards from local businesses.
                </p>
              </div>

              {/* Step 3 */}
              <div className="rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-white p-8">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D]/15 font-display text-sm font-extrabold text-[#7DB82E]">3</div>
                <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-[#191A2E]">See what you&apos;re gaining</h3>
                <p className="text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
                  Time saved. Money kept. Health earned. Open the app to check in, or don&apos;t. Everything tracks whether you&apos;re watching or not.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · BUILT FOR COMMUTERS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">Built for commuters</div>
            <h2 className="mb-14 max-w-[560px] font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              For the commuter who suspects there&apos;s a better way.
            </h2>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <div className="mb-4 text-2xl">💰</div>
                <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">Save real money</h3>
                <p className="text-[0.9375rem] leading-[1.6] text-white">
                  The average Boston commuter spends $8k+ on their car each year. Active trips put that money back — and earn you rewards on top.
                </p>
              </div>

              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <div className="mb-4 text-2xl">🧠</div>
                <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">Feel better</h3>
                <p className="text-[0.9375rem] leading-[1.6] text-white">
                  Active commuters report better sleep, sharper focus, and lower stress. Built into your day, not added to it.
                </p>
              </div>

              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <div className="mb-4 text-2xl">🏆</div>
                <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">Your commute, working for you</h3>
                <p className="text-[0.9375rem] leading-[1.6] text-white">
                  Every active trip earns points redeemable for real rewards from local businesses. The more you shift, the more you earn.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · FOR EMPLOYERS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#2966E5]">For employers</div>
            <h2 className="mb-4 max-w-[640px] font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Your team wants to come in. The commute is what stops them.
            </h2>
            <p className="mb-12 max-w-[640px] text-[1.0625rem] leading-[1.65] text-white">
              Boston has some of the worst traffic in the country. Shift helps your employees find a way in that they actually enjoy — so the commute stops being a reason to stay home.
            </p>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-8">
                <h3 className="mb-5 font-display text-base font-bold text-white">What employers get</h3>
                <ul className="flex flex-col gap-3.5">
                  {[
                    'Higher in-office attendance — employees who enjoy their commute come in more',
                    'A genuine wellness benefit with real participation data',
                    'ESG and sustainability reporting — verified active trip data by mode',
                    'Real commute data — mode share, participation trends, and patterns over time',
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3 text-[0.9375rem] leading-[1.6] text-white">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2966E5]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-8">
                <h3 className="mb-5 font-display text-base font-bold text-white">What employees get</h3>
                <ul className="flex flex-col gap-3.5">
                  {[
                    'A way in that\'s cheaper, faster in traffic, and better for their health',
                    'Real rewards earned automatically from every active trip',
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3 text-[0.9375rem] leading-[1.6] text-white">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#BAF14D]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10">
              <Link
                href="/contact?inquiry=employer"
                className="inline-block rounded-full bg-[#2966E5] px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-85"
              >
                Partner with us →
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · FOR SCHOOLS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#1E2038] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#EDB93C]">For schools</div>
            <h2 className="mb-4 max-w-[640px] font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              The simplest school wellness program you&apos;ve ever run.
            </h2>
            <p className="mb-12 max-w-[640px] text-[1.0625rem] leading-[1.65] text-white">
              No student apps. No accounts. No data on kids. Just a wall chart, some stickers, and one email from the teacher.
            </p>

            <div className="mb-12 grid gap-6 md:grid-cols-3">
              <div className="rounded-[18px] border border-[rgba(237,185,60,0.15)] bg-[rgba(237,185,60,0.05)] p-8">
                <div className="mb-3 font-display text-sm font-bold text-[#EDB93C]">Under 5 minutes a week for teachers</div>
                <p className="text-[0.9375rem] leading-[1.6] text-white">
                  Post the chart Monday, photograph it Friday, Shift handles everything else.
                </p>
              </div>

              <div className="rounded-[18px] border border-[rgba(237,185,60,0.15)] bg-[rgba(237,185,60,0.05)] p-8">
                <div className="mb-3 font-display text-sm font-bold text-[#EDB93C]">COPPA-clean by design</div>
                <p className="text-[0.9375rem] leading-[1.6] text-white">
                  No student accounts, no student devices, no location data on minors.
                </p>
              </div>

              <div className="rounded-[18px] border border-[rgba(237,185,60,0.15)] bg-[rgba(237,185,60,0.05)] p-8">
                <div className="mb-3 font-display text-sm font-bold text-[#EDB93C]">Curriculum-aligned</div>
                <p className="text-[0.9375rem] leading-[1.6] text-white">
                  Math and science worksheets for K–2, 3–5, and 6–8 grade bands included.
                </p>
              </div>
            </div>

            <div className="mb-10 rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-8">
              <h3 className="mb-5 font-display text-base font-bold text-white">What schools get</h3>
              <ul className="flex flex-col gap-3.5">
                {[
                  'Auto-generated leaderboards at classroom, grade, and school level',
                  'Weekly impact reports for PTAs and school boards',
                  'A parent bridge — weekly email connecting families to their classroom\'s results',
                  'Piloting in Greater Boston schools in 2026',
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 text-[0.9375rem] leading-[1.6] text-white">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EDB93C]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="/contact?inquiry=school"
              className="inline-block rounded-full bg-[#EDB93C] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              Bring it to your school →
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5½ · FLAGSHIP EVENTS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">Events</div>
            <h2 className="mb-4 max-w-[640px] font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Compete. Move. Win.
            </h2>
            <p className="mb-8 max-w-[560px] text-[1.0625rem] leading-[1.65] text-white">
              Shift flagship events bring the whole city together. Track your commute, climb the leaderboard, and win real prizes.
            </p>
            <Link
              href="/events/shift-your-summer"
              className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              See the leaderboard &rarr;
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · FOR LOCAL BUSINESSES
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">For local businesses</div>
            <h2 className="mb-4 max-w-[640px] font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Join the Shift rewards network.
            </h2>
            <p className="mb-8 max-w-[560px] text-[1.0625rem] leading-[1.65] text-white">
              Offer discounts to active commuters in your neighborhood. Free to join. No POS integration required.
            </p>
            <Link
              href="/shift/rewards-partners"
              className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              Learn more &rarr;
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            7 · CLOSING CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[560px] text-center">
            <h2 className="mb-4 font-display text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Find your shift.
            </h2>
            <p className="mb-10 text-lg leading-relaxed text-white">
              Free to download. Available on iOS and Android. Join the waitlist for early access in your neighborhood.
            </p>

            {!submitted ? (
              <form
                onSubmit={e => { e.preventDefault(); if (email) setSubmitted(true) }}
                className="mx-auto flex max-w-[440px] items-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.07] pl-5 pr-1 transition-colors focus-within:border-[#BAF14D]"
              >
                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-white placeholder-white/40 outline-none"
                />
                <button
                  type="submit"
                  className="my-1 shrink-0 rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
                >
                  Join the waitlist
                </button>
              </form>
            ) : (
              <div className="mx-auto flex max-w-[440px] items-center justify-center gap-2 rounded-full border border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.08)] px-6 py-3.5">
                <span className="text-sm font-semibold text-[#BAF14D]">&#10003;</span>
                <span className="text-sm text-white">You&apos;re on the list — we&apos;ll be in touch.</span>
              </div>
            )}

            {/* App store badge placeholders */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <div className="flex h-10 items-center rounded-lg border border-white/[0.12] bg-white/[0.04] px-4">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="white" className="mr-2"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                <span className="text-xs font-semibold text-white">App Store</span>
              </div>
              <div className="flex h-10 items-center rounded-lg border border-white/[0.12] bg-white/[0.04] px-4">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="white" className="mr-2"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.832l2.46 1.42c.55.32.55 1.09 0 1.41l-2.46 1.42-2.534-2.534 2.534-2.534v.818zm-3.906-2.54L4.864 3.378l10.928 6.328-2.302 2.302.303.327z"/></svg>
                <span className="text-xs font-semibold text-white">Google Play</span>
              </div>
            </div>

            <p className="mt-6 text-sm text-white/60">
              Local business?{' '}
              <Link href="/shift/rewards-partners" className="font-semibold text-[#BAF14D] hover:underline">
                Join our rewards network &rarr;
              </Link>
            </p>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
