import type { Metadata } from 'next'
import { NewRoutesStrip, RecentTripsCard, StatusBar } from '@/components/shift-mockup'
import { TownsTeaserBand } from '@/components/towns/TownsCrossLink'
import Link from 'next/link'
import HtmlLang from '@/components/HtmlLang'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FadeIn from '@/components/FadeIn'
import WaitlistEmailForm from '@/components/WaitlistEmailForm'
import StoreButtons from '@/components/StoreButtons'
import PhoneFrame from './_components/PhoneFrame'
import FeatureRow, { Bullet } from './_components/FeatureRow'
import TierLadder from './_components/TierLadder'
import NewRoutesShiftBanner from './_components/NewRoutesShiftBanner'
import SemesterShiftBanner from './_components/SemesterShiftBanner'
import JsonLd from '@/components/JsonLd'
import { shiftAppSchema } from '@/lib/structured-data'
import { SHIFT_UPDATES } from '@/lib/shift-updates'
import { siteLocale } from '@/lib/site-locale'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { shiftPageStrings, type ShiftPageKey } from '@/lib/site-strings/shift-page'

// In the visitor's language (?lang=, then the browser's language), so the
// page renders per request; the towns teaser band caches its count for an
// hour, the cadence this page's ISR had (Keith 2026-11-08).
type SearchParams = Promise<Record<string, string | string[] | undefined>>

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''
const IS_LIVE = !!(IOS_URL && ANDROID_URL)

