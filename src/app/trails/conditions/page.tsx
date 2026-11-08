import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Snowflake, Download } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import JsonLd from '@/components/JsonLd'
import ConditionsMap, { type ConditionsLane, type ConditionsTrail } from '@/components/trails/ConditionsMap'
import { getTrails, type TrailSummary } from '@/lib/trails/queries'
import { getNetworkLines } from '@/lib/trails/geometry'
import { getLaneConditions, getPathConditions } from '@/lib/trails/conditions'
import { CONDITION_COLOR, clearedLabel, clearedShort, isWintry, type ClearedKey, reportLine, snowLine, timeOf, type TrailConditions } from '@/lib/trails/conditionText'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { translator, withLang } from '@/lib/site-i18n'
import { trailStrings } from '@/lib/site-strings/trails'

type PageProps = { searchParams: Promise<{ lang?: string | string[] }> }

export const revalidate = 600

const SITE_URL = 'https://www.gogreenstreets.org'

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const t = translator(trailStrings, await siteLocale((await searchParams).lang))
  return {
    title: t('c.meta_title'),
    description: t('c.meta_description'),
    alternates: { canonical: `${SITE_URL}/trails/conditions` },
  }
}

function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : s).trim()
}

interface Row {
  t: TrailSummary
  c: TrailConditions | null
  cleared: ClearedKey
}

/**
 * /trails/conditions: the regional picture after snow (Keith 2026-10-31).
 * First screen: how much snow, the map, and the paths people reported today.
 * Then each path by who clears it. Protected bike lanes are on the map and in
 * the reports too (Keith 2026-11-04: "Yes, add lanes"). The same data is an
 * open feed at /trails/conditions.json.
 */
