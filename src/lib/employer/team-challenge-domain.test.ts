// Run with: node --test src/lib/employer/team-challenge-domain.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { domainsMatch, homepageMentionsDomain, registrableDomain, verifyDomain, websiteHost, websiteUrl } from './team-challenge-domain.ts'

describe('websiteUrl and websiteHost', () => {
  it('adds the protocol, drops the path and keeps the host as typed', () => {
    assert.equal(websiteUrl('acme.com'), 'https://acme.com/')
    assert.equal(websiteUrl('http://www.acme.com/about?x=1'), 'http://www.acme.com/')
    assert.equal(websiteHost('https://www.Acme.com/jobs'), 'acme.com')
  })
  it('refuses things that are not a web address', () => {
    assert.equal(websiteUrl('acme'), null)
    assert.equal(websiteUrl('not a site'), null)
    assert.equal(websiteUrl('mailto:a@acme.com'), null)
    assert.equal(websiteUrl(''), null)
  })
})

describe('registrableDomain', () => {
  it('keeps the last two labels, or three under a co.uk-style suffix', () => {
    assert.equal(registrableDomain('mail.acme.com'), 'acme.com')
    assert.equal(registrableDomain('acme.com'), 'acme.com')
    assert.equal(registrableDomain('shop.acme.co.uk'), 'acme.co.uk')
    assert.equal(registrableDomain('acme.co.uk'), 'acme.co.uk')
  })
})

describe('domainsMatch', () => {
  it('exact match', () => {
    assert.ok(domainsMatch('acme.com', 'https://acme.com'))
  })
  it('www. on the website', () => {
    assert.ok(domainsMatch('acme.com', 'www.acme.com'))
    assert.ok(domainsMatch('acme.com', 'http://WWW.Acme.com/careers'))
  })
  it('a subdomain on either side', () => {
    assert.ok(domainsMatch('mail.acme.com', 'acme.com'))
    assert.ok(domainsMatch('acme.com', 'https://jobs.acme.com'))
    assert.ok(domainsMatch('acme.co.uk', 'https://shop.acme.co.uk'))
  })
  it('mismatch', () => {
    assert.ok(!domainsMatch('acme.com', 'https://acmecorp.com'))
    assert.ok(!domainsMatch('notacme.com', 'acme.com'))
    // Sharing only the public suffix is not a match.
    assert.ok(!domainsMatch('acme.co.uk', 'https://other.co.uk'))
    assert.ok(!domainsMatch('acme.com', 'nonsense'))
  })
})

describe('homepageMentionsDomain', () => {
  it('finds an address, a mailto or the domain written out', () => {
    assert.ok(homepageMentionsDomain('<a href="mailto:hello@acmecorp.com">Email us</a>', 'acmecorp.com'))
    assert.ok(homepageMentionsDomain('Write to info@AcmeCorp.com for quotes.', 'acmecorp.com'))
    assert.ok(homepageMentionsDomain('Visit https://acmecorp.com/about', 'acmecorp.com'))
    assert.ok(homepageMentionsDomain('<a href="https://www.acmecorp.com">home</a>', 'acmecorp.com'))
  })
  it('does not count a longer name that contains it', () => {
    assert.ok(!homepageMentionsDomain('info@notacmecorp.com', 'acmecorp.com'))
    assert.ok(!homepageMentionsDomain('acmecorp.com.evil.net', 'acmecorp.com'))
    assert.ok(!homepageMentionsDomain('<p>Welcome to Acme</p>', 'acmecorp.com'))
  })
})

describe('verifyDomain', () => {
  const never = async () => {
    throw new Error('should not fetch')
  }
  it('exact match, without fetching', async () => {
    assert.equal(await verifyDomain({ email: 'pat@acme.com', website: 'https://acme.com', fetchHomepage: never }), true)
  })
  it('www. and a subdomain, without fetching', async () => {
    assert.equal(await verifyDomain({ email: 'pat@acme.com', website: 'www.acme.com', fetchHomepage: never }), true)
    assert.equal(await verifyDomain({ email: 'pat@mail.acme.com', website: 'acme.com', fetchHomepage: never }), true)
  })
  it('mismatch, homepage silent', async () => {
    const fetched: string[] = []
    const fetcher = async (url: string) => {
      fetched.push(url)
      return '<html><body>Acme Holdings. Call us.</body></html>'
    }
    assert.equal(await verifyDomain({ email: 'pat@acmecorp.com', website: 'https://acme.com/about', fetchHomepage: fetcher }), false)
    assert.deepEqual(fetched, ['https://acme.com/'])
  })
  it('homepage containing the domain', async () => {
    const fetcher = async () => '<html><body><a href="mailto:hello@acmecorp.com">hello@acmecorp.com</a></body></html>'
    assert.equal(await verifyDomain({ email: 'pat@acmecorp.com', website: 'acme.com', fetchHomepage: fetcher }), true)
  })
  it('fetch failure means false, not an error', async () => {
    const failing = async () => {
      throw new Error('ECONNREFUSED')
    }
    assert.equal(await verifyDomain({ email: 'pat@acmecorp.com', website: 'acme.com', fetchHomepage: failing }), false)
    const empty = async () => null
    assert.equal(await verifyDomain({ email: 'pat@acmecorp.com', website: 'acme.com', fetchHomepage: empty }), false)
  })
  it('no usable website or email means false', async () => {
    assert.equal(await verifyDomain({ email: 'pat@acme.com', website: 'acme', fetchHomepage: never }), false)
    assert.equal(await verifyDomain({ email: 'pat', website: 'acme.com', fetchHomepage: never }), false)
  })
})