const metadata: Metadata = {
  title: 'Shift — Find better ways to get around | Green Streets Initiative',
  description: 'Find better ways to get around Massachusetts, and get rewarded when you try them. A free app from Green Streets Initiative.',
  alternates: { canonical: 'https://www.gogreenstreets.org/shift' },
  openGraph: {
    title: 'Shift — Find better ways to get around',
    description: 'Find better ways to get around Massachusetts, and get rewarded when you try them. A free app from Green Streets Initiative.',
    url: 'https://www.gogreenstreets.org/shift',
    siteName: 'Green Streets Initiative',
    images: [{ url: '/og/shift-og.png', width: 1200, height: 630, alt: 'Shift by Green Streets Initiative — Find better ways to get around.' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shift — Find better ways to get around',
    description: 'Find better ways to get around Massachusetts, and get rewarded when you try them. A free app from Green Streets Initiative.',
    images: ['/og/shift-og.png'],
  },
}

const OG_LOCALE: Record<SiteLocale, string> = { en: 'en_US', es: 'es_US', 'pt-BR': 'pt_BR', 'zh-Hans': 'zh_CN' }

// English keeps its metadata word for word; the canonical stays the plain URL in every language.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = await siteLocale((await searchParams).lang)
  if (locale === 'en') return metadata
  const t = translator(shiftPageStrings, locale)
  const description = t('shiftp.meta_description')
  return {
    title: t('shiftp.meta_title'),
    description,
    alternates: { canonical: 'https://www.gogreenstreets.org/shift' },
    openGraph: {
      title: t('shiftp.og_title'),
      description,
      url: 'https://www.gogreenstreets.org/shift',
      siteName: 'Green Streets Initiative',
      images: [{ url: '/og/shift-og.png', width: 1200, height: 630, alt: t('shiftp.og_image_alt') }],
      locale: OG_LOCALE[locale],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('shiftp.og_title'),
      description,
      images: ['/og/shift-og.png'],
    },
  }
}

const GUIDE_CHIPS: ShiftPageKey[] = [
  'shiftp.chip_cost', 'shiftp.chip_safety', 'shiftp.chip_weather', 'shiftp.chip_time', 'shiftp.chip_distance',
  'shiftp.chip_fitness', 'shiftp.chip_infrastructure', 'shiftp.chip_habit', 'shiftp.chip_awareness', 'shiftp.chip_social',
]

/** "*word*" in a translated line becomes the bold word the English always had. */
function withBold(line: string) {
  return line.split('*').map((part, i) => (i % 2 ? <b key={i} className="font-extrabold text-forest">{part}</b> : part))
}

/* ── Chevron helper ─────────────────────────────────────────── */
// Org-voice sections (hero, community, teams, closing) sit on cream; the
// product block between them keeps the app's navy and its own lime chevrons.
const CHEV = <span className="font-extrabold tracking-[-0.08em] text-forest">&#8250;&#8250;</span>
const CHEV_DARK = <span className="font-extrabold tracking-[-0.08em] text-[#BAF14D]">&#8250;&#8250;</span>

export default async function ShiftPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(shiftPageStrings, locale)
  // A bullet's bold lead-in and the rest: Chinese runs them together without a space.
  const sp = locale === 'zh-Hans' ? '' : ' '
  const schema = locale === 'en' ? shiftAppSchema() : { ...shiftAppSchema(), description: t('shiftp.schema_description') }
  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <JsonLd data={schema} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* New Routes campaign hand-off — only renders for campaign traffic
            (partner co-brand or utm_campaign=newroutes); states the reward,
            shows the code to enter in the app, and gives attributed store CTAs */}
        <NewRoutesShiftBanner iosUrl={IOS_URL} androidUrl={ANDROID_URL} locale={locale} />
        <SemesterShiftBanner iosUrl={IOS_URL} androidUrl={ANDROID_URL} locale={locale} />

        {/* ═══════════════════════════════════════════════════════
            1 · HERO
        ═══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-cream px-8 pb-0 pt-12 md:pt-[50px]">
          {/* Background gradients */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute right-0 top-[8%] h-[420px] w-[min(680px,100%)] rounded-full bg-[radial-gradient(circle,rgba(41,102,229,0.10),transparent_60%)]" />
            <div className="absolute left-0 bottom-[10%] h-[460px] w-[min(620px,100%)] rounded-full bg-[radial-gradient(circle,rgba(45,106,79,0.10),transparent_60%)]" />
          </div>

          <div className="relative z-10 mx-auto grid max-w-[1120px] items-center gap-6 md:grid-cols-[1.04fr_0.96fr]">
            {/* Left — copy */}
            <div>
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-forest">
                {CHEV} {t('shiftp.hero_eyebrow')}
              </span>
              <h1 className="mt-4 font-serif text-[clamp(44px,7.2vw,86px)] font-normal leading-[1.04] text-navy">
                {t('shiftp.hero_title_a')}<br />
                <em className="text-green-deep">{t('shiftp.hero_title_b')}</em>
              </h1>
              <p className="mt-5 max-w-[46ch] text-[clamp(18px,1.6vw,21px)] leading-[1.6] text-navy">
                {t('shiftp.hero_lede')}
              </p>

              {IS_LIVE ? (
                <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-[30px]" />
              ) : (
                <div className="mt-[30px]">
                  <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-forest">
                    {t('shiftp.coming_soon')}
                  </p>
                  <WaitlistEmailForm source="shift_page" locale={locale} />
                </div>
              )}

              <div className="mt-[18px] inline-flex items-center gap-2 font-display text-sm font-semibold text-ink-soft">
                {CHEV} {t('shiftp.free_download')} &nbsp;&middot;&nbsp;{' '}
                <Link href={withLang('/commute-advisor', locale)} className="font-bold text-forest hover:underline">
                  {t('shiftp.trips_worth_link')}
                </Link>
              </div>

              {/* The newest update from src/lib/shift-updates.ts (English names it). */}
              <Link
                href="/shift/whats-new"
                className="mt-3 flex max-w-[46ch] items-baseline gap-2 font-display text-[15px] font-semibold text-navy hover:underline"
              >
                {CHEV}
                <span>
                  <b className="font-bold text-forest">{t('shiftp.whats_new')}</b>
                  {locale === 'en' && `: ${SHIFT_UPDATES[0].title}`}
                </span>
              </Link>
            </div>

            {/* Right — fanned phones */}
            <div className="group relative mx-auto h-[560px] w-full max-w-[520px] md:h-[620px]" aria-hidden="true">
              <div className="absolute left-1/2 top-1/2 z-[-1] h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(41,102,229,0.22),transparent_70%)] blur-xl" />
              {/* Left phone */}
              <div className="absolute left-1/2 top-1/2 z-[1] hidden w-[268px] -translate-x-[92%] -translate-y-[52%] -rotate-[9deg] scale-[0.82] brightness-[0.86] transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:-translate-x-[104%] group-hover:-rotate-[12deg] group-hover:scale-[0.83] md:block">
                <PhoneFrame src="/images/shift-app/around-you-home.png" alt={t('shiftp.alt_hero_home')} />
              </div>
              {/* Right phone */}
              <div className="absolute left-1/2 top-1/2 z-[1] hidden w-[268px] -translate-x-[8%] -translate-y-[46%] rotate-[9deg] scale-[0.82] brightness-[0.86] transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:-translate-x-[-4%] group-hover:rotate-[12deg] group-hover:scale-[0.83] md:block">
                <PhoneFrame src="/images/shift-app/rewards-perks-current.png" alt={t('shiftp.alt_hero_perks')} />
              </div>
              {/* Center phone */}
              <div className="absolute left-1/2 top-1/2 z-[3] w-[268px] -translate-x-1/2 -translate-y-1/2 scale-[0.98] transition-transform duration-500">
                <PhoneFrame src="/images/shift-app/around-you.png" alt={t('shiftp.alt_hero_around_you')} priority />
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-[34px] border-b border-t border-navy/10 bg-white py-[18px]">
            <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-center gap-x-[46px] gap-y-3 px-8">
              <span className="inline-flex items-center gap-2.5 font-display text-[15px] font-semibold text-navy">
                {CHEV} {t('shiftp.stat_live')}
              </span>
              <span className="h-[5px] w-[5px] rounded-full bg-white" />
              <span className="font-display text-[15px] font-semibold text-navy">{t('shiftp.stat_modes')}</span>
              <span className="h-[5px] w-[5px] rounded-full bg-white" />
              <span className="font-display text-[15px] font-semibold text-navy">
                {t('shiftp.stat_plan')}
              </span>
              <span className="h-[5px] w-[5px] rounded-full bg-white" />
              <span className="font-display text-[15px] font-semibold text-navy">
                {withBold(t('shiftp.stat_rewards_rich'))}
              </span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            2 · AROUND YOU (Keith 2026-10-06: real-world utility first)
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E]" id="the-app">
          <FadeIn>
            <FeatureRow
              eyebrow={t('shiftp.ay_eyebrow')}
              heading={t('shiftp.ay_heading')}
              media={
                <PhoneFrame
                  src="/images/shift-app/around-you-home.png"
                  alt={t('shiftp.ay_alt')}
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                {t('shiftp.ay_body')}
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.ay_b1_b')}</b>{sp}{t('shiftp.ay_b1')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.ay_b2_b')}</b>{sp}{t('shiftp.ay_b2')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.ay_b3_b')}</b>{sp}{t('shiftp.ay_b3')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.ay_b4_b')}</b>{sp}{t('shiftp.ay_b4')}</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            3 · COMMUTE ADVISOR (moved ahead of status, Keith 2026-10-06)
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#121320]">
          <FadeIn>
            <FeatureRow
              eyebrow={t('shiftp.adv_eyebrow')}
              eyebrowColor="#2966E5"
              heading={t('shiftp.adv_heading')}
              reverse
              media={
                <div className="flex w-[340px] max-w-full flex-col gap-4">
                  {/* Advisor card 1 — route suggestion */}
                  <div className="rounded-[20px] border border-[#2E3252] bg-[#1E2038] p-5 shadow-[0_24px_50px_-26px_rgba(0,0,0,0.7)]">
                    <div className="flex items-center gap-2.5 font-display text-[13px] font-bold uppercase tracking-[0.04em] text-[#9DBEFF]">
                      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[rgba(41,102,229,0.18)]">
                        <svg viewBox="0 0 24 24" width="16" fill="#9DBEFF"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" /></svg>
                      </span>
                      {t('shiftp.adv_card1_label')}
                    </div>
                    <h4 className="mt-3 font-display text-[19px] font-extrabold text-white">{t('shiftp.adv_card1_title')}</h4>
                    <p className="mt-1.5 text-[15px] text-white/80">{t('shiftp.adv_card1_body')}</p>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#262A47] px-3 py-1.5 font-display text-[12.5px] font-bold text-white">{t('shiftp.adv_chip_time')}</span>
                      <span className="rounded-full bg-[#262A47] px-3 py-1.5 font-display text-[12.5px] font-bold text-white">{t('shiftp.adv_chip_walk')}</span>
                      <span className="rounded-full bg-[#BAF14D] px-3 py-1.5 font-display text-[12.5px] font-bold text-[#10210B]">{t('shiftp.adv_chip_use')}</span>
                    </div>
                  </div>
                  {/* Advisor card 2 — nudge */}
                  <div className="rounded-[20px] border border-[#2E3252] bg-[#1E2038] p-5 shadow-[0_24px_50px_-26px_rgba(0,0,0,0.7)]">
                    <div className="flex items-center gap-2.5 font-display text-[13px] font-bold uppercase tracking-[0.04em] text-[#8FE0B6]">
                      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[rgba(82,183,136,0.18)]">
                        <svg viewBox="0 0 24 24" width="16" fill="#8FE0B6"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>
                      </span>
                      {t('shiftp.adv_card2_label')}
                    </div>
                    <h4 className="mt-3 font-display text-[19px] font-extrabold text-white">{t('shiftp.adv_card2_title')}</h4>
                    <p className="mt-1.5 text-[15px] text-white/80">{t('shiftp.adv_card2_body')}</p>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#262A47] px-3 py-1.5 font-display text-[12.5px] font-bold text-white">{t('shiftp.adv_chip_quiet')}</span>
                      <span className="rounded-full bg-[#262A47] px-3 py-1.5 font-display text-[12.5px] font-bold text-white">{t('shiftp.adv_chip_plus')}</span>
                    </div>
                  </div>
                </div>
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                {t('shiftp.adv_body')}
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.adv_b1_b')}</b>{sp}{t('shiftp.adv_b1')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.adv_b2_b')}</b>{sp}{t('shiftp.adv_b2')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.adv_b3_b')}</b>{sp}{t('shiftp.adv_b3')}</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            3b · STATUS / STREAKS / BADGES (after the utility features)
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E]">
          <FadeIn>
            <FeatureRow
              eyebrow={t('shiftp.st_eyebrow')}
              heading={t('shiftp.st_heading')}
              media={
                // Coded at native scale from the app's current Home (the May
                // capture showed a retired layout; site review 2026-11-04).
                <div className="flex w-full max-w-[402px] flex-col gap-3 justify-self-center font-display">
                  <StatusBar locale={locale} />
                  <RecentTripsCard locale={locale} />
                </div>
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                {t('shiftp.st_body')}
              </p>
              <div className="mt-6">
                <TierLadder locale={locale} />
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.st_b1_b')}</b>{sp}{t('shiftp.st_b1')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.st_b2_b')}</b>{sp}{t('shiftp.st_b2')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.st_b3_b')}</b>{sp}{t('shiftp.st_b3')}</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        <TownsTeaserBand locale={locale} />

        {/* ═══════════════════════════════════════════════════════
            4 · MICRO-GUIDES
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E]">
          <FadeIn>
            <FeatureRow
              eyebrow={t('shiftp.mg_eyebrow')}
              heading={t('shiftp.mg_heading')}
              media={
                <PhoneFrame
                  src="/images/shift-app/micro-guides.png"
                  alt={t('shiftp.mg_alt')}
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                {t('shiftp.mg_body')}
              </p>
              {/* Chip row */}
              <div className="mt-6 flex flex-wrap gap-2.5">
                {GUIDE_CHIPS.map((chip) => (
                  <span key={chip} className="rounded-full border border-[#2E3252] bg-[#262A47] px-3.5 py-[7px] font-display text-[13px] font-semibold text-white">
                    {t(chip)}
                  </span>
                ))}
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.mg_b1_b')}</b>{sp}{t('shiftp.mg_b1')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.mg_b2_b')}</b>{sp}{t('shiftp.mg_b2')}</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            5 · COMMUNITY
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-white px-8 py-10" id="community">
          <FadeIn>
            <div className="mx-auto mb-11 max-w-[680px] text-center">
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-forest">
                <span className="font-extrabold tracking-[-0.08em] text-forest">&#8250;&#8250;</span>
                {t('shiftp.com_eyebrow')}
              </span>
              <h2 className="mt-3.5 font-serif text-[clamp(30px,4.6vw,52px)] font-normal leading-[1.04] text-navy">
                {t('shiftp.com_title')}
              </h2>
              <p className="mt-[18px] text-[19px] text-ink-soft">
                {t('shiftp.com_body')}
              </p>
            </div>
          </FadeIn>

          {/* 5a — Leaderboards */}
          <FadeIn>
            <FeatureRow
              tone="light"
              eyebrow={t('shiftp.lb_eyebrow')}
              eyebrowColor="#52B788"
              heading={t('shiftp.lb_heading')}
              reverse
              media={
                <PhoneFrame
                  src="/images/shift-app/community-groups.png"
                  alt={t('shiftp.lb_alt')}
                  width={640}
                  height={1067}
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-ink-soft">
                {t('shiftp.lb_body')}
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.lb_b1_b')}</b>{sp}{t('shiftp.lb_b1')}</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.lb_b2_b')}</b>{sp}{t('shiftp.lb_b2')}</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>

          {/* 5b — Flagship challenges */}
          <FadeIn>
            <FeatureRow
              tone="light"
              eyebrow={t('shiftp.ch_eyebrow')}
              eyebrowColor="#52B788"
              heading={t('shiftp.ch_heading')}
              media={
                <div className="flex w-full max-w-[402px] flex-col gap-3 justify-self-center rounded-[28px] bg-navy p-4 font-display">
                  <NewRoutesStrip locale={locale} />
                  <StatusBar locale={locale} />
                </div>
              }
            >
              <p className="text-[18px] leading-[1.6] text-ink-soft">
                {t('shiftp.ch_body')}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-forest/40 bg-forest/10 px-3.5 py-[7px] font-display text-[13px] font-semibold text-green-deep">{t('shiftp.ch_chip_reward')}</span>
                <span className="rounded-full border border-navy/10 bg-white px-3.5 py-[7px] font-display text-[13px] font-semibold text-navy">{t('shiftp.ch_chip_trips')}</span>
                <span className="rounded-full border border-navy/10 bg-white px-3.5 py-[7px] font-display text-[13px] font-semibold text-navy">{t('shiftp.ch_chip_first')}</span>
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.ch_b1_b')}</b>{sp}{t('shiftp.ch_b1')}</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.ch_b2_b')}</b>{sp}{t('shiftp.ch_b2')}</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.ch_b3_b')}</b>{sp}<Link href={withLang('/challenges', locale)} className="font-semibold text-forest underline-offset-4 hover:underline">{t('shiftp.ch_b3_link')}</Link></Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>

          {/* 5c — Community events */}
          <FadeIn>
            <FeatureRow
              tone="light"
              eyebrow={t('shiftp.ev_eyebrow')}
              eyebrowColor="#52B788"
              heading={t('shiftp.ev_heading')}
              reverse
              media={
                <PhoneFrame
                  src="/images/shift-app/community-events.png"
                  alt={t('shiftp.ev_alt')}
                  className="w-[268px]"
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-ink-soft">
                {t('shiftp.ev_body')}
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.ev_b1_b')}</b>{sp}{t('shiftp.ev_b1')}</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.ev_b2_b')}</b>{sp}{t('shiftp.ev_b2')}</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>

          {/* 5d — Roams */}
          <FadeIn>
            <FeatureRow
              tone="light"
              eyebrow={t('shiftp.roam_eyebrow')}
              eyebrowColor="#52B788"
              heading={t('shiftp.roam_heading')}
              media={
                /* Duo phone layout */
                <div className="relative mx-auto min-h-[560px] w-full max-w-[392px]">
                  <div className="absolute right-0 top-0 z-[1] w-[210px] rotate-[8deg] scale-[0.94] brightness-[0.84]">
                    <PhoneFrame
                      src="/images/shift-app/roam-stop-detail.png"
                      alt={t('shiftp.roam_alt_stop')}
                      width={560}
                      height={1214}
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 z-[2] w-[210px] -rotate-[4deg]">
                    <PhoneFrame
                      src="/images/shift-app/roam-charles-loop.png"
                      alt={t('shiftp.roam_alt_loop')}
                      width={560}
                      height={1214}
                    />
                  </div>
                </div>
              }
            >
              <p className="text-[18px] leading-[1.6] text-ink-soft">
                {t('shiftp.roam_body')}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-forest/40 bg-forest/10 px-3.5 py-[7px] font-display text-[13px] font-semibold text-green-deep">{t('shiftp.roam_chip_count')}</span>
                <span className="rounded-full border border-forest/40 bg-forest/10 px-3.5 py-[7px] font-display text-[13px] font-semibold text-green-deep">{t('shiftp.roam_chip_length')}</span>
                <span className="rounded-full border border-forest/40 bg-forest/10 px-3.5 py-[7px] font-display text-[13px] font-semibold text-green-deep">{t('shiftp.roam_chip_modes')}</span>
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.roam_b1_b')}</b>{sp}{t('shiftp.roam_b1')}</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.roam_b2_b')}</b>{sp}{t('shiftp.roam_b2')}</Bullet>
                <Bullet tone="light"><b className="font-display font-bold text-navy">{t('shiftp.roam_b3_b')}</b>{sp}{t('shiftp.roam_b3')}</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            6 · REWARDS
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E]" id="rewards">
          <FadeIn>
            <FeatureRow
              eyebrow={t('shiftp.rw_eyebrow')}
              heading={t('shiftp.rw_heading')}
              reverse
              media={
                <PhoneFrame
                  src="/images/shift-app/rewards-perks-current.png"
                  alt={t('shiftp.rw_alt')}
                  className="w-[268px]"
                  glow
                />
              }
            >
              <p className="text-[18px] leading-[1.6] text-white/80">
                {t('shiftp.rw_body')}
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.rw_b1_b')}</b>{sp}{t('shiftp.rw_b1')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.rw_b2_b')}</b>{sp}{t('shiftp.rw_b2')}</Bullet>
                <Bullet><b className="font-display font-bold text-white">{t('shiftp.rw_b3_b')}</b>{sp}{t('shiftp.rw_b3')}</Bullet>
              </ul>
            </FeatureRow>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            7 · TEAMS & SCHOOLS
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-white px-8 py-10" id="teams">
          <FadeIn>
            <div className="mx-auto max-w-[1120px]">
              <div className="mb-2 text-center">
                <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-forest">
                  {CHEV} {t('shiftp.teams_eyebrow')}
                </span>
                <h2 className="mt-3.5 font-serif text-[clamp(30px,4.6vw,52px)] font-normal leading-[1.04] text-navy">
                  {t('shiftp.teams_title')}
                </h2>
              </div>

              <div className="mt-9 grid gap-[22px] md:grid-cols-2">
                {/* Employers card */}
                <div className="rounded-[22px] border border-navy/10 bg-white p-[30px] transition-all duration-200 hover:-translate-y-[3px] hover:border-navy/30">
                  <div className="font-display text-xs font-bold uppercase tracking-[0.16em] text-forest">{t('shiftp.emp_label')}</div>
                  <h3 className="mt-3 font-display text-[24px] font-extrabold leading-[1.08] text-navy">
                    {t('shiftp.emp_title')}
                  </h3>
                  <p className="mt-2.5 text-[15.5px] leading-[1.6] text-ink-soft">
                    {t('shiftp.emp_body')}
                  </p>
                  <Link href={withLang('/contact?inquiry=employer', locale)} className="mt-[18px] inline-flex items-center gap-2 font-display text-[15px] font-bold text-forest">
                    {t('shiftp.emp_cta')} <span>&rarr;</span>
                  </Link>
                </div>

                {/* Schools card */}
                <div className="rounded-[22px] border border-navy/10 bg-white p-[30px] transition-all duration-200 hover:-translate-y-[3px] hover:border-navy/30">
                  <div className="font-display text-xs font-bold uppercase tracking-[0.16em] text-forest">{t('shiftp.sch_label')}</div>
                  <h3 className="mt-3 font-display text-[24px] font-extrabold leading-[1.08] text-navy">
                    {t('shiftp.sch_title')}
                  </h3>
                  <p className="mt-2.5 text-[15.5px] leading-[1.6] text-ink-soft">
                    {t('shiftp.sch_body')}
                  </p>
                  <Link href={withLang('/contact?inquiry=school', locale)} className="mt-[18px] inline-flex items-center gap-2 font-display text-[15px] font-bold text-forest">
                    {t('shiftp.sch_cta')} <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ═══════════════════════════════════════════════════════
            8 · FINAL CTA
        ═══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-cream px-8 py-[78px] text-center" id="get">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_380px_at_50%_0%,rgba(45,106,79,0.12),transparent_65%)]" />
          <div className="relative mx-auto max-w-[560px]">
            <FadeIn>
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] text-forest">
                {CHEV} {t('shiftp.final_eyebrow')}
              </span>
              <h2 className="mt-4 font-serif text-[clamp(40px,6vw,72px)] font-normal leading-[1.04] text-navy">
                {t('shiftp.final_title_a')}<br />{t('shiftp.final_title_b')}
              </h2>
              <p className="mt-4 text-[19px] text-ink-soft">
                {t('shiftp.final_body')}
              </p>

              {IS_LIVE ? (
                <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-[34px] justify-center" />
              ) : (
                <div className="mt-[34px]">
                  <WaitlistEmailForm source="shift_page" locale={locale} />
                </div>
              )}

              <p className="mt-[22px] font-display text-sm font-semibold text-ink-soft">
                {t('shiftp.final_biz')}{' '}
                <Link href={withLang('/shift/rewards-partners', locale)} className="font-bold text-forest hover:underline">
                  {t('shiftp.final_biz_link')}
                </Link>
              </p>
            </FadeIn>
          </div>
        </section>

      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
