// Is this sign-up's company already on Shift? Pure rules, so they can be
// tested on their own (team-challenge-match.test.ts) and run against the
// real company list. lookupTeam() in team-challenge-server.ts reads the
// companies and calls findCompanyMatch().
//
// A match is an email domain the company owns (its portal admins, its
// contact email or its website), or the same name once "The", "Inc", "&"
// and punctuation are set aside. GSI's own domain and free mail providers
// never count as a company's domain: GSI staff are admins on many portals,
// and anyone can have a Gmail address.

import { emailDomain, isPersonalEmail } from './team-challenge.ts'

export type CompanyForMatch = {
  id: string
  name: string
  status: string
  tier: string | null
  billing_type: string | null
  admin_email: string | null
  website_url: string | null
  group_admins: { email: string }[] | null
}

/** A domain that says which company someone works for, or null. */
export function companyDomain(d: string | null | undefined): string | null {
  const v = (d ?? '').trim().toLowerCase().replace(/^www\./, '')
  if (!v || !v.includes('.') || v === 'gogreenstreets.org' || isPersonalEmail(`x@${v}`)) return null
  return v
}

export function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url.includes('://') ? url : `https://${url}`).hostname
  } catch {
    return null
  }
}

/** "The Loomis, Sayles & Company, L.P." → "loomissaylesandcompany" → minus suffixes → "loomissayles..." */
export function normalizeCompany(name: string): string {
  const SUFFIX = new Set(['inc', 'incorporated', 'llc', 'llp', 'lp', 'l', 'p', 'ltd', 'corp', 'corporation', 'company', 'co', 'group', 'holdings', 'pc', 'plc'])
  const words = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words[0] === 'the') words.shift()
  while (words.length > 1 && SUFFIX.has(words[words.length - 1])) words.pop()
  // "Loomis Sayles and Company" → drop a trailing "and" left by a suffix.
  while (words.length > 1 && words[words.length - 1] === 'and') words.pop()
  return words.join('')
}

export function sameCompanyName(a: string, b: string): boolean {
  const x = normalizeCompany(a)
  const y = normalizeCompany(b)
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.length >= 6 && long.startsWith(short)
}

export function findCompanyMatch(
  companies: readonly CompanyForMatch[],
  signupEmail: string,
  signupCompany: string,
): { company: CompanyForMatch; by: 'domain' | 'name' } | null {
  const domain = companyDomain(emailDomain(signupEmail))
  if (domain) {
    const owns = (d: string | null) => !!d && (domain === d || domain.endsWith(`.${d}`))
    const byWebsite = companies.find((c) => owns(companyDomain(hostOf(c.website_url))))
    const byEmail = companies.find(
      (c) => owns(companyDomain(emailDomain(c.admin_email ?? ''))) || (c.group_admins ?? []).some((a) => owns(companyDomain(emailDomain(a.email)))),
    )
    const hit = byWebsite ?? byEmail
    if (hit) return { company: hit, by: 'domain' }
  }
  const byName = companies.find((c) => sameCompanyName(c.name, signupCompany))
  return byName ? { company: byName, by: 'name' } : null
}
