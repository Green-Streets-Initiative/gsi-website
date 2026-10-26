// Run with: node --test src/lib/employer/team-challenge-match.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { companyDomain, findCompanyMatch, normalizeCompany, sameCompanyName, type CompanyForMatch } from './team-challenge-match.ts'

const co = (over: Partial<CompanyForMatch> & { name: string }): CompanyForMatch => ({
  id: over.name,
  status: 'active',
  tier: 'free',
  billing_type: 'prospect',
  admin_email: null,
  website_url: null,
  group_admins: [],
  ...over,
})

const COMPANIES = [
  co({ name: 'Loomis Sayles', billing_type: 'paid', tier: 'standard', admin_email: 'info@gogreenstreets.org', website_url: 'https://www.loomissayles.com', group_admins: [{ email: 'info@gogreenstreets.org' }, { email: 'a@loomissayles.com' }] }),
  co({ name: 'MassBike', billing_type: 'comped', admin_email: 'bikeinfo@massbike.org', website_url: 'https://massbike.org' }),
  co({ name: 'Profitero+', admin_email: 'someone@gmail.com', website_url: 'https://www.profitero.com/' }),
  co({ name: 'Bank of America', admin_email: 'x@bofa.com', website_url: 'https://www.bankofamerica.com/' }),
  co({ name: 'Harvard Federal Credit Union', billing_type: 'sponsorship', group_admins: [{ email: 'keith@gogreenstreets.org' }, { email: 'j@harvardfcu.org' }] }),
]

describe('normalizeCompany', () => {
  it('ignores case, punctuation, "The", "&" and legal endings', () => {
    assert.equal(normalizeCompany('The Loomis, Sayles & Company, L.P.'), normalizeCompany('loomis sayles and'))
    assert.equal(normalizeCompany('Acme Inc.'), 'acme')
    assert.equal(normalizeCompany('Mattapan Food & Fitness'), 'mattapanfoodandfitness')
  })
})

describe('sameCompanyName', () => {
  it('matches the same name written differently', () => {
    assert.ok(sameCompanyName('Loomis Sayles', 'Loomis, Sayles & Company'))
    assert.ok(sameCompanyName('Bank of America', 'Bank of America Merrill'))
  })
  it('does not match short or different names', () => {
    assert.ok(!sameCompanyName('MIT', 'MITRE'))
    assert.ok(!sameCompanyName('Liberty Mutual', 'Liberty Bank'))
  })
})

describe('companyDomain', () => {
  it('skips GSI and free mail', () => {
    assert.equal(companyDomain('gogreenstreets.org'), null)
    assert.equal(companyDomain('gmail.com'), null)
    assert.equal(companyDomain('www.massbike.org'), 'massbike.org')
  })
})

describe('findCompanyMatch', () => {
  it('finds a paying customer by a staff member’s email', () => {
    const m = findCompanyMatch(COMPANIES, 'new.person@loomissayles.com', 'Loomis')
    assert.equal(m?.company.name, 'Loomis Sayles')
    assert.equal(m?.by, 'domain')
  })
  it('finds a company with no portal admin by its contact email or website', () => {
    assert.equal(findCompanyMatch(COMPANIES, 'ed@massbike.org', 'Massachusetts Bicycle Coalition')?.company.name, 'MassBike')
    assert.equal(findCompanyMatch(COMPANIES, 'jo@profitero.com', 'Profitero')?.company.name, 'Profitero+')
  })
  it('accepts a subdomain of the company’s domain', () => {
    assert.equal(findCompanyMatch(COMPANIES, 'a@us.bofa.com', 'BofA')?.company.name, 'Bank of America')
  })
  it('never matches on GSI’s own domain or free mail', () => {
    assert.equal(findCompanyMatch(COMPANIES, 'keith+x@gogreenstreets.org', 'GSI Test'), null)
    assert.equal(findCompanyMatch(COMPANIES, 'a@gmail.com', 'Someone New'), null)
  })
  it('falls back to the name', () => {
    const m = findCompanyMatch(COMPANIES, 'a@hfcu-new.org', 'Harvard Federal Credit Union')
    assert.equal(m?.by, 'name')
  })
  it('lets a new company through', () => {
    assert.equal(findCompanyMatch(COMPANIES, 'colleen@americastestkitchen.com', 'America’s Test Kitchen'), null)
  })
})
