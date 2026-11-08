import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import HtmlLang from '@/components/HtmlLang'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import TownHeatmap, { type TownHeatmapLabels } from '@/components/towns/TownHeatmap'
import { Section, SectionHeading } from '@/components/org/Section'
import { Eyebrow, LANE, RouteSegment } from '@/components/home/RouteLine'
import { newInfraInTown } from '@/lib/server/new-infra'
import { NO_NEW_INFRA } from '@/lib/new-infra'
import { withUtm } from '@/lib/utm'
import {
  getTownBySlug,
  getTownCentroid,
  getTownHeatmap,
  getTownPageStats,
  getTownCivicEvents,
  getTownPartners,
  getTownResources,
  getTownRoams,
  stateLabel,
  MIN_RANKED_TRIPS,
} from '@/lib/towns/queries'
import { getEventPicks } from '@/lib/towns/event-picks'
import { getTownTrails } from '@/lib/trails/town'
import { tt } from '@/lib/towns/i18n'
import { HTML_LANG, TRANSLATED_TOWNS, num, type DraftLocale } from '@/lib/translated-pages'
import { AiNote, ReadInEnglish } from './TranslationNotes'
import { DigestSignupT, LeaderboardT, ModeSplitT, TocT } from './TownClient'
import {
  EventsRoamsT,
  GetInvolvedT,
  MomentumT,
  NewInTownT,
  RewardsPartnersT,
  StatRowT,
  TrailsT,
  WhatIsShiftT,
  heatmapLead,
  townT,
} from './town-sections'

/*
 * A town page (/shift/towns/[slug]) in Spanish or Portuguese, for the five
 * towns in the language plan (TRANSLATED_TOWNS). Same data, same order and
 * the same sections as src/app/shift/towns/[slug]/page.tsx as it is live
 * today; the fixed words come from src/lib/towns/i18n.ts. Live numbers stay
 * computed. Names and descriptions that arrive in English stay English and
 * carry lang="en".
 */

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

export async function townMetadata(slug: string, locale: DraftLocale): Promise<Metadata> {
  const result = await getTownBySlug(slug)
  if (!result || !(TRANSLATED_TOWNS as readonly string[]).includes(slug)) return {}
  const { town } = result
  return {
    title: tt(locale, 'meta_title', { town: town.town_name, state: town.state }),
    description: tt(locale, 'meta_desc', { town: town.town_name }),
  }
}

function heatmapLabels(locale: DraftLocale): TownHeatmapLabels {
  const t = townT(locale)
  return {
    modes: { all: t('hm_all'), walk: t('hm_walk'), bike: t('hm_bike'), transit: t('hm_transit') },
    chipModes: { walk: t('hm_walk'), bike: t('hm_bike'), transit: t('hm_transit'), Walking: t('hm_walk'), Biking: t('hm_bike'), Transit: t('hm_transit') },
    modeAria: t('hm_aria'),
    newChip: t('hm_new_chip'),
    newLead: t('hm_new_lead'),
    newBody: t('hm_new_body'),
    fewer: t('hm_fewer'),
    more: t('hm_more'),
    clear: t('hm_clear'),
  }
}

