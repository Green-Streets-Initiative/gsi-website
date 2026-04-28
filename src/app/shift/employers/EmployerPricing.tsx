'use client'

import { useState } from 'react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

type Tier = 'starter' | 'basic' | 'standard' | 'premium'

type PricingCard = {
  id: Tier
  name: string
  price: string
  tagline: string
  features: string[]
  accent: string
  highlight?: boolean
}

const CARDS: PricingCard[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$500',
    tagline: 'For small teams who want to track and celebrate progress.',
    features: [
      'Private invite code & team leaderboard',
      'Team name + logo on public leaderboard',
      'Aggregate dashboard (trips, miles, CO₂, mode mix, Shift Rate)',
      'Downloadable impact report',
      'Commute Advisor (standard — no company customization)',
      'Optional public leaderboard for flagship events',
    ],
    accent: '#5DD39E',
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$1,000',
    tagline: 'Everything you need to launch a workplace challenge.',
    features: [
      'Employee invite code + private team leaderboard',
      'Branded Commute Advisor page for your workplace',
      'Your company logo in the Shift app',
      'Aggregate impact dashboard',
      'Downloadable impact reports for any date range',
      'Opt-in to regional public leaderboards',
    ],
    accent: '#2966E5',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$3,000',
    tagline: 'For employers ready to actively drive participation.',
    features: [
      'Everything in Basic',
      'Create your own branded team challenges',
      'Join flagship events like Shift Your Summer',
      'Monthly email digest of team participation',
    ],
    accent: '#BAF14D',
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$5,000',
    tagline: 'Funded rewards and sustainability-ready reporting.',
    features: [
      'Everything in Standard',
      'Company-funded rewards pool for your employees',
      '"Sponsored by [Company]" attribution on the rewards you fund',
    ],
    accent: '#E5A844',
  },
]

export default function EmployerPricing() {
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(tier: Tier) {
    setError(null)
    setLoadingTier(tier)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/employer-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, origin: window.location.origin }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Checkout failed (${res.status})`)
      }
      const { url } = (await res.json()) as { url?: string }
      if (!url) throw new Error('Checkout URL missing from response')
      window.location.href = url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setLoadingTier(null)
    }
  }

  return (
    <section className="bg-[#242538] px-8 py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-12 text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
            Plans
          </div>
          <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
            Annual subscriptions
          </h2>
          <p className="mx-auto max-w-[620px] text-[1.0625rem] leading-[1.65] text-white/80">
            Pick what fits how active you want your program to be. Every tier
            is annual, with custom packages and multi-year discounts available
            on request.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card) => (
            <div
              key={card.id}
              className={`flex flex-col overflow-hidden rounded-2xl border ${
                card.highlight
                  ? 'border-[#BAF14D] bg-white/[0.06]'
                  : 'border-white/[0.08] bg-white/[0.03]'
              }`}
            >
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: card.accent }}
                aria-hidden
              />
              <div className="flex flex-1 flex-col p-8">
                {card.highlight && (
                  <div
                    className="mb-4 inline-flex self-start rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#191A2E]"
                    style={{ backgroundColor: card.accent }}
                  >
                    Most popular
                  </div>
                )}
                <h3
                  className="mb-1 font-display text-xl font-extrabold"
                  style={{ color: card.accent }}
                >
                  {card.name}
                </h3>
                <div className="mb-1 text-3xl font-extrabold text-white">
                  {card.price}
                  <span className="text-base font-medium text-white/75"> / year</span>
                </div>
                <p className="mb-6 text-sm leading-[1.55] text-white/75">
                  {card.tagline}
                </p>
                <ul className="mb-8 flex-1 space-y-2.5 text-sm text-white">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-[#191A2E]"
                        style={{ backgroundColor: card.accent }}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(card.id)}
                  disabled={loadingTier !== null}
                  className={`w-full rounded-full px-5 py-3 text-sm font-bold transition-opacity disabled:opacity-50 ${
                    card.highlight
                      ? 'hover:opacity-85'
                      : 'border border-white/[0.2] text-white hover:bg-white/[0.06]'
                  }`}
                  style={
                    card.highlight
                      ? { backgroundColor: card.accent, color: '#191A2E' }
                      : undefined
                  }
                >
                  {loadingTier === card.id
                    ? 'Opening checkout…'
                    : `Subscribe to ${card.name}`}
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-6 text-center text-sm text-[#E05252]">
            {error} — if this keeps happening, reach out at{' '}
            <a
              href="mailto:info@gogreenstreets.org"
              className="underline"
            >
              info@gogreenstreets.org
            </a>
            .
          </p>
        )}

        <p className="mt-8 text-center text-xs italic text-white/75">
          All tiers are annual. Custom packages and multi-year discounts
          available.{' '}
          <a
            href="/contact?inquiry=employer"
            className="not-italic font-semibold text-white underline hover:text-[#BAF14D]"
          >
            Talk to us
          </a>
          .
        </p>
      </div>
    </section>
  )
}
