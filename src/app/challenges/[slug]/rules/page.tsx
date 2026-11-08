import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { categoryList, fetchChallenge, fullDay, withPreview } from '../_lib/api'
import { siteTime, translator, withLang } from '@/lib/site-i18n'
import { siteLocale } from '@/lib/site-locale'
import { creativeRulesStrings, creativeStrings, rich } from '@/lib/site-strings/challenges'

/**
 * Official rules for a creative challenge, written from the challenge's own
 * row (dates, prizes, length, categories), so a new challenge needs no new
 * rules page. Borrowed from the Walk/Ride Day rules (eligibility, publicity,
 * results list, privacy, liability), changed where a judged contest differs
 * from a drawing: judging, the People's Choice vote and the license to share
 * the work.
 *
 * Translated (es, pt-BR, zh-Hans) with a line at the top saying the English
 * version governs, and a link to it. The challenge and prize names stay in
 * English.
 */
export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>
type Search = Promise<{ preview?: string | string[]; lang?: string | string[] }>

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { slug } = await params
  const t = translator(creativeStrings, await siteLocale((await searchParams).lang))
  return { title: t('meta.rules', { name: slug.replace(/-/g, ' ') }), robots: { index: false, follow: true } }
}

const ET = 'America/New_York'

export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params
  const sp = await searchParams
  const raw = sp.preview
  const preview = typeof raw === 'string' ? raw.slice(0, 64) : ''
  const locale = await siteLocale(sp.lang)
  const t = translator(creativeRulesStrings, locale)
  const data = await fetchChallenge(slug, preview).catch(() => null)
  if (!data) notFound()
  const c = data.challenge
  const day = (iso: string) => fullDay(iso, locale)
  const at = (iso: string) => locale === 'en'
    ? `${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ET })} Eastern Time on ${fullDay(iso)}`
    : t('at', { time: siteTime(locale, iso, { hour: 'numeric', minute: '2-digit', timeZone: ET }), date: day(iso) })
  const entriesEnd = new Date(new Date(c.entries_close_at).getTime() - 60_000).toISOString()
  const votingEnd = new Date(new Date(c.voting_close_at).getTime() - 60_000).toISOString()
  const catList = categoryList(c, locale)
  const here = withPreview(`/challenges/${c.slug}/rules`, preview)
  const english = `${here}${here.includes('?') ? '&' : '?'}lang=en`

  return (
    <div className="street">
      <HtmlLang locale={locale} />
      <Nav variant="light" street locale={locale} />
      <main className="bg-cream pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 pb-20 pt-8 lg:pt-10">
          <Link href={withLang(withPreview(`/challenges/${c.slug}`, preview), locale)} className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
            &larr; {c.title}
          </Link>
          <h1 className="mt-4 font-headline text-[clamp(2.25rem,5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.01em] text-navy">
            {t('title')}
          </h1>
          <p className="mt-3 text-[16px] text-ink-soft">{t('sub', { title: c.title })}</p>
          {locale !== 'en' && (
            <p className="mt-4 rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed text-navy">
              {t('governs')}{' '}
              <a href={english} hrefLang="en" lang="en" className="font-bold text-forest underline underline-offset-4">
                {t('english_link')}
              </a>
            </p>
          )}

          <S n={1} title={t('s1.title')}>
            <P>{t('s1.p1', { title: c.title })}</P>
            <P>{t('s1.p2', { title: c.title })}</P>
          </S>

          <S n={2} title={t('s2.title')}>
            <P>{t('s2.p1')}</P>
            <P>{t('s2.p2')}</P>
          </S>

          <S n={3} title={t('s3.title')}>
            <Ul items={[
              t('s3.open', { open: at(c.opens_at), close: at(entriesEnd) }),
              t('s3.judging', { date: day(c.judging_close_at), n: c.finalist_count }),
              t('s3.voting', { start: day(c.judging_close_at), end: at(votingEnd) }),
              t('s3.results', { date: day(c.results_at) }),
            ]} />
          </S>

          <S n={4} title={t('s4.title')}>
            <Ul items={[
              t('s4.make', { min: c.min_seconds ?? 30, max: c.max_seconds ?? 60, cats: catList }),
              t('s4.upload'),
              t('s4.enter', { n: c.max_entries_per_person }),
              t('s4.original'),
              t('s4.positive'),
              t('s4.ai'),
            ]} />
            <P>{t('s4.check')}</P>
          </S>

          <S n={5} title={t('s5.title')}>
            <P>{t('s5.p1')}</P>
            <P>{t('s5.p2')}</P>
          </S>

          <S n={6} title={t('s6.title')}>
            <P>{t('s6.p1')}</P>
            <P>{t('s6.p2', { cats: catList, n: c.finalist_count })}</P>
            <P>{t('s6.p3')}</P>
          </S>

          <S n={7} title={t('s7.title')}>
            <ul className="mt-3 divide-y-2 divide-navy/[0.08] border-y-2 border-navy/[0.14]">
              {c.prizes.map((p) => (
                <li key={p.key} className="flex items-baseline justify-between gap-4 py-3 text-[16px] text-navy">
                  <span>{p.label}{p.key === 'grand' ? t('s7.grand') : p.category ? t('s7.category') : p.key === 'peoples_choice' ? t('s7.peoples') : ''}</span>
                  <span className="font-bold">{p.amount}</span>
                </li>
              ))}
            </ul>
            <P>{t('s7.p1', { total: c.total_prizes })}</P>
            <P>{t('s7.p2')}</P>
          </S>

          <S n={8} title={t('s8.title')}>
            <P>{t('s8.p1')}</P>
            <P>{t('s8.p2')}</P>
          </S>

          <S n={9} title={t('s9.title')}>
            <P>{t('s9.p1')}</P>
            <P>{t('s9.p2')}</P>
          </S>

          <S n={10} title={t('s10.title')}>
            <P>{rich(t('s10.p1'), { link: <Link href="/privacy" className="font-bold text-forest underline underline-offset-4">{t('s10.link')}</Link> })}</P>
          </S>

          <S n={11} title={t('s11.title')}>
            <P>{t('s11.p1')}</P>
            <P>{t('s11.p2')}</P>
          </S>

          <S n={12} title={t('s12.title')}>
            <P>{rich(t('s12.p1'), { email: <a href="mailto:info@gogreenstreets.org" className="font-bold text-forest underline underline-offset-4">info@gogreenstreets.org</a> })}</P>
          </S>
        </article>
      </main>
      <Footer variant="light" locale={locale} />
    </div>
  )
}

function S({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-headline text-[1.375rem] font-extrabold leading-tight text-navy">{n}. {title}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[16px] leading-[1.65] text-navy">{children}</p>
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-[16px] leading-[1.65] text-navy">
          <span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}
