// Home-page CTA tracking vocabulary. Every call to action on the home page
// fires `home_cta_clicked` with these three props so a web → install funnel
// can be built in PostHog (same project as the Shift app).
export type Placement =
  | 'hero'
  | 'ledger'
  | 'product'
  | 'audience_index'
  | 'mission'
  | 'closing'
  | 'nav'
  | 'nav_promo'
  | 'challenges_hub'
  | 'challenges_empty'

export type Audience =
  | 'individual'
  | 'employer'
  | 'school'
  | 'town'
  | 'business'
  | 'partner'
  | 'donor'
  | 'volunteer'
  | 'general'

export const HOME_CTA_EVENT = 'home_cta_clicked'
