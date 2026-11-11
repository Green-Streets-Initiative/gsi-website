/**
 * Per-channel install attribution for the App Store and Google Play buttons.
 *
 * A visitor's utm tags tell us which channel sent them to the website, but the
 * store install drops them. Each store has its own way to carry a channel
 * through the install:
 *   - Apple: `pt` (GSI's provider token) + `ct` (campaign token). App Store
 *     Connect → Analytics → Acquisition → Campaigns reports installs per `ct`
 *     (only for people who share analytics with developers, and only once a
 *     campaign has 5+ installs).
 *   - Google: `referrer`, a URL-encoded utm string the Play Console reports on.
 *
 * The landing page's tags are remembered for the session, so a visitor who
 * arrives on /shift?utm_source=onlyinbos and taps a store button two pages
 * later is still counted for Only In Boston.
 */

/** GSI's App Store Connect provider token (Keith, 2026-10-06). Not secret. */
export const APPLE_PROVIDER_TOKEN = '128659955'

/** `ct` for store taps from visitors who arrived with no utm_source. */
export const DEFAULT_CAMPAIGN_TOKEN = 'gsi_website'

const STORAGE_KEY = 'gsi_store_attribution'
const MAX_CT = 40

export type StoreAttribution = {
  source: string
  medium?: string
  campaign?: string
  content?: string
  /** Co-brand slug (?partner=), e.g. a property manager's building page. */
  partner?: string
}

const PARTNER_RE = /^[a-z0-9-]{1,60}$/

function fromParams(params: URLSearchParams): StoreAttribution | null {
  const partnerRaw = params.get('partner')?.trim().toLowerCase()
  const partner = partnerRaw && PARTNER_RE.test(partnerRaw) ? partnerRaw : undefined
  const source = params.get('utm_source')?.trim() || (partner ? 'partner' : '')
  if (!source) return null
  return {
    source,
    medium: params.get('utm_medium')?.trim() || undefined,
    campaign: params.get('utm_campaign')?.trim() || undefined,
    content: params.get('utm_content')?.trim() || undefined,
    partner,
  }
}

/** Save the landing page's utm tags for the rest of the visit. Call on every navigation. */
export function rememberAttribution(params: URLSearchParams): void {
  const attr = fromParams(params)
  if (!attr) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attr))
  } catch {
    // Private mode or blocked storage: the current page's tags still apply.
  }
}

/** The current page's utm tags, else the ones remembered earlier this visit. */
export function currentAttribution(): StoreAttribution | null {
  if (typeof window === 'undefined') return null
  const here = fromParams(new URLSearchParams(window.location.search))
  if (here) return here
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as StoreAttribution) : null
    return saved?.source ? saved : null
  } catch {
    return null
  }
}

/**
 * Apple's campaign token, lowercase with safe characters only:
 * `partner-<slug>` for a co-branded building page (the building is the unit
 * we want counted), otherwise `<source>-<campaign>`.
 */
export function campaignToken(attr: StoreAttribution | null): string {
  if (!attr) return DEFAULT_CAMPAIGN_TOKEN
  const raw = attr.partner
    ? `partner-${attr.partner}`
    : attr.campaign ? `${attr.source}-${attr.campaign}` : attr.source
  const token = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, MAX_CT).replace(/^[_-]+|[_-]+$/g, '')
  return token || DEFAULT_CAMPAIGN_TOKEN
}

/**
 * Tag a store URL with the visitor's channel. A URL the caller already tagged
 * (e.g. New Routes' partner links) keeps its tags unless the visitor arrived
 * with their own utm_source, which is the more specific answer.
 */
export function withStoreAttribution(url: string, attr: StoreAttribution | null): string {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }
  if (u.hostname.endsWith('apps.apple.com')) {
    u.searchParams.set('pt', APPLE_PROVIDER_TOKEN)
    if (attr || !u.searchParams.has('ct')) u.searchParams.set('ct', campaignToken(attr))
    u.searchParams.set('mt', '8')
  } else if (u.hostname.endsWith('play.google.com')) {
    if (attr) {
      const ref = new URLSearchParams({ utm_source: attr.source })
      if (attr.medium) ref.set('utm_medium', attr.medium)
      if (attr.campaign) ref.set('utm_campaign', attr.campaign)
      const content = attr.partner ?? attr.content
      if (content) ref.set('utm_content', content)
      u.searchParams.set('referrer', ref.toString())
    } else if (!u.searchParams.has('referrer')) {
      u.searchParams.set('referrer', new URLSearchParams({ utm_source: DEFAULT_CAMPAIGN_TOKEN }).toString())
    }
  }
  return u.toString()
}
