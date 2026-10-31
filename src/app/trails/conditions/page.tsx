import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Snowflake, Download } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ConditionsMap, { type ConditionsTrail } from '@/components/trails/ConditionsMap'
import { getTrails, type TrailSummary } from '@/lib/trails/queries'
import { getNetworkLines } from '@/lib/trails/geometry'
import { getPathConditions } from '@/lib/trails/conditions'
import { CLEARED_STYLE, CONDITION_COLOR, isWintry, type ClearedKey, reportLine, snowLine, timeOf, type TrailConditions } from '@/lib/trails/conditionText'

export const revalidate = 600

const SITE_URL = 'https://www.gogreenstreets.org'

export const metadata: Metadata = {
  title: 'Path conditions in Massachusetts: snow, ice and who clears each trail',
  description:
    'After snow, how rail trails and river paths across Massachusetts are, from people who used them, and who clears the snow on each.',
  alternates: { canonical: `${SITE_URL}/trails/conditions` },
  // Staged with /trails until launch.
  robots: { index: false, follow: false },
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
 * Then each path by who clears it. The same data is an open feed at
 * /trails/conditions.json.
 */
export default async function ConditionsPage() {
  const [trails, network, conditions] = await Promise.all([getTrails(), getNetworkLines(), getPathConditions()])
  const now = new Date()
  const linesById = new Map(network.map((n) => [n.id, n.lines]))

  const rows: Row[] = trails.map((t) => {
    const c = conditions.get(t.id) ?? null
    return { t, c, cleared: (c?.winter?.cleared ?? 'unknown') as ClearedKey }
  })
  const reported = rows.filter((r) => (r.c?.reports.length ?? 0) > 0)
  const rest = rows.filter((r) => !reported.includes(r))
  const groups = (['yes', 'partly', 'no'] as const).map((k) => ({ key: k, label: CLEARED_STYLE[k].label, rows: rest.filter((r) => r.cleared === k) }))
  const unknown = rest.filter((r) => r.cleared === 'unknown')

  const weathers = rows.map((r) => r.c?.weather ?? null)
  const checked = weathers.some((w) => !!w)
  const wintry = weathers.filter(isWintry)
  const most = wintry.reduce<(typeof wintry)[number] | null>((best, w) => (!best || w.snow_72h_cm > best.snow_72h_cm ? w : best), null)
  const reportCount = reported.reduce((n, r) => n + r.c!.reports.length, 0)

  // The top line: what people reported, then how much snow, said once for the region.
  const snowPart = most ? `${snowLine(most, now).replace(/^(\d+ inch(es)?|Under an inch)/, 'Up to $1')}.` : null
  // An empty answer means the call failed, not that nothing is known.
  const failed = conditions.size === 0
  const lede = failed ? 'Conditions are not available right now. Try again in a few minutes.' : [
    reportCount > 0 ? `${reportCount} ${reportCount === 1 ? 'report' : 'reports'} today from people who used these paths.` : null,
    snowPart,
    most && reportCount === 0 ? 'No reports from riders yet.' : null,
    !most && reportCount === 0 ? (checked ? 'No snow near these paths in the last three days.' : 'Who clears the snow on each path.') : null,
  ].filter(Boolean).join(' ')

  const mapTrails: ConditionsTrail[] = rows
    .filter((r) => (linesById.get(r.t.id)?.length ?? 0) > 0)
    .map((r) => ({
      id: r.t.id,
      name: r.t.name,
      lines: linesById.get(r.t.id)!,
      cleared: r.cleared,
      status: r.c?.reports[0]
        ? `${reportLine(r.c.reports[0])}, ${timeOf(r.c.reports[0].rode_at, now)}`
        : r.c?.winter ? CLEARED_STYLE[r.cleared].label : 'Who clears it is not known yet',
      closed_lines: r.t.closed_lines,
      reports: (r.c?.reports ?? []).flatMap((rep) => (rep.line ?? []).map((line) => ({ line, condition: rep.condition }))),
    }))

  const rowLink = 'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3.5 transition-colors hover:bg-navy/[0.02] sm:px-5'
  const card = 'divide-y divide-navy/[0.07] overflow-hidden rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]'

  // On phones the reports come before the map, so the first screen answers "how is it today?".
  const reportedList = (
    <div>
                    <h2 className="text-[1.125rem] font-semibold text-navy">Reported today</h2>
                    <ul className={`mt-2 ${card}`}>
                      {reported.map(({ t, c }) => (
                        <li key={t.id}>
                          <Link href={`/trails/${t.id}#winter`} className={rowLink}>
                            <span className="min-w-0">
                              <span className="block text-[1rem] font-semibold leading-snug text-navy">{t.name}</span>
                              {c!.reports.slice(0, 2).map((r, i) => (
                                <span key={i} className="mt-1 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                                  <i className="mt-[5px] inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CONDITION_COLOR[r.condition] }} aria-hidden />
                                  <span>{reportLine(r)} · {timeOf(r.rode_at, now)}</span>
                                </span>
                              ))}
                            </span>
                            <ArrowRight size={16} className="text-forest transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
  )

  return (
    <>
      <Nav variant="light" />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-20 pt-6 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[1120px]">
            <p className="text-[0.9375rem]">
              <Link href="/trails" className="font-semibold text-forest underline-offset-4 hover:underline">Trails and paths</Link>
            </p>
            <h1 className="mt-1 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">Path conditions</h1>
            <p className="mt-2.5 flex max-w-[62ch] items-start gap-2 text-[1.0625rem] leading-[1.55] text-navy">
              {most && <Snowflake size={17} className="mt-[5px] shrink-0 text-ink-soft" aria-hidden />}
              <span>{lede}</span>
            </p>

            {reported.length > 0 && <div className="mt-6 lg:hidden">{reportedList}</div>}

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
              <div className="lg:sticky lg:top-[84px]">
                <ConditionsMap trails={mapTrails} />
              </div>

              <div className="min-w-0 space-y-6">
                {reported.length > 0 && <div className="hidden lg:block">{reportedList}</div>}

                {groups.filter((g) => g.rows.length > 0).map((g) => (
                  <div key={g.key}>
                    <h2 className="text-[1.125rem] font-semibold text-navy">{g.label} in winter</h2>
                    <ul className={`mt-2 ${card}`}>
                      {g.rows.map(({ t, c }) => (
                        <li key={t.id}>
                          <Link href={`/trails/${t.id}#winter`} className={rowLink}>
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
                  <div>
                    <h2 className="text-[1.125rem] font-semibold text-navy">Not known yet</h2>
                    <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">
                      No town or agency says whether these are cleared:{' '}
                      {unknown.map(({ t }, i) => (
                        <span key={t.id}>
                          <Link href={`/trails/${t.id}`} className="font-semibold text-forest underline-offset-4 hover:underline">{t.name}</Link>
                          {i < unknown.length - 1 ? ', ' : '.'}
                        </span>
                      ))}
                    </p>
                  </div>
                )}

                <p className="flex items-start gap-2 border-t border-navy/[0.08] pt-4 text-[0.875rem] leading-relaxed text-ink-soft">
                  <Download size={14} className="mt-[3px] shrink-0" aria-hidden />
                  <span>
                    <a href="/trails/conditions.json" className="font-semibold text-forest underline-offset-4 hover:underline">Get these conditions as open data</a>{' '}
                    (GeoJSON), free to reuse with credit to Green Streets Initiative. Snow amounts from Open-Meteo. Map lines © OpenStreetMap contributors.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
