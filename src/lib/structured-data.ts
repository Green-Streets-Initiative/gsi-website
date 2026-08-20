import { SITE_URL, SITE_NAME } from './seo'

/**
 * Structured-data (schema.org / JSON-LD) builders.
 *
 * A stable `@id` for the organization lets every other node (app publisher,
 * article author/publisher) reference one canonical entity instead of
 * repeating it. Search and answer engines merge by `@id`.
 */
export const ORG_ID = `${SITE_URL}/#organization`

const GSI_LOGO =
  'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/gsi-wordmark.png'

/** Site-wide NGO identity. Rendered once, in the root layout. */
export function organizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    '@id': ORG_ID,
    name: SITE_NAME,
    alternateName: 'GSI',
    url: SITE_URL,
    logo: GSI_LOGO,
    email: 'info@gogreenstreets.org',
    description:
      'Green Streets Initiative helps people across Greater Boston shift trips to walking, biking, and transit — and measures the impact, trip by trip, community by community.',
    areaServed: {
      '@type': 'AdministrativeArea',
      name: 'Greater Boston, Massachusetts',
    },
    nonprofitStatus: 'Nonprofit501c3',
    // EIN is public (printed on the donate page).
    taxID: '26-1484405',
    // sameAs: [ ... ]  // TODO(Keith): add official social profile URLs.
  }
}

/** FAQPage from question/answer pairs. Answers must match the visible text. */
export function faqPageSchema(
  items: { question: string; answer: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  }
}

/** The Shift mobile app, for the /shift page. */
export function shiftAppSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'Shift',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'iOS, Android',
    url: `${SITE_URL}/shift`,
    description:
      'Shift by Green Streets Initiative turns everyday walking, biking, and transit trips into local rewards, status, and friendly competition.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': ORG_ID },
    // No aggregateRating until real store-rating data is wired — never faked.
  }
}

/** Article schema for a micro-guide. */
export function guideArticleSchema(input: {
  title: string
  description: string
  slug: string
  datePublished: string
  dateModified?: string | null
}): Record<string, unknown> {
  const url = `${SITE_URL}/guides/${input.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    url,
    mainEntityOfPage: url,
    datePublished: input.datePublished,
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
  }
}

/** BreadcrumbList from an ordered list of { name, path }. */
export function breadcrumbSchema(
  crumbs: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  }
}
