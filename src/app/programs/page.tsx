import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { translator, withLang } from '@/lib/site-i18n'
import { programsStrings } from '@/lib/site-strings/programs'
import { chromeStrings } from '@/lib/site-strings/chrome'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// In the visitor's language (?lang=, then the browser's); program names as the footer says them.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const t = translator(programsStrings, await siteLocale((await searchParams).lang))
  return {
    title: t('programs.meta_title'),
    description: t('programs.meta_description'),
  }
}

export default async function ProgramsPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(programsStrings, locale)
  const tc = translator(chromeStrings, locale)
  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px] text-center">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              {t('programs.eyebrow')}
            </div>
            <h1 className="mx-auto mb-6 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              {t('programs.title')}
            </h1>
            <p className="mx-auto max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              {t('programs.lede')}
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · WALK/RIDE DAYS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid items-start gap-12 md:grid-cols-2">
              {/* Copy */}
              <div>
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                  {t('programs.wrd_eyebrow')}
                </div>
                <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
                  {tc('footer.wrd')}
                </h2>
                <p className="mb-4 text-[1.0625rem] leading-[1.65] text-ink-soft">
                  {t('programs.wrd_body_1')}
                </p>
                <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
                  {t('programs.wrd_body_2')}
                </p>
                <Link
                  href={withLang('/programs/walk-ride-days', locale)}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {t('programs.learn_more')}
                </Link>
              </div>

              {/* Stat callouts */}
              <div className="flex flex-col gap-4">
                {[
                  { label: t('programs.wrd_stat_1') },
                  { label: t('programs.wrd_stat_2') },
                  { label: t('programs.wrd_stat_3') },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[14px] border border-navy/10 bg-cream p-6"
                  >
                    <span className="text-base font-semibold text-navy">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · WHAT MOVES US
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              {t('programs.wmu_eyebrow')}
            </div>
            <h2 className="mb-4 max-w-[640px] font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              {tc('footer.wmu')}
            </h2>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              {t('programs.wmu_body')}
            </p>

            <div className="mb-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-[14px] border border-navy/10 bg-white p-8">
                <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                  {t('programs.wmu_communities_title')}
                </h3>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  {t('programs.wmu_communities_body')}
                </p>
              </div>
              <div className="rounded-[14px] border border-navy/10 bg-white p-8">
                <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                  {t('programs.wmu_commuters_title')}
                </h3>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  {t('programs.wmu_commuters_body')}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href={withLang('/programs/what-moves-us', locale)}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                {t('programs.wmu_past')}
              </Link>
              <Link
                href={withLang('/contact?inquiry=general', locale)}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]"
              >
                {t('programs.wmu_commission')}
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · CORPORATE CHALLENGE
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue">
              {t('programs.cc_eyebrow')}
            </div>
            <h2 className="mb-4 max-w-[640px] font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              {tc('footer.corporate')}
            </h2>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              {t('programs.cc_body')}
            </p>

            <div className="mb-10 grid gap-6 md:grid-cols-3">
              {[
                { title: t('programs.cc_card_1_title'), body: t('programs.cc_card_1_body') },
                { title: t('programs.cc_card_2_title'), body: t('programs.cc_card_2_body') },
                { title: t('programs.cc_card_3_title'), body: t('programs.cc_card_3_body') },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-[14px] border border-navy/10 bg-cream p-8"
                >
                  <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                    {card.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href={withLang('/programs/corporate-challenge', locale)}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t('programs.learn_more')}
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · SHIFT FOR SCHOOLS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid items-start gap-12 md:grid-cols-2">
              <div>
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                  {t('programs.schools_eyebrow')}
                </div>
                <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
                  {tc('footer.schools_program')}
                </h2>
                <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
                  {t('programs.schools_body')}
                </p>
                <Link
                  href={withLang('/shift/schools', locale)}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {t('programs.learn_more')}
                </Link>
              </div>

              <div className="flex flex-col gap-4">
                {[
                  { label: t('programs.schools_stat_1') },
                  { label: t('programs.schools_stat_2') },
                  { label: t('programs.schools_stat_3') },
                  { label: t('programs.schools_stat_4') },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[14px] border border-navy/10 bg-white p-6"
                  >
                    <span className="text-base font-semibold text-navy">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · BRIDGE STRIP
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[640px] text-center">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              {t('programs.bridge_eyebrow')}
            </div>
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              {t('programs.bridge_title')}
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.65] text-ink-soft">
              {t('programs.bridge_body')}
            </p>
            <Link
              href={withLang('/shift', locale)}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t('programs.bridge_cta')}
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6 · WORK WITH US — TWO CARDS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 pb-20 lg:px-8 lg:pb-24">
          <div className="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-2">
            <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
              <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                {t('programs.bring_title')}
              </h3>
              <p className="mb-6 text-[0.9375rem] leading-[1.6] text-ink-soft">
                {t('programs.bring_body')}
              </p>
              <Link
                href={withLang('/contact', locale)}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                {t('programs.bring_cta')}
              </Link>
            </div>

            <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
              <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                {t('programs.join_title')}
              </h3>
              <p className="mb-6 text-[0.9375rem] leading-[1.6] text-ink-soft">
                {t('programs.join_body')}
              </p>
              <Link
                href={withLang('/shift', locale)}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]"
              >
                {t('programs.join_cta')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
