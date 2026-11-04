// Shift employer plans: the one list. The public pricing section
// (EmployerPricing), the portal (TIER_ANNUAL_PRICE) and the setup assistant
// all read this, so a price changes in one place.

export type PlanId = 'starter' | 'basic' | 'standard' | 'premium'

export type Plan = {
  id: PlanId
  name: string
  /** Dollars per year. */
  annualPrice: number
  tagline: string
  features: string[]
}

/** Keith 2026-10-31: the first survey is free at any tier; after that it is included in Standard and Premium. */
const SURVEY_FEATURE =
  'Workforce commute survey: your first one is free; after that, included in Standard and Premium'

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    annualPrice: 500,
    tagline: 'For small teams who want to track and celebrate progress.',
    features: [
      'Private invite code & team leaderboard',
      'Team name + logo on public leaderboard',
      'Your company logo in the Shift app',
      'Aggregate dashboard (trips, miles, CO₂, mode mix, Shift Rate)',
      'Downloadable impact report',
      'Weekly email report on your team',
      'Branded Commute Advisor page for your office',
      'Branded Nearby page: live transit, Bluebikes and bike paths around your office',
      'Team challenges (gift-card rewards from Standard)',
      'Optional public leaderboard for flagship events',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    annualPrice: 1000,
    tagline: 'Reports for the dates you choose',
    features: [
      'Everything in Starter',
      'Impact reports for any dates you choose',
      'Opt-in to regional public leaderboards',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    annualPrice: 3000,
    tagline: 'For employers ready to actively drive participation.',
    features: [
      'Everything in Basic',
      'Gift-card rewards for your challenges, from a company-funded pool',
      'Join flagship events like Shift Your Summer',
      SURVEY_FEATURE,
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    annualPrice: 5000,
    tagline: 'For employers who file a commute report with the state or their city.',
    features: [
      'Everything in Standard',
      SURVEY_FEATURE,
    ],
  },
]

export const PLAN_TERMS = 'All plans are annual subscriptions. Custom packages and multi-year discounts are available.'

/** Massachusetts nonprofit founding rate (employer item 9, Keith 2026-10-08).
 *  Granted by hand, never through checkout. */
export const NONPROFIT_RATE =
  'Massachusetts nonprofits, first 10 organizations: Starter is free under 250 staff, and Basic and Standard are half price from 250 to 999 staff, in return for naming them as an organization using Shift and hearing how it is going after a couple of months. Hospitals, universities and organizations with 1,000 or more staff pay the listed price.'

export const priceLabel = (p: Plan) => `$${p.annualPrice.toLocaleString('en-US')}`
