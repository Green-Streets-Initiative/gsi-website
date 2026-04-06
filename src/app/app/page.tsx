import type { Metadata } from 'next'
import Link from 'next/link'
import WaitlistEmailForm from './WaitlistEmailForm'

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''
const IS_LIVE = !!(IOS_URL && ANDROID_URL)

export const metadata: Metadata = {
  title: 'Download Shift — Earn rewards for walking, biking, and transit',
  description:
    'Shift by Green Streets Initiative rewards you for choosing active and sustainable transportation. Coming soon to iOS and Android.',
  alternates: { canonical: 'https://gogreenstreets.org/app' },
  openGraph: {
    title: 'Download Shift — Earn rewards for walking, biking, and transit',
    description:
      'Shift by Green Streets Initiative rewards you for choosing active and sustainable transportation.',
    url: 'https://gogreenstreets.org/app',
    siteName: 'Green Streets Initiative',
    locale: 'en_US',
    type: 'website',
  },
}

export default function AppDownloadPage() {
  return (
    <main className="min-h-screen bg-navy text-white">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1120px] px-8 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white/80"
        >
          &larr; gogreenstreets.org
        </Link>
      </div>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="px-8 pb-16 pt-12 text-center">
        <div className="mx-auto max-w-[640px]">
          {/* Shift chevrons + wordmark */}
          <div className="mb-8 inline-flex items-center gap-2.5">
            <svg viewBox="0 0 36 28" width="28" height="18" className="shrink-0">
              <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
              <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
            </svg>
            <span className="font-display text-lg font-bold tracking-wider text-white uppercase">
              Shift
            </span>
          </div>

          <h1 className="mb-5 font-display text-[clamp(1.75rem,5vw,2.75rem)] font-extrabold leading-[1.1] tracking-tight">
            Earn rewards for walking, biking, and taking transit.
          </h1>
          <p className="mb-10 text-[1.0625rem] leading-[1.65] text-white/70">
            Shift tracks your active trips and connects you to local businesses that reward you for
            getting there sustainably.
          </p>

          {/* ── State A: Pre-launch / State B: Live ────────── */}
          {IS_LIVE ? (
            <div>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <a
                  href={IOS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-lime px-7 py-3.5 text-sm font-bold text-navy transition-opacity hover:opacity-85"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#191A2E">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  Download on the App Store
                </a>
                <a
                  href={ANDROID_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.832l2.46 1.42c.55.32.55 1.09 0 1.41l-2.46 1.42-2.534-2.534 2.534-2.534v.818zm-3.906-2.54L4.864 3.378l10.928 6.328-2.302 2.302.303.327z" />
                  </svg>
                  Get it on Google Play
                </a>
              </div>
              <p className="mt-5 text-sm text-white/40">
                Free &middot; Requires iOS 16+ or Android 10+
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-lime">
                Coming soon to iOS and Android
              </p>
              <WaitlistEmailForm />
            </div>
          )}
        </div>
      </section>

      {/* ── Feature highlights ──────────────────────────────── */}
      <section className="px-8 pb-20">
        <div className="mx-auto grid max-w-[1120px] gap-5 sm:grid-cols-3">
          {[
            {
              icon: (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#BAF14D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              ),
              title: 'Track every trip',
              desc: 'Walks, rides, and transit automatically detected.',
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#BAF14D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
                </svg>
              ),
              title: 'Earn points',
              desc: 'Rewards from local businesses in your neighborhood.',
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#BAF14D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              ),
              title: 'See your impact',
              desc: 'CO\u2082 avoided, miles moved, money saved.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-[18px] border border-white/[0.08] bg-card p-7"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-lime/10">
                {f.icon}
              </div>
              <h3 className="mb-2 font-display text-base font-bold tracking-tight">
                {f.title}
              </h3>
              <p className="text-[0.875rem] leading-[1.6] text-white/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Rewards Partner CTA ─────────────────────────────── */}
      <section className="border-t border-white/[0.06] px-8 py-20">
        <div className="mx-auto max-w-[640px] text-center">
          <h2 className="mb-4 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.15] tracking-tight">
            Are you a local business?
          </h2>
          <p className="mb-8 text-[0.9375rem] leading-[1.65] text-white/60">
            Join the Shift Rewards Partner network and connect with customers who are actively
            choosing active transportation.
          </p>
          <Link
            href="/shift/rewards-partners"
            className="inline-block rounded-full bg-lime px-7 py-3.5 text-sm font-bold text-navy transition-opacity hover:opacity-85"
          >
            Become a Rewards Partner
          </Link>
        </div>
      </section>
    </main>
  )
}
