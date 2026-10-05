import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PrintButton from '@/app/events/shift-your-summer/flyer/PrintButton'
import { verifyEmployerReportToken } from '@/lib/employer-report-token'
import {
  isImpactRangeKey,
  impactWindow,
  dashboardRpcParams,
  formatCo2,
  formatPtsChange,
  windowLabelLong,
} from '@/lib/impact-range'
import { trendValues } from '@/lib/impact-sparkline'
import ShiftRateChart from '@/components/employer/ShiftRateChart'
import { changeRows, changeTone, comparisonPeriods } from '@/app/shift/employers/portal/_components/ChangeStrip'
import { peerRows, peerCountLine, PEER_COPY } from '@/app/shift/employers/portal/_components/PeerBenchmarkCard'
import { HOW_WE_COUNT, EPA_FACTOR_LINE, LEGACY_CO2_LINE } from '@/app/shift/employers/portal/_components/HowWeCountCard'
import { prettyMode } from '@/app/shift/employers/portal/_lib/portal-utils'
import type { DashboardData, PeerBenchmark } from '@/app/shift/employers/portal/_lib/portal-types'

export const metadata: Metadata = {
  title: 'Shift impact report',
  description: 'A printable impact report for a workplace on Shift.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export const dynamic = 'force-dynamic'

type GroupRow = {
  id: string
  name: string
  logo_url: string | null
  onboarding: { headcount?: number | null } | null
}

function param(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return raw && raw.length > 0 ? raw : null
}

/** Read once per request (the page is force-dynamic), outside the render body. */
function requestTime(): number {
  return Date.now()
}

const TONE_CLASS = { good: 'text-forest', bad: 'text-[#B3361F]', flat: 'text-ink-soft' } as const

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="street flex min-h-screen items-center justify-center bg-cream px-6 text-navy" style={{ fontFamily: 'var(--font-gsi)' }}>
      <div className="max-w-[480px] text-center">
        <h1 className="font-headline text-[28px] font-extrabold leading-tight">{title}</h1>
        <p className="mt-3 text-[16px] leading-[1.5] text-ink-soft">{body}</p>
      </div>
    </main>
  )
}

