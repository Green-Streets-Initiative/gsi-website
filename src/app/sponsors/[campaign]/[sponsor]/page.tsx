import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { allReportParams, findReport } from '@/content/sponsor-reports'
import type { Block } from '@/content/sponsor-reports'
import ReportTracking from './ReportTracking'

/**
 * Permanent, branded sponsor reports: /sponsors/<campaign>/<sponsor>.
 *
 * Content is static (see src/content/sponsor-reports), so the URL keeps
 * showing the sponsor exactly the figures we sent them. Pages are prerendered
 * and marked noindex — shareable by link, but not surfaced in search, since
 * they are addressed to one organization rather than the public.
 */

export async function generateStaticParams() {
  return allReportParams()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campaign: string; sponsor: string }>
}): Promise<Metadata> {
  const { campaign, sponsor } = await params
  const found = findReport(campaign, sponsor)
  if (!found) return { title: 'Sponsor report' }
  return {
    title: `${found.report.sponsor} — ${found.campaign.name} | Green Streets Initiative`,
    description: `What ${found.report.sponsor}'s support delivered across ${found.campaign.name}, ${found.campaign.period}.`,
    robots: { index: false, follow: false },
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/10 py-3.5 last:border-b-0">
      <span className="text-white/90">{label}</span>
      <span className="whitespace-nowrap font-display text-[22px] font-extrabold tracking-tight text-[#BAF14D] tabular-nums">
        {value}
      </span>
    </div>
  )
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === 'prose') {
    return (
      <>
        {block.paragraphs.map((p, i) => (
          <p key={i} className="mt-3 max-w-[64ch] text-white/90">
            {p}
          </p>
        ))}
      </>
    )
  }

  if (block.kind === 'stats') {
    return (
      <>
        {block.rows.length > 0 && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-6">
            {block.rows.map((r) => (
              <Stat key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        )}
        {block.note && (
          <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/75">{block.note}</p>
        )}
      </>
    )
  }

  if (block.kind === 'table') {
    return (
      <>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse tabular-nums">
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={h}
                    className={`border-b border-white/10 px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[#BAF14D] ${
                      i === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`border-b border-white/10 px-3 py-2.5 text-white/90 ${
                        ci === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {block.foot && (
              <tfoot>
                <tr>
                  {block.foot.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-3 py-2.5 font-display font-bold text-white ${
                        ci === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {block.note && (
          <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/75">{block.note}</p>
        )}
      </>
    )
  }

  if (block.kind === 'chart') {
    const max = Math.max(...block.bars.map((b) => b.value))
    return (
      <div className="mt-8">
        <h3 className="font-display text-[17px] font-bold tracking-tight text-white">
          {block.title}
        </h3>
        <div className="mt-5 flex h-[170px] items-end gap-2">
          {block.bars.map((b) => (
            <div key={b.label} className="flex h-full flex-1 flex-col justify-end gap-1.5">
              <span className="text-center font-display text-[11px] font-bold text-white tabular-nums">
                {b.value.toLocaleString()}
              </span>
              <div
                className={`rounded-t ${b.partial ? 'bg-[#2966E5]' : 'bg-[#BAF14D]'}`}
                style={{ height: `${(b.value / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {block.bars.map((b) => (
            <span key={b.label} className="flex-1 text-center text-[10.5px] text-white/80">
              {b.label}
            </span>
          ))}
        </div>
        {block.legend && (
          <p className="mt-3.5 text-sm text-white/80">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#2966E5] align-baseline" />
            {block.legend}
          </p>
        )}
      </div>
    )
  }

  // list
  return (
    <>
      {block.intro && <p className="mt-3 max-w-[64ch] text-white/90">{block.intro}</p>}
      <ul className="mt-4 max-w-[64ch] list-disc space-y-2.5 pl-5 text-white/90 marker:text-[#BAF14D]">
        {block.items.map((it) => (
          <li key={it.title}>
            <strong className="font-semibold text-white">{it.title}</strong> {it.body}
          </li>
        ))}
      </ul>
      {block.outro?.map((p, i) => (
        <p key={i} className="mt-3 max-w-[64ch] text-white/90">
          {p}
        </p>
      ))}
    </>
  )
}

export default async function SponsorReportPage({
  params,
}: {
  params: Promise<{ campaign: string; sponsor: string }>
}) {
  const { campaign: campaignSlug, sponsor: sponsorSlug } = await params
  const found = findReport(campaignSlug, sponsorSlug)
  if (!found) notFound()
  const { campaign, report } = found

  return (
    <div className="min-h-screen bg-[#191A2E]">
      <Nav />
      <ReportTracking campaign={campaign.slug} sponsor={report.slug} />

      <main className="mx-auto max-w-[820px] px-6 py-12 sm:py-16">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[#BAF14D]">
          Sponsor report · Campaign period {campaign.period}
        </p>
        <h1 className="mt-3 font-display text-[clamp(1.9rem,4.6vw,2.6rem)] font-extrabold leading-[1.08] tracking-tighter text-white text-balance">
          {report.heading}
        </h1>
        <p className="mt-4 max-w-[64ch] text-white/90">{report.intro}</p>

        <nav aria-label="Contents" className="mt-6 flex flex-wrap gap-2">
          {report.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 font-display text-[12.5px] font-semibold text-white/90 transition-colors hover:border-[#BAF14D] hover:text-[#BAF14D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BAF14D]"
            >
              {s.title}
            </a>
          ))}
        </nav>

        <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] px-6">
          {report.summary.map((r) => (
            <Stat key={r.label} label={r.label} value={r.value} />
          ))}
        </div>

        {report.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="mt-9 scroll-mt-6 border-t border-white/10 pt-8"
          >
            <h2 className="font-display text-[21px] font-bold tracking-tight text-white text-balance">
              {section.title}
            </h2>
            {section.blocks.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </section>
        ))}

        <p className="mt-10 border-t border-white/10 pt-6 text-sm text-white/75">
          Figures as of {campaign.asOf}. Questions about this report:{' '}
          <a
            href="mailto:info@gogreenstreets.org"
            className="text-[#BAF14D] underline underline-offset-2"
          >
            info@gogreenstreets.org
          </a>
        </p>
      </main>

      <Footer />
    </div>
  )
}
