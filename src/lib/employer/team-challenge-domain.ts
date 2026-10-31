// Does the sign-up email belong to the company whose website was typed?
// Pure rules, tested in team-challenge-domain.test.ts. createTeam() in
// team-challenge-server.ts calls verifyDomain() and stores the answer on
// the group as onboarding.signup.domain_verified. The check never blocks a
// sign-up: a team whose domain did not match is still made, and the Shift
// server limits its invitations to its own domain until an admin adds more
// in Settings.
//
// A match is the email domain and the website sharing a registrable domain
// (acme.com and www.acme.com, mail.acme.com and acme.com, acme.co.uk and
// shop.acme.co.uk), or the website's homepage naming the email domain: an
// address on it, a mailto link, or the domain written out.

import { emailDomain } from './team-challenge.ts'

// Public suffixes of two labels, under which a company's own domain is
// three labels long (acme.co.uk). The common ones; anything else is two.
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'ltd.uk', 'plc.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'org.nz', 'net.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.mx', 'org.mx', 'edu.mx', 'gob.mx',
  'co.in', 'net.in', 'org.in',
  'co.za', 'org.za',
  'com.sg', 'com.hk', 'com.tw', 'com.cn', 'net.cn', 'org.cn', 'co.kr',
  'com.ar', 'com.co', 'com.tr', 'com.pl', 'com.ua', 'co.il', 'org.il',
  'com.my', 'com.ph', 'com.pk', 'com.ng', 'com.eg', 'com.sa', 'com.ae',
  'co.th', 'co.id', 'com.vn',
])

/** The website as a URL to fetch: protocol added, path dropped, host as typed. Null when it is not a web address. */
export function websiteUrl(website: string): string | null {
  const raw = website.trim()
  if (!raw || /\s/.test(raw)) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    const host = u.hostname.toLowerCase()
    if (!host.includes('.') || u.username || u.password) return null
    return `${u.protocol}//${host}/`
  } catch {
    return null
  }
}

/** The website's host without "www.", lower case; null when it is not a web address. */
export function websiteHost(website: string): string | null {
  const url = websiteUrl(website)
  if (!url) return null
  return new URL(url).hostname.replace(/^www\./, '')
}

/** acme.com for mail.acme.com; acme.co.uk for shop.acme.co.uk. */
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean)
  if (labels.length <= 2) return labels.join('.')
  const n = TWO_LABEL_SUFFIXES.has(labels.slice(-2).join('.')) ? 3 : 2
  return labels.slice(-n).join('.')
}

/** The email's domain and the website belong to the same registrable domain. */
export function domainsMatch(emailDom: string, website: string): boolean {
  const host = websiteHost(website)
  const d = emailDom.trim().toLowerCase()
  if (!host || !d) return false
  return registrableDomain(d) === registrableDomain(host)
}

/** The page names an address on the email's domain, or the domain itself (not a longer name that merely contains it). */
export function homepageMentionsDomain(html: string, emailDom: string): boolean {
  const d = emailDom.trim().toLowerCase()
  if (!d) return false
  const esc = d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9-])${esc}(?!\\.?[a-z0-9-])`, 'i').test(html)
}

export type HomepageFetcher = (url: string) => Promise<string | null>

/**
 * True when the email belongs to the website's company. The homepage fetch
 * is only tried when the domains differ; a fetch that fails, times out or
 * returns nothing means false, never an error.
 */
export async function verifyDomain(args: { email: string; website: string; fetchHomepage?: HomepageFetcher }): Promise<boolean> {
  const dom = emailDomain(args.email)
  const url = websiteUrl(args.website)
  if (!dom || !url) return false
  if (domainsMatch(dom, url)) return true
  try {
    const html = await (args.fetchHomepage ?? fetchHomepage)(url)
    return !!html && homepageMentionsDomain(html, dom)
  } catch {
    return false
  }
}

const USER_AGENT = 'Shift/1.0 (+https://gogreenstreets.org)'
const TIMEOUT_MS = 5_000
const MAX_BYTES = 500 * 1024
const MAX_REDIRECTS = 3

/** GET the homepage: 5 s in all, up to 3 redirects, at most 500 KB read. Null when it cannot be read. */
export async function fetchHomepage(url: string): Promise<string | null> {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      redirect: 'manual',
      signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*;q=0.5' },
    })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      await res.body?.cancel().catch(() => {})
      if (!location || hop === MAX_REDIRECTS) return null
      current = new URL(location, current).toString()
      continue
    }
    if (!res.ok || !res.body) return null
    return readUpTo(res.body, MAX_BYTES)
  }
  return null
}

async function readUpTo(body: ReadableStream<Uint8Array>, max: number): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let out = ''
  let total = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.byteLength
    out += decoder.decode(value, { stream: true })
    if (total >= max) {
      await reader.cancel().catch(() => {})
      break
    }
  }
  return out
}