export default async function EmployerReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const groupId = param(params.group)
  const rangeRaw = param(params.range)
  const token = param(params.t)

  if (!groupId || !isImpactRangeKey(rangeRaw) || !token) {
    return (
      <Notice
        title="This report link isn't complete"
        body="Open the Impact page in your workplace portal and choose Print or save as PDF to get a fresh link."
      />
    )
  }
  const range = rangeRaw

  const verified = verifyEmployerReportToken(token, groupId)
  if (!verified.ok) {
    return (
      <Notice
        title={verified.error === 'expired' ? 'This report link has expired' : "This report link isn't valid"}
        body="Report links work for one hour. Open the Impact page in your workplace portal and choose Print or save as PDF to get a fresh one."
      />
    )
  }
  if (verified.payload.range !== range) {
    return (
      <Notice
        title="This report link isn't valid"
        body="The link was changed after it was made. Open the Impact page in your workplace portal and choose Print or save as PDF to get a fresh one."
      />
    )
  }

  const nowMs = requestTime()
  const win = impactWindow(range, nowMs)
  const supabase = createServerSupabaseClient()

  const [groupRes, dashRes, peerRes] = await Promise.all([
    supabase.from('groups').select('id, name, logo_url, onboarding').eq('id', groupId).maybeSingle(),
    supabase.rpc('get_employer_dashboard_data', dashboardRpcParams(groupId, win)),
    supabase.rpc('get_employer_peer_benchmark', { p_group_id: groupId, p_days: win.days }),
  ])

  const group = (groupRes.data ?? null) as GroupRow | null
  if (!group) {
    return <Notice title="Workplace not found" body="Email info@gogreenstreets.org if you were expecting a report here." />
  }
  const dashboard = dashRes.data as (DashboardData & { error?: string }) | null
  if (!dashboard || dashboard.error) {
    return (
      <Notice
        title="We couldn't load the numbers"
        body="Try the link again in a moment. If this keeps happening, email info@gogreenstreets.org."
      />
    )
  }
  const peerData = peerRes.data as (PeerBenchmark & { error?: string }) | null
  const benchmark: PeerBenchmark | null = peerRes.error || !peerData || peerData.error ? null : peerData

  // ── Figures ─────────────────────────────────────────────────────────
  const shiftRate = Math.round(dashboard.shift_rate_trip_pct)
  const prior = dashboard.prior_period ?? null
  const shiftRateChange = prior ? formatPtsChange(dashboard.shift_rate_trip_pct, prior.shift_rate_trip_pct) : null

  const totalTrips = dashboard.mode_breakdown.reduce((s, m) => s + m.trip_count, 0)
  const driveAlonePct =
    dashboard.drive_alone_share_pct != null
      ? Math.round(dashboard.drive_alone_share_pct)
      : totalTrips > 0
        ? Math.round(((dashboard.mode_breakdown.find((m) => m.mode === 'drive')?.trip_count ?? 0) / totalTrips) * 100)
        : null
  const driveAloneChange =
    prior && dashboard.drive_alone_share_pct != null
      ? formatPtsChange(dashboard.drive_alone_share_pct, prior.drive_alone_share_pct)
      : null

  const headcount = dashboard.headcount ?? group.onboarding?.headcount ?? null
  const participation = headcount
    ? {
        value: `${Math.round(dashboard.participation_pct ?? (dashboard.member_count / headcount) * 100)}%`,
        sub: `${dashboard.member_count} of about ${headcount} employees`,
      }
    : { value: String(dashboard.member_count), sub: 'employees joined · no headcount on file' }

  const emissions =
    dashboard.emissions_shifted_pct === undefined
      ? { value: '—', sub: 'Not available yet' }
      : dashboard.emissions_shifted_pct === null
        ? { value: '—', sub: 'Needs more recorded trips' }
        : {
            value: `${Math.round(dashboard.emissions_shifted_pct)}%`,
            sub: prior
              ? (() => {
                  const c = formatPtsChange(dashboard.emissions_shifted_pct, prior.emissions_shifted_pct)
                  return c ? `${c} vs previous ${win.days} days` : null
                })()
              : null,
          }

  // In plain words (Keith 2026-10-01): what the figure is, then how it is
  // worked out. The factors and their source are under How we count.
  const legacyCo2 = dashboard.co2_avoided_kg_v2 == null
  const co2Kg = legacyCo2 ? dashboard.co2_avoided_kg : dashboard.co2_avoided_kg_v2!
  const co2Lead = `${formatCo2(co2Kg)} of ${legacyCo2 ? 'CO₂' : 'CO₂e'} avoided.`
  const co2Line = legacyCo2
    ? 'What a gasoline car would have emitted driving the same miles.'
    : "The emissions of driving alone over the same miles, minus the emissions of the way people actually went. Walking and biking count as zero; for a bus or train trip we subtract that vehicle's emissions per rider."

  const rows = prior ? changeRows(dashboard, prior) : null
  const periods = prior ? comparisonPeriods(dashboard, prior, win.label, nowMs) : null

  const weeks = dashboard.weekly_shift_rates
  const hasTrend = trendValues(weeks) != null

  const milesByMode = dashboard.miles_by_mode ?? {}
  const modeMiles = (m: { mode: string; miles?: number }) => m.miles ?? milesByMode[m.mode] ?? null
  const totalMiles = dashboard.mode_breakdown.reduce((sum, m) => sum + (modeMiles(m) ?? 0), 0)
  const modes = [...dashboard.mode_breakdown]
    .sort((a, b) => b.trip_count - a.trip_count)
    .map((m) => {
      const miles = modeMiles(m)
      return {
        mode: m.mode,
        label: prettyMode(m.mode),
        count: m.trip_count,
        pct: totalTrips > 0 ? Math.round((m.trip_count / totalTrips) * 100) : 0,
        miles,
        milesPct: miles != null && totalMiles > 0 ? Math.round((miles / totalMiles) * 100) : null,
      }
    })
  const hasMiles = modes.some((m) => m.miles != null)
  const fmtMiles = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  const peers = peerRows(benchmark)

  const generated = new Date(nowMs).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })

  const headline = [
    { label: 'Shift Rate', value: `${shiftRate}%`, sub: shiftRateChange ? `${shiftRateChange} vs previous ${win.days} days` : null },
    {
      label: 'Drive-alone share',
      value: driveAlonePct != null ? `${driveAlonePct}%` : '—',
      sub: driveAloneChange ? `${driveAloneChange} vs previous ${win.days} days` : null,
    },
    { label: 'Participation', value: participation.value, sub: participation.sub },
    { label: 'Emissions shifted', value: emissions.value, sub: emissions.sub },
  ]

  // The street-sign look (Keith 2026-09-28): Overpass ExtraBold headline in
  // white on a borderless forest panel, everything else in Trebuchet, cream
  // page, navy text. Letter pages; each section keeps to one page.
  return (
    <main className="report-root street min-h-screen bg-cream text-navy" style={{ fontFamily: 'var(--font-gsi)' }}>
      <style>{`
        /* Zero page margin: browsers print their own header and footer (page
           title, the long report URL, page count) in the margin when there is
           room, which an employer has no use for (Keith 2026-10-01). The white
           space lives inside each page instead, and repeats on a page that
           runs onto a second sheet. */
        @page { size: letter; margin: 0; }
        @media print {
          .report-page { padding: 0.45in 0.55in; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
          .report-page + .report-page { margin-top: 0 !important; }
          .report-no-print { display: none !important; }
          .report-root { min-height: 0 !important; background: #fff !important; }
          body > :not(.report-root) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
          .report-article { padding: 0 !important; max-width: none !important; }
          .report-page + .report-page { break-before: page; }
          .report-section { break-inside: avoid; }
        }
        .report-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* On-screen print button */}
      <div className="report-no-print bg-navy px-5 py-4 text-white sm:px-8">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold">Impact report</p>
            <p className="text-xs text-white/85">Use Cmd/Ctrl-P or the button to print or save as PDF. This link works for one hour.</p>
          </div>
          <PrintButton />
        </div>
      </div>

      <article className="report-article mx-auto max-w-[8.5in] px-4 py-5 sm:px-8">
        {/* ── Page 1: cover, the headline four, the change table ── */}
        <div className="report-page">
          <header className="mb-4 flex items-center justify-between gap-4">
            <p className="text-[17px] leading-none">
              <span className="font-bold">Green Streets</span> Initiative
            </p>
            {group.logo_url && (
              <div className="flex h-[52px] items-center rounded-xl bg-white px-3.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={group.logo_url} alt={group.name} className="h-[34px] w-auto max-w-[170px] object-contain" />
              </div>
            )}
          </header>

          <section className="report-section rounded-[20px] bg-forest px-6 pb-7 pt-6 text-white sm:px-8">
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[17px] leading-snug">
              <span className="font-bold">{windowLabelLong(win.start, win.end)}</span>
              <span>{win.label}</span>
            </p>
            <h1 className="mt-3 font-headline text-[38px] font-extrabold leading-[1.02] tracking-[-0.01em] text-white sm:text-[44px]">
              {group.name} on Shift
            </h1>
            <p className="mt-4 max-w-[600px] text-[16px] leading-[1.5] text-white">
              What the trips Shift recorded for {group.name}&rsquo;s employees added up to. Employees who joined the
              workplace in the app; nothing is estimated for anyone else.
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {headline.map((h) => (
                <div key={h.label}>
                  <dt className="text-[13px] font-semibold text-white/85">{h.label}</dt>
                  <dd className="mt-1 font-headline text-[34px] font-extrabold leading-none text-white">{h.value}</dd>
                  {h.sub && <dd className="mt-1 text-[12.5px] leading-snug text-white/85">{h.sub}</dd>}
                </div>
              ))}
            </dl>
            <p className="mt-6 border-t border-white/30 pt-4 text-[15px] leading-[1.5] text-white">
              <span className="font-bold">{co2Lead}</span> {co2Line}
            </p>
          </section>

          {/* Sections with nothing to show stay off the page (Keith 2026-09-30). */}
          {rows && periods && (
            <section className="report-section mt-6">
              <h2 className="font-headline text-[24px] font-extrabold leading-tight">{periods.title}</h2>
              <p className="mt-1 text-[14px] text-ink-soft">Both periods counted by the same rules.</p>
              <table className="mt-3 w-full text-left text-[14.5px]">
                <thead>
                  <tr className="border-b-2 border-navy/20 align-bottom text-[12.5px] text-ink-soft">
                    <th className="py-2 pr-3 font-bold">Figure</th>
                    <th className="py-2 px-3 text-right font-normal">
                      <span className="block font-bold">{periods.before.name}</span>
                      {periods.before.dates}
                    </th>
                    <th className="py-2 px-3 text-right font-normal">
                      <span className="block font-bold text-navy">{periods.now.name}</span>
                      {periods.now.dates}
                    </th>
                    <th className="py-2 pl-3 text-right font-bold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-b border-navy/10 last:border-b-0">
                      <td className="py-2 pr-3 font-bold">{r.label}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-ink-soft">{r.before}</td>
                      <td className="py-2 px-3 text-right font-bold tabular-nums">{r.now}</td>
                      <td className={`py-2 pl-3 text-right font-bold tabular-nums ${TONE_CLASS[changeTone(r)]}`}>{r.change ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        {/* ── Page 2: trend and modes ── */}
        <div className="report-page mt-8">
          <section className="report-section">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-headline text-[24px] font-extrabold leading-tight">Shift Rate, week by week</h2>
              <span className="font-headline text-[18px] font-extrabold text-forest">
                {shiftRate}% for {win.label.charAt(0).toLowerCase() + win.label.slice(1)}
              </span>
            </div>
            <p className="mt-1 text-[14px] text-ink-soft">
              Each week&rsquo;s share of trips made by walking, biking, scooter or transit, over the last 12 weeks. A dash
              marks a week with no recorded trips.
            </p>
            {hasTrend && weeks ? (
              <div className="mt-3 rounded-[16px] bg-white px-3 pb-2 pt-4">
                <ShiftRateChart weeks={weeks} width={680} height={250} />
              </div>
            ) : (
              <p className="mt-3 rounded-[16px] bg-white p-6 text-center text-[15px] text-ink-soft">
                The trend appears after a few weeks of recorded trips.
              </p>
            )}
          </section>

          <section className="report-section mt-7">
            <h2 className="font-headline text-[24px] font-extrabold leading-tight">How people got around</h2>
            <p className="mt-1 text-[14px] text-ink-soft">
              {totalTrips.toLocaleString()} trips recorded · {dashboard.active_trips_this_period.toLocaleString()} active ·{' '}
              {dashboard.miles_shifted.toLocaleString('en-US', { maximumFractionDigits: 1 })} miles shifted
            </p>
            {modes.length > 0 ? (
              <>
              <table className="mt-3 w-full text-left text-[14.5px]">
                <thead>
                  <tr className="text-[12.5px] font-bold text-ink-soft">
                    <th className="pr-3 pt-2 font-bold" rowSpan={2}>
                      Mode
                    </th>
                    <th className="border-b border-navy/20 px-3 pt-2 text-center font-bold" colSpan={2}>
                      Trips
                    </th>
                    {hasMiles && (
                      <th className="border-b border-navy/20 pl-3 pt-2 text-center font-bold" colSpan={2}>
                        Miles
                      </th>
                    )}
                  </tr>
                  <tr className="border-b-2 border-navy/20 text-[12.5px] font-bold text-ink-soft">
                    <th className="px-3 py-1.5 text-right font-bold">Total</th>
                    <th className="px-3 py-1.5 text-right font-bold">Share</th>
                    {hasMiles && <th className="px-3 py-1.5 text-right font-bold">Total</th>}
                    {hasMiles && <th className="pl-3 py-1.5 text-right font-bold">Share</th>}
                  </tr>
                </thead>
                <tbody>
                  {modes.map((m) => (
                    <tr key={m.mode} className="border-b border-navy/10">
                      <td className="py-2 pr-3 font-bold">{m.label}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{m.count.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{m.pct}%</td>
                      {hasMiles && (
                        <td className="py-2 px-3 text-right tabular-nums">{m.miles != null ? fmtMiles(m.miles) : '—'}</td>
                      )}
                      {hasMiles && (
                        <td className="py-2 pl-3 text-right tabular-nums">{m.milesPct != null ? `${m.milesPct}%` : '—'}</td>
                      )}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-navy/20 font-bold">
                    <td className="py-2 pr-3">All modes</td>
                    <td className="py-2 px-3 text-right tabular-nums">{totalTrips.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums">100%</td>
                    {hasMiles && <td className="py-2 px-3 text-right tabular-nums">{fmtMiles(totalMiles)}</td>}
                    {hasMiles && <td className="py-2 pl-3 text-right tabular-nums">100%</td>}
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-[12.5px] leading-[1.5] text-ink-soft">
                Shares are rounded, so a column can add to slightly more or less than 100%.
              </p>
              </>
            ) : (
              <p className="mt-2 text-[15px] text-ink-soft">No trips recorded in this period.</p>
            )}
          </section>
        </div>

        {/* ── Page 3: peers, how we count, footer ── */}
        <div className="report-page mt-8">
          {peers && benchmark && !benchmark.too_few_peers && (
            <section className="report-section">
              <h2 className="font-headline text-[24px] font-extrabold leading-tight">Compared to other workplaces</h2>
              <p className="mt-1 text-[14px] text-ink-soft">
                {peerCountLine(benchmark)}.{!benchmark.you_qualify ? ` ${PEER_COPY.notQualified}` : ''}
              </p>
              <table className="mt-3 w-full text-left text-[14.5px]">
                <thead>
                  <tr className="border-b-2 border-navy/20 text-[12.5px] font-bold text-ink-soft">
                    <th className="py-2 pr-3 font-bold">Figure</th>
                    <th className="py-2 px-3 text-right font-bold">{group.name}</th>
                    <th className="py-2 px-3 text-right font-bold">Median</th>
                    <th className="py-2 pl-3 text-right font-bold">Standing</th>
                  </tr>
                </thead>
                <tbody>
                  {peers.map((r) => (
                    <tr key={r.label} className="border-b border-navy/10 last:border-b-0">
                      <td className="py-2 pr-3 font-bold">{r.label}</td>
                      <td className="py-2 px-3 text-right font-bold tabular-nums">{r.yours}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-ink-soft">{r.median}</td>
                      <td className="py-2 pl-3 text-right text-[13px] text-ink-soft">{r.standing ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[13px] leading-[1.5] text-ink-soft">{PEER_COPY.about}</p>
            </section>
          )}

          <section className="report-section mt-7 border-t-2 border-navy/15 pt-5">
            <h2 className="font-headline text-[24px] font-extrabold leading-tight">How we count</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {HOW_WE_COUNT.map((item) => (
                <div key={item.title}>
                  <dt className="text-[14px] font-bold">{item.title}</dt>
                  <dd className="mt-0.5 text-[13px] leading-[1.5] text-ink-soft">{item.body}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[12.5px] leading-[1.5] text-ink-soft">{legacyCo2 ? LEGACY_CO2_LINE : EPA_FACTOR_LINE}</p>
          </section>

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t-2 border-navy pt-3 text-[13.5px]">
            <p>
              <span className="font-bold">Green Streets</span> Initiative · a Massachusetts nonprofit · gogreenstreets.org
            </p>
            <p className="text-ink-soft">
              Prepared {generated} for {verified.payload.email}
            </p>
          </footer>
        </div>
      </article>
    </main>
  )
}
