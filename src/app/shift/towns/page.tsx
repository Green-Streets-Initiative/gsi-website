import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import PageHero from '@/components/org/PageHero'
import { Section } from '@/components/org/Section'
import { withUtm } from '@/lib/utm'
import {
  getTownDirectory,
  rankedStates,
  stateLabel,
  PUBLICATION_GATE,
  MIN_RANKED_TRIPS,
  MIN_RANKED_TOWNS_PER_STATE,
} from '@/lib/towns/queries'
import { TownLeaderboard, townMonth, townNum } from '@/components/towns/TownSections'
import HtmlLang from '@/components/HtmlLang'
import { rich } from '@/components/towns/rich'
import { siteLocale } from '@/lib/site-locale'
import { translator, withLang } from '@/lib/site-i18n'
import { townsStrings } from '@/lib/site-strings/towns'

// Evergreen hub — the internal-link parent for every town page. It renders in
// the reader's language (?lang= or Accept-Language), which makes it per request;
// revalidate still caches the directory query.
export const revalidate = 3600

type SP = { searchParams: Promise<{ lang?: string | string[] }> }

const SITE_URL = 'https://www.gogreenstreets.org'
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const t = translator(townsStrings, await siteLocale((await searchParams).lang))
  return {
    title: t('hub.meta_title'),
    description: t('hub.meta_desc'),
    alternates: { canonical: `${SITE_URL}/shift/towns` },
    openGraph: {
      title: t('hub.og_title'),
      description: t('hub.og_desc'),
      url: `${SITE_URL}/shift/towns`,
      siteName: 'Green Streets Initiative',
      type: 'website',
    },
  }
}

export default async function TownsHubPage({ searchParams }: SP) {
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(townsStrings, locale)
  const directory = await getTownDirectory()
  // Three tiers, and they are not the same question:
  //   published  — has a town page (member gate)
  //   boards     — states with enough ranked towns to publish a standing
  //   unranked   — has a page, but too few trips this month to claim a rank
  //   belowGate  — no page yet
  const published = directory.filter((t) => t.member_count >= PUBLICATION_GATE)
  const boards = rankedStates(directory)
  const unranked = published.filter((t) => t.rank === 0)
  const belowGate = directory
    .filter((t) => t.member_count < PUBLICATION_GATE)
    .sort((a, b) => b.member_count - a.member_count)
  // The full sub-gate list runs to well over a hundred towns — name the ones
  // closest to qualifying and count the rest.
  const NEARLY_THERE = 12
  const nearlyThere = belowGate.slice(0, NEARLY_THERE)
  const remaining = belowGate.length - nearlyThere.length

  const totals = published.reduce(
    (acc, t) => ({
      trips: acc.trips + t.active_trips_month,
      miles: acc.miles + t.active_miles_month,
      users: acc.users + t.active_users_month,
    }),
    { trips: 0, miles: 0, users: 0 },
  )

  const utm = { source: 'web_town', medium: 'town_page', campaign: 'towns_hub' }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('hub.og_title'),
    url: `${SITE_URL}/shift/towns`,
    description: t('hub.ld_desc'),
    isPartOf: { '@type': 'WebSite', name: 'Green Streets Initiative', url: SITE_URL },
  }

  return (
    <>
      <Nav variant="light" locale={locale} />
      <HtmlLang locale={locale} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="bg-cream">
        <PageHero
          eyebrow={t('eyebrow')}
          title={rich(t('hub.title'), { em: (c) => <em className="text-green-deep">{c}</em> })}
          lede={t('hub.lede', {
            month: townMonth(locale),
            users: townNum(totals.users, locale),
            trips: townNum(totals.trips, locale),
            towns: published.length,
          })}
        >
          <p className="mt-4 max-w-[560px] text-[12px] leading-relaxed text-ink-soft">
            {rich(t('hub.sample'), { b: (c) => <b className="font-semibold text-navy">{c}</b> })}
          </p>
        </PageHero>

        {/* The race — one board per state. Towns race their own state, the
            same rule the app uses; a national mix put New York above Boston. */}
        {boards.map((state, i) => (
          <Section key={state} shape={i % 2 === 0 ? 'wanderRight' : 'wanderLeft'} tone="white" width="read">
            <TownLeaderboard
              directory={directory}
              state={state}
              title={i === 0 ? t('lb.title') : t('hub.board_state', { state: stateLabel(state) })}
              locale={locale}
            />
          </Section>
        ))}

        {/* Published, but not ranked — these have pages and deserve the link;
            they just don't have enough trips this month to claim a standing. */}
        {unranked.length > 0 && (
          <Section shape="straight" width="read">
            <div className="max-w-[720px] border-t border-navy/15 pt-6">
              <h2 className="font-serif text-[1.375rem] leading-tight text-navy">{t('hub.also_title')}</h2>
              <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft">
                {rich(t(unranked.length === 1 ? 'hub.also_one' : 'hub.also_many'), {
                  nodes: {
                    list: unranked.map((town, i) => (
                      <span key={town.group_id}>
                        {i > 0 && t('list.sep')}
                        <Link href={withLang(`/shift/towns/${town.slug}`, locale)} className="font-semibold text-navy underline decoration-navy/30 underline-offset-2 hover:text-forest hover:decoration-forest">
                          {town.town_name}
                          {town.state !== boards[0] && ` (${town.state})`}
                        </Link>
                      </span>
                    )),
                  },
                })}{' '}
                {t('hub.also_rule', { trips: MIN_RANKED_TRIPS, towns: MIN_RANKED_TOWNS_PER_STATE })}
              </p>
            </div>
          </Section>
        )}

        {/* Getting started */}
        {nearlyThere.length > 0 && (
          <Section shape="wanderLeft" width="read">
            <div className="max-w-[720px] border-t border-navy/15 pt-6">
              <h2 className="font-serif text-[1.375rem] leading-tight text-navy">{t('hub.started_title')}</h2>
              <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft">
                {t(remaining > 0 ? 'hub.started_more' : nearlyThere.length === 1 ? 'hub.started_one' : 'hub.started_many', {
                  list: nearlyThere
                    .map((town) => (town.state === boards[0] ? town.town_name : `${town.town_name} (${town.state})`))
                    .join(t('list.sep')),
                  count: townNum(remaining, locale),
                })}{' '}
                {t('hub.started_rule', { gate: PUBLICATION_GATE })}
              </p>
            </div>
          </Section>
        )}

        {/* CTA */}
        <Section shape="terminal" closing>
          <h2 className="font-serif text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-[1.02] text-navy">
            {rich(t('hub.cta_title'), { em: (c) => <em className="text-green-deep">{c}</em> })}
          </h2>
          <p className="mt-5 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            {t('hub.cta_body')}
          </p>
          <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="towns_hub" tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />
        </Section>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