export default async function ConditionsPage({ searchParams }: PageProps) {
  const [trails, network, conditions, lanes, locale] = await Promise.all([
    getTrails(), getNetworkLines(), getPathConditions(), getLaneConditions(), searchParams.then((p) => siteLocale(p.lang)),
  ])
  const tr = translator(trailStrings, locale)
  const now = new Date()
  const linesById = new Map(network.map((n) => [n.id, n.lines]))

  const rows: Row[] = trails.map((t) => {
    const c = conditions.get(t.id) ?? null
    return { t, c, cleared: (c?.winter?.cleared ?? 'unknown') as ClearedKey }
  })
  const reported = rows.filter((r) => (r.c?.reports.length ?? 0) > 0)
  const rest = rows.filter((r) => !reported.includes(r))
  const groups = (['yes', 'partly', 'no'] as const).map((k) => ({ key: k, label: clearedLabel(k, locale), heading: clearedShort(k, locale), rows: rest.filter((r) => r.cleared === k) }))
  const unknown = rest.filter((r) => r.cleared === 'unknown')

  const reportedLanes = lanes.filter((l) => l.reports.length > 0)
  const weathers = [...rows.map((r) => r.c?.weather ?? null), ...lanes.map((l) => l.weather)]
  const checked = weathers.some((w) => !!w)
  const wintry = weathers.filter(isWintry)
  const most = wintry.reduce<(typeof wintry)[number] | null>((best, w) => (!best || w.snow_72h_cm > best.snow_72h_cm ? w : best), null)
  const reportCount = reported.reduce((n, r) => n + r.c!.reports.length, 0) + reportedLanes.reduce((n, l) => n + l.reports.length, 0)

  // The top line: what people reported, then how much snow, said once for the region.
  const snowPart = most
    ? locale === 'en'
      ? `${snowLine(most, now).replace(/^(\d+ inch(es)?|Under an inch)/, 'Up to $1')}.`
      : `${snowLine(most, now, locale, true)}.`
    : null
  // An empty answer means the call failed, not that nothing is known.
  const failed = conditions.size === 0
  const lede = failed ? tr('c.failed') : [
    reportCount > 0 ? tr(reportCount === 1 ? 'c.reports_one' : 'c.reports_other', { count: reportCount }) : null,
    snowPart,
    most && reportCount === 0 ? tr('c.no_reports_yet') : null,
    !most && reportCount === 0 ? (checked ? tr('c.no_snow') : tr('c.who_clears')) : null,
  ].filter(Boolean).join(' ')

  const mapTrails: ConditionsTrail[] = rows
    .filter((r) => (linesById.get(r.t.id)?.length ?? 0) > 0)
    .map((r) => ({
      id: r.t.id,
      name: r.t.name,
      lines: linesById.get(r.t.id)!,
      cleared: r.cleared,
      status: r.c?.reports[0]
        ? `${reportLine(r.c.reports[0], locale)}, ${timeOf(r.c.reports[0].rode_at, now, locale)}`
        : r.c?.winter ? clearedLabel(r.cleared, locale) : tr('c.status_unknown'),
      closed_lines: r.t.closed_lines,
      reports: (r.c?.reports ?? []).flatMap((rep) => (rep.line ?? []).map((line) => ({ line, condition: rep.condition }))),
    }))

  const mapLanes: ConditionsLane[] = lanes.map((l) => ({
    id: l.lane_id,
    name: `${l.name}, ${l.town}`,
    lines: l.lines,
    status: l.reports[0] ? `${reportLine(l.reports[0], locale)}, ${timeOf(l.reports[0].rode_at, now, locale)}` : tr('c.lane_status'),
    reports: l.reports.flatMap((rep) => (rep.line ?? []).map((line) => ({ line, condition: rep.condition }))),
  }))
  const laneTowns = [...new Set(lanes.map((l) => l.town))]
  const laneMiles = Math.round(lanes.reduce((n, l) => n + Number(l.miles), 0))

  const rowLink = 'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3.5 transition-colors hover:bg-navy/[0.02] sm:px-5'
  const card = 'divide-y divide-navy/[0.07] overflow-hidden rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]'

  // On phones the reports come before the map, so the first screen answers "how is it today?".
  const reportedList = (
    <div>
                    <h2 className="text-[1.125rem] font-semibold text-navy">{tr('c.reported_today')}</h2>
                    <ul className={`mt-2 ${card}`}>
                      {reported.map(({ t, c }) => (
                        <li key={t.id}>
                          <Link href={withLang(`/trails/${t.id}#winter`, locale)} className={rowLink}>
                            <span className="min-w-0">
                              <span className="block text-[1rem] font-semibold leading-snug text-navy">{t.name}</span>
                              {c!.reports.slice(0, 2).map((r, i) => (
                                <span key={i} className="mt-1 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                                  <i className="mt-[5px] inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CONDITION_COLOR[r.condition] }} aria-hidden />
                                  <span>{reportLine(r, locale)} · {timeOf(r.rode_at, now, locale)}</span>
                                </span>
                              ))}
                            </span>
                            <ArrowRight size={16} className="text-forest transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </Link>
                        </li>
                      ))}
                      {reportedLanes.map((l) => (
                        <li key={l.lane_id} className="px-4 py-3.5 sm:px-5">
                          <span className="block text-[1rem] font-semibold leading-snug text-navy">{tr('c.lane_name', { name: l.name, town: l.town })}</span>
                          {l.reports.slice(0, 2).map((r, i) => (
                            <span key={i} className="mt-1 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                              <i className="mt-[5px] inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CONDITION_COLOR[r.condition] }} aria-hidden />
                              <span>{reportLine(r, locale)} · {timeOf(r.rode_at, now, locale)}</span>
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
  )
  const anyReported = reported.length + reportedLanes.length > 0


  // The open feed described for search engines and dataset search (Google
  // Dataset Search reads this), so people and tools can find and reuse it.
  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Path and bike lane conditions in Massachusetts',
    description:
      'After snow, how rail trails, river paths and protected bike lanes across Massachusetts are, from people who used them in the last day, with recent snow at each and who clears each trail. Updated every 10 minutes. No personal data.',
    url: `${SITE_URL}/trails/conditions`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'Green Streets Initiative', url: SITE_URL },
    spatialCoverage: { '@type': 'Place', name: 'Massachusetts, United States' },
    distribution: { '@type': 'DataDownload', encodingFormat: 'application/geo+json', contentUrl: `${SITE_URL}/trails/conditions.json` },
  }

  return (
    <>
      <JsonLd data={datasetJsonLd} />
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-20 pt-6 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[1120px]">
            <p className="text-[0.9375rem]">
              <Link href={withLang('/trails', locale)} className="font-semibold text-forest underline-offset-4 hover:underline">{tr('c.crumb')}</Link>
            </p>
            <h1 className="mt-1 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">{tr('c.h1')}</h1>
            <p className="mt-2.5 flex max-w-[62ch] items-start gap-2 text-[1.0625rem] leading-[1.55] text-navy">
              {most && <Snowflake size={17} className="mt-[5px] shrink-0 text-ink-soft" aria-hidden />}
              <span>{lede}</span>
            </p>

            {/* Jump links: the lists run about six phone screens (polish 2026-11-04). */}
            <nav aria-label={tr('c.sections')} className="-mx-6 mt-4 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
              {[
                ...groups.filter((g) => g.rows.length > 0).map((g) => ({ href: `#w-${g.key}`, label: g.label, n: g.rows.length })),
                ...(!failed && unknown.length > 0 ? [{ href: '#w-unknown', label: tr('c.not_known'), n: unknown.length }] : []),
                ...(lanes.length > 0 ? [{ href: '#w-lanes', label: tr('c.bike_lanes'), n: null as number | null }] : []),
              ].map((x) => (
                <a
                  key={x.href}
                  href={x.href}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-navy/15 bg-white px-4 text-[0.9375rem] font-semibold text-navy transition-colors hover:border-navy/40"
                >
                  {x.label}
                  {x.n != null && <span className="text-[0.875rem] font-medium text-ink-soft">{x.n}</span>}
                </a>
              ))}
            </nav>

            {anyReported && <div className="mt-6 lg:hidden">{reportedList}</div>}

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
              <div className="lg:sticky lg:top-[84px]">
                <ConditionsMap trails={mapTrails} lanes={mapLanes} locale={locale} />
              </div>

              <div className="min-w-0 space-y-6">
                {anyReported && <div className="hidden lg:block">{reportedList}</div>}

                {groups.filter((g) => g.rows.length > 0).map((g) => (
                  <div key={g.key} id={`w-${g.key}`} className="scroll-mt-24">
                    <h2 className="text-[1.125rem] font-semibold text-navy">{g.heading}</h2>
                    <ul className={`mt-2 ${card}`}>
                      {g.rows.map(({ t, c }) => (
                        <li key={t.id}>
                          <Link href={withLang(`/trails/${t.id}#winter`, locale)} className={rowLink}>
                            <span className="min-w-0">
                              <span className="block text-[1rem] font-semibold leading-snug text-navy">{t.name}</span>
                              {c?.winter && <span className="mt-0.5 block text-[0.875rem] leading-snug text-ink-soft">{firstSentence(c.winter.note)}</span>}
                            </span>
                            <ArrowRight size={16} className="text-forest transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {!failed && unknown.length > 0 && (
                  <div id="w-unknown" className="scroll-mt-24">
                    <h2 className="text-[1.125rem] font-semibold text-navy">{tr('c.not_known')}</h2>
                    <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{tr('c.unknown_body')}</p>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {unknown.map(({ t }) => (
                        <li key={t.id}>
                          <Link
                            href={withLang(`/trails/${t.id}`, locale)}
                            className="inline-flex min-h-[40px] items-center rounded-full bg-white px-3.5 text-[0.875rem] font-semibold text-navy ring-1 ring-navy/10 transition-colors hover:ring-navy/30"
                          >
                            {t.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {lanes.length > 0 && (
                  <div id="w-lanes" className="scroll-mt-24">
                    <h2 className="text-[1.125rem] font-semibold text-navy">{tr('c.lanes_h2')}</h2>
                    <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">
                      {tr(laneTowns.length === 1 ? 'c.lanes_body_one' : 'c.lanes_body_other', { miles: laneMiles, count: laneTowns.length })}
                    </p>
                  </div>
                )}

                <p className="flex items-start gap-2 border-t border-navy/[0.08] pt-4 text-[0.875rem] leading-relaxed text-ink-soft">
                  <Download size={14} className="mt-[3px] shrink-0" aria-hidden />
                  <span>
                    <a href="/trails/conditions.json" className="font-semibold text-forest underline-offset-4 hover:underline">{tr('c.open_data_link')}</a>{' '}
                    {tr('c.open_data_rest')}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
