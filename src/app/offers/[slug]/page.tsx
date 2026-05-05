import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OfferForm from './OfferForm'

export const dynamic = 'force-dynamic'

interface OfferRow {
  id: string
  slug: string
  offer_headline: string
  offer_description: string
  offer_url: string
  valid_through: string | null
  consent_text: string
  privacy_policy_url: string
  sponsors: {
    name: string
    logo_url: string | null
    website_url: string | null
  } | null
}

async function getOffer(slug: string): Promise<OfferRow | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('sponsor_offers')
    .select(
      'id, slug, offer_headline, offer_description, offer_url, valid_through, consent_text, privacy_policy_url, sponsors!inner(name, logo_url, website_url)',
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) return null
  // Supabase returns the joined relation as either an object or array depending
  // on the cardinality it infers. Normalize to object.
  const sponsor = Array.isArray(data.sponsors) ? data.sponsors[0] : data.sponsors
  return { ...data, sponsors: sponsor ?? null } as OfferRow
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const offer = await getOffer(slug)
  if (!offer || !offer.sponsors) {
    return { title: 'Offer not found | Shift' }
  }
  return {
    title: `Exclusive Offer from ${offer.sponsors.name} | Shift Your Summer`,
    description: offer.offer_description,
  }
}

function formatValidThrough(date: string | null): string | null {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export default async function OfferPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const offer = await getOffer(slug)
  if (!offer || !offer.sponsors) notFound()

  const validThroughLabel = formatValidThrough(offer.valid_through)

  return (
    <main className="offer-page">
      <div className="offer-card">
        <div className="sponsor-hero">
          {offer.sponsors.logo_url ? (
            <img
              src={offer.sponsors.logo_url}
              alt={offer.sponsors.name}
              className="sponsor-logo"
            />
          ) : (
            <div className="sponsor-name-fallback">{offer.sponsors.name}</div>
          )}
        </div>

        <div className="offer-body">
          <div className="offer-badge">Shift Your Summer Exclusive</div>
          <h1 className="offer-headline">{offer.offer_headline}</h1>
          <p className="offer-desc">{offer.offer_description}</p>

          <OfferForm
            slug={offer.slug}
            sponsorName={offer.sponsors.name}
            offerUrl={offer.offer_url}
            consentText={offer.consent_text}
            privacyPolicyUrl={offer.privacy_policy_url}
            validThroughLabel={validThroughLabel}
          />
        </div>

        <div className="gsi-attribution">
          <span>Part of</span>
          <a href="https://www.gogreenstreets.org/events/shift-your-summer">
            Shift Your Summer
          </a>
          <span>by Green Streets Initiative</span>
        </div>
      </div>

      <style>{offerPageStyles}</style>
    </main>
  )
}

const offerPageStyles = `
  :root {
    --offer-navy: #191A2E;
    --offer-navy-light: #242538;
    --offer-cream: #F4F8EE;
    --offer-teal: #52B788;
    --offer-lime: #BAF14D;
    --offer-soft-white: #E8E8EE;
    --offer-border: #3A3B50;
  }

  .offer-page {
    font-family: var(--font-bricolage), system-ui, sans-serif;
    background: var(--offer-navy);
    color: var(--offer-soft-white);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .offer-card {
    max-width: 480px;
    width: 100%;
    background: var(--offer-navy-light);
    border: 1px solid var(--offer-border);
    border-radius: 16px;
    overflow: hidden;
  }

  .sponsor-hero {
    background: white;
    padding: 2.5rem 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sponsor-logo {
    max-height: 48px;
    max-width: 220px;
    object-fit: contain;
  }

  .sponsor-name-fallback {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--offer-navy);
  }

  .offer-body {
    padding: 2rem;
  }

  .offer-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--offer-navy);
    background: var(--offer-lime);
    padding: 0.3rem 0.75rem;
    border-radius: 100px;
    margin-bottom: 1.25rem;
  }

  .offer-headline {
    font-size: 1.5rem;
    font-weight: 800;
    color: white;
    line-height: 1.2;
    margin: 0 0 0.75rem;
  }

  .offer-desc {
    font-size: 0.9375rem;
    line-height: 1.7;
    color: var(--offer-soft-white);
    margin: 0 0 1.75rem;
  }

  .offer-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--offer-soft-white);
  }

  .form-field input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--offer-navy);
    border: 1px solid var(--offer-border);
    border-radius: 8px;
    color: white;
    font-family: var(--font-bricolage), system-ui, sans-serif;
    font-size: 0.9375rem;
    transition: border-color 0.2s;
  }

  .form-field input:focus {
    outline: none;
    border-color: var(--offer-teal);
  }

  .form-field input::placeholder {
    color: var(--offer-soft-white);
    opacity: 0.5;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .btn-unlock {
    width: 100%;
    padding: 0.875rem;
    background: var(--offer-teal);
    color: var(--offer-navy);
    border: none;
    border-radius: 10px;
    font-family: var(--font-bricolage), system-ui, sans-serif;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s;
    margin-top: 0.25rem;
  }

  .btn-unlock:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-unlock:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .consent-text {
    font-size: 0.6875rem;
    line-height: 1.5;
    color: var(--offer-soft-white);
    opacity: 0.7;
    margin-top: 0.5rem;
  }

  .consent-text a {
    color: var(--offer-teal);
    text-decoration: none;
  }

  .form-error {
    background: rgba(229, 62, 62, 0.15);
    border: 1px solid rgba(229, 62, 62, 0.4);
    color: #ffb3b3;
    padding: 0.625rem 0.875rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .offer-success {
    text-align: center;
    padding: 1rem 0;
  }

  .offer-success .check {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--offer-teal);
    color: var(--offer-navy);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.25rem;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .offer-success h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
    margin: 0 0 0.5rem;
  }

  .offer-success .code-display {
    background: var(--offer-navy);
    border: 2px dashed var(--offer-teal);
    border-radius: 8px;
    padding: 0.875rem;
    margin: 1rem 0;
    font-family: monospace;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--offer-lime);
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: background 0.2s;
  }

  .offer-success .code-display:hover {
    background: #1e1f35;
  }

  .offer-success .code-hint {
    font-size: 0.75rem;
    color: var(--offer-soft-white);
    opacity: 0.7;
  }

  .offer-success p {
    font-size: 0.875rem;
    color: var(--offer-soft-white);
    opacity: 0.85;
    line-height: 1.6;
    margin-top: 1rem;
  }

  .offer-success p a {
    color: var(--offer-teal);
    text-decoration: none;
  }

  .gsi-attribution {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 2rem 1.5rem;
    flex-wrap: wrap;
  }

  .gsi-attribution span {
    font-size: 0.6875rem;
    color: var(--offer-soft-white);
    opacity: 0.7;
  }

  .gsi-attribution a {
    color: var(--offer-teal);
    text-decoration: none;
    font-size: 0.6875rem;
    opacity: 0.85;
  }

  .gsi-attribution a:hover {
    opacity: 1;
  }

  @media (max-width: 520px) {
    .offer-page { padding: 1rem; }
    .offer-body { padding: 1.5rem; }
    .sponsor-hero { padding: 2rem 1.5rem; }
    .form-row { grid-template-columns: 1fr; }
  }
`
