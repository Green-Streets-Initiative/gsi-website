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
    tagline: 'Up to 250 people.',
    features: [
      'Private invite code and team leaderboard',
      'Automatic trip detection, nothing to log',
      'Branded Commute Advisor and Nearby page for your office',
      'Aggregate dashboard, weekly email and impact report',
      'Walk/Ride Day drawings every month, funded by GSI',
      'Full-workforce commute survey available as an add-on',
    ],
    accent: '#2D6A4F',
    accentText: '#FFFFFF',
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$1,000',
    tagline: 'Up to 250 people, with your brand on everything.',
    features: [
      'Everything in Starter',
      'Your company logo in the Shift app',
      'Opt in to regional public leaderboards',
      'Results by location for employers with several offices',
      'Full-workforce commute survey available as an add-on',
    ],
    accent: '#2966E5',
    accentText: '#FFFFFF',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$3,000',
    tagline: 'More than 250 people, or any team that wants to run challenges.',
    features: [
      'Everything in Basic',
      'Your own branded team challenges',
      'Flagship events like Shift Your Summer, as a team',
      'Company-funded rewards pool with gift cards for winners',
      'One full-workforce commute survey a year, run by GSI, with a regulator-format summary',
    ],
    accent: '#1B4332',
    accentText: '#FFFFFF',
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$5,000',
    tagline: 'More than 250 people, filing a commute report.',
    features: [
      'Everything in Standard',
      'Filing packet for MassDEP, Cambridge PTDM or Boston TAPA',
      'Mid-year check on how your measures are working',
      '"Sponsored by [Company]" on the rewards you fund',
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
            One flat annual price
          </h2>
          <p className="mx-auto max-w-[640px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            Rewards and reporting are included, and the price never goes up because more of your people join. Up to 250 people: Starter or Basic. More than 250: Standard or Premium.
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
                    Recommended
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

        <p className="mx-auto mt-8 max-w-[720px] text-center text-[13px] leading-[1.6] text-ink-soft">
          All plans are annual. The add-on commute survey for Starter and Basic is $750 to $1,500 per site per cycle. Rewards you fund are paid into your rewards pool separately from the plan price. Custom packages and multi-year discounts on request:{' '}
          <a
            href="#inquiry"
            className="font-semibold text-forest underline underline-offset-4 hover:opacity-80"
          >
            talk to us
          </a>
          .
        </p>
      </div>
    </section>
  )
}
