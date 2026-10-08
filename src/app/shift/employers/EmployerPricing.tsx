'use client'

import { useState } from 'react'
import { Check } from '@phosphor-icons/react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

type Tier = 'starter' | 'basic' | 'standard' | 'premium'

type PricingCard = {
  id: Tier
  name: string
  price: string
  tagline: string
  features: string[]
  accent: string
  // Text color used ON the accent (badge background, checkmark glyph,
  // highlighted button label). Every accent is dark enough to read on cream,
  // so each one carries white.
  accentText?: string
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
      'Weekly email report on your team',
      'Branded Commute Advisor page for your office',
      'Branded Nearby page: live transit, Bluebikes and bike paths around your office',
      'Optional public leaderboard for flagship events',
    ],
    accent: '#2D6A4F',
    accentText: '#FFFFFF',
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$1,000',
    tagline: 'Everything you need to launch a workplace challenge.',
    features: [
      'Everything in Starter',
      'Your company logo in the Shift app',
      'Downloadable impact reports for any date range',
      'Opt-in to regional public leaderboards',
    ],
    accent: '#2966E5',
    accentText: '#FFFFFF',
    highlight: true,
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
      'Company-funded rewards pool — gift cards for challenge winners',
    ],
    accent: '#1B4332',
    accentText: '#FFFFFF',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$5,000',
    tagline: 'Put your company name on the rewards you fund.',
    features: [
      'Everything in Standard',
      '"Sponsored by [Company]" attribution on the rewards you fund',
    ],
    accent: '#8A6D1F',
    accentText: '#FFFFFF',
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
    <section id="plans" className="scroll-mt-20 bg-cream px-6 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-10 text-center">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
            Plans
          </div>
          <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
            Annual subscriptions
          </h2>
          <p className="mx-auto max-w-[620px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            Pick what fits how active you want your program to be. Every tier
            is annual, with custom packages and multi-year discounts available
            on request.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card) => {
            const onAccent = card.accentText ?? '#191A2E'
            return (
            <div
              key={card.id}
              className={`flex flex-col overflow-hidden rounded-[14px] border bg-white ${
                card.highlight ? '' : 'border-navy/10'
              }`}
              style={card.highlight ? { borderColor: card.accent } : undefined}
            >
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: card.accent }}
                aria-hidden
              />
              <div className="flex flex-1 flex-col p-8">
                {card.highlight && (
                  <div
                    className="mb-4 inline-flex self-start rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: card.accent, color: onAccent }}
                  >
                    Most popular
                  </div>
                )}
                <h3
                  className="mb-1 font-serif text-[1.375rem] leading-tight"
                  style={{ color: card.accent }}
                >
                  {card.name}
                </h3>
                <div className="mb-1 font-serif text-[2.25rem] leading-none text-navy">
                  {card.price}
                  <span className="text-base font-medium text-ink-soft"> / year</span>
                </div>
                <p className="mb-6 text-sm leading-[1.55] text-ink-soft">
                  {card.tagline}
                </p>
                <ul className="mb-8 flex-1 space-y-2.5 text-sm text-navy">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: card.accent, color: onAccent }}
                        aria-hidden
                      >
                        <Check size={12} weight="bold" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(card.id)}
                  disabled={loadingTier !== null}
                  className={`inline-flex min-h-[48px] w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold transition-opacity disabled:opacity-50 ${
                    card.highlight
                      ? 'hover:opacity-90'
                      : 'border border-navy/25 text-navy transition-colors hover:bg-navy/[0.05]'
                  }`}
                  style={
                    card.highlight
                      ? { backgroundColor: card.accent, color: onAccent }
                      : undefined
                  }
                >
                  {loadingTier === card.id
                    ? 'Opening checkout…'
                    : `Subscribe to ${card.name}`}
                </button>
              </div>
            </div>
            )
          })}
        </div>

        {error && (
          <p className="mt-6 text-center text-sm text-[#B42318]">
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

        {/* Massachusetts nonprofit rate: employer item 9, Keith 2026-10-08.
            Capped at the first 10 organizations; large institutions pay the
            listed price. Granted by hand (comped Starter, or a Stripe coupon
            Keith creates), never through checkout. */}
        <div className="mx-auto mt-8 max-w-[720px] rounded-2xl border-2 border-forest/30 bg-white px-6 py-5 text-center">
          <p className="text-[1.0625rem] font-semibold text-navy">
            Massachusetts nonprofits: a founding rate for the first 10
          </p>
          <p className="mt-2 text-[0.9375rem] leading-[1.6] text-navy">
            Starter is free for nonprofits under 250 staff, and Basic and
            Standard are half price from 250 to 999 staff. In return, we ask to
            name you as an organization using Shift and to hear how it&apos;s
            going after a couple of months. Hospitals, universities and
            organizations with 1,000 or more staff pay the listed price.{' '}
            <a
              href="#inquiry"
              className="font-semibold text-forest underline underline-offset-4 hover:opacity-80"
            >
              Ask about the nonprofit rate
            </a>
            .
          </p>
        </div>

        <p className="mt-8 text-center text-[13px] italic text-ink-soft">
          All tiers are annual. Custom packages and multi-year discounts
          available.{' '}
          <a
            href="#inquiry"
            className="not-italic font-semibold text-forest underline underline-offset-4 hover:opacity-80"
          >
            Talk to us
          </a>
          .
        </p>
      </div>
    </section>
  )
}