export default async function TranslatedTownPage({ slug, locale }: { slug: string; locale: DraftLocale }) {
  if (!(TRANSLATED_TOWNS as readonly string[]).includes(slug)) notFound()
  const result = await getTownBySlug(slug)
  if (!result) notFound()
  const { town, directory } = result
  const name = town.town_name
  const t = townT(locale)

  const centroid = await getTownCentroid(town.group_id)
  const [stats, roams, partners, heatmapLayers, events, resources, civicEvents, newInfra, townTrails] = await Promise.all([
    getTownPageStats(town.group_id),
    getTownRoams(centroid),
    getTownPartners(name, town.state),
    getTownHeatmap(town.group_id),
    getEventPicks(centroid, 8, { recRidesAsFill: true, town: { name, state: town.state } }),
    getTownResources(town.group_id),
    getTownCivicEvents(name),
    town.state === 'MA' ? newInfraInTown(name, town.state) : Promise.resolve(NO_NEW_INFRA),
    town.state === 'MA' ? getTownTrails(name, centroid) : Promise.resolve([]),
  ])
  if (!stats) notFound()

  const utm = { source: 'web_town', medium: 'town_page', campaign: `${slug}-${locale}` }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL
  const hasStateBoard = directory.some((x) => x.state === town.state && x.rank > 0)
  const showCompetition = directory.filter((x) => x.state === town.state && x.rank > 0).length >= 2
  const hasInvolved = resources.length > 0 || civicEvents.length > 0
  const heat = heatmapLayers.find((l) => l.mode_group === 'all') ?? heatmapLayers[0]

  const sections: Array<[string, string]> = [
    ...(hasInvolved ? [['#involved', t('toc_involved')] as [string, string]] : []),
    ...(newInfra.opened.length > 0 ? [['#new', t('toc_new')] as [string, string]] : []),
    ...(events.length > 0 || roams.length > 0 ? [['#events', t('toc_events')] as [string, string]] : []),
    ...(townTrails.length > 0 ? [['#trails', t('toc_trails')] as [string, string]] : []),
    ['#stats', t('toc_stats')],
    ...(heatmapLayers.length > 0 ? [['#moves', t('toc_moves')] as [string, string]] : []),
    ['#momentum', t('toc_momentum')],
    ...(showCompetition ? [['#competition', t('toc_competition')] as [string, string]] : []),
    ['#modes', t('toc_modes')],
    ...(partners.length > 0 ? [['#rewards', t('toc_rewards')] as [string, string]] : []),
  ]

  const ctaA = town.rank === 1 ? 'cta_top_a' : town.rank > 0 ? 'cta_climb_a' : 'cta_put_a'
  const ctaB = town.rank === 1 ? 'cta_top_b' : town.rank > 0 ? 'cta_climb_b' : 'cta_put_b'

  return (
    <>
      <Nav variant="light" locale={locale} />
      <HtmlLang locale={locale} />
      <main lang={HTML_LANG[locale]} className="bg-cream">
        <section className="relative overflow-x-clip bg-cream" style={{ paddingTop: '60px' }}>
          <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
            <RouteSegment shape="wanderLeft" />
            <div className="hidden md:block" />
            <div className="min-w-0 max-w-[780px] pb-10 pt-12 md:pt-16">
              <Eyebrow>
                <Link href="/shift/towns" className="underline-offset-4 hover:underline">{t('towns')}</Link>
                {' '}&middot; {stateLabel(town.state)}
              </Eyebrow>
              <h1 className="font-serif text-[clamp(2.25rem,6vw,4.25rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy [overflow-wrap:anywhere] sm:[overflow-wrap:normal]">
                {t('h1', { town: name })}
              </h1>
              <p className="mt-5 max-w-[600px] text-[1.125rem] leading-[1.6] text-ink-soft">{t('lede', { town: name })}</p>
              <div className="mt-4 flex flex-col gap-1">
                <AiNote locale={locale} />
                <p><ReadInEnglish page={`town:${slug}`} /></p>
              </div>
              <div id="digest" className="mt-7 scroll-mt-28">
                <DigestSignupT locale={locale} townName={name} townSlug={slug} />
              </div>
            </div>
          </div>
        </section>

        <TocT locale={locale} sections={sections} />

        {hasInvolved && (
          <Section id="involved" shape="straight" tone="white" width="read" className="scroll-mt-28">
            <GetInvolvedT locale={locale} resources={resources} civicEvents={civicEvents} townName={name} townSlug={slug} />
          </Section>
        )}

        {newInfra.opened.length > 0 && (
          <Section id="new" shape="straight" width="read" className="scroll-mt-28">
            <NewInTownT locale={locale} info={newInfra} townName={name} hasInvolved={hasInvolved} />
          </Section>
        )}

        {(events.length > 0 || roams.length > 0) && (
          <Section id="events" shape="wanderRight" className="scroll-mt-28">
            <EventsRoamsT locale={locale} events={events} roams={roams} townName={name} />
          </Section>
        )}

        {townTrails.length > 0 && (
          <Section id="trails" shape="straight" className="scroll-mt-28">
            <TrailsT locale={locale} trails={townTrails} townName={name} />
          </Section>
        )}

        <Section id="stats" shape="straight" tone="white" className="scroll-mt-28">
          <StatRowT
            locale={locale}
            stats={stats}
            townName={name}
            rank={town.rank > 0 ? { rank: town.rank, of: town.rankedInState, stateName: town.stateName } : null}
            unrankedNote={
              town.rank > 0
                ? undefined
                : hasStateBoard
                  ? t('unranked_board', { town: name, state: town.stateName, n: num(locale, MIN_RANKED_TRIPS) })
                  : t('unranked_none', { state: town.stateName })
            }
          />
        </Section>

        {heat && (
          <Section id="moves" shape="wanderLeft" className="scroll-mt-28">
            <div>
              <SectionHeading title={t('moves_title', { town: name })} />
              <p className="-mt-2 mb-6 max-w-[680px] text-[15px] leading-relaxed text-ink-soft">
                {heatmapLead(locale, name, heat.trip_count, (heat.named_corridors ?? []).slice(0, 3).map((c) => c.name))}
              </p>
              <TownHeatmap layers={heatmapLayers} centroid={centroid} labels={heatmapLabels(locale)} />
            </div>
          </Section>
        )}

        <Section id="momentum" shape="wanderLeft" width="read" className="scroll-mt-28">
          <MomentumT locale={locale} stats={stats} townName={name} />
        </Section>

        {showCompetition && (
          <Section id="competition" shape="straight" tone="white" width="read" className="scroll-mt-28">
            <LeaderboardT locale={locale} directory={directory} state={town.state} highlightGroupId={town.group_id} />
          </Section>
        )}

        <Section id="modes" shape="wanderRight" width="read" className="scroll-mt-28">
          <ModeSplitT locale={locale} stats={stats} townName={name} />
        </Section>

        <Section shape="straight" width="read">
          <WhatIsShiftT locale={locale} townName={name} />
        </Section>

        {partners.length > 0 && (
          <Section id="rewards" shape="straight" tone="white" className="scroll-mt-28">
            <RewardsPartnersT locale={locale} partners={partners} townName={name} />
          </Section>
        )}

        <Section shape="terminal" closing>
          <h2 className="font-serif text-[clamp(2rem,5vw,3.75rem)] font-normal leading-[1.04] text-navy">
            {t(ctaA, { town: name })}
            <em className="text-green-deep">{t(ctaB)}</em>
          </h2>
          <p className="mt-5 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">{t('cta_body', { town: name })}</p>
          <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="town_page" tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />
          <p className="mt-8 max-w-[620px] text-[13px] leading-relaxed text-ink-soft">
            {t('foot_a', { town: name })}
            <a href="mailto:info@gogreenstreets.org" className="font-semibold text-forest underline underline-offset-2">info@gogreenstreets.org</a>
            {t('foot_b')}
          </p>
        </Section>
      </main>
      <Footer variant="light" />
    </>
  )
}
