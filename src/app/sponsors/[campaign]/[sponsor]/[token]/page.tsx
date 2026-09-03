import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { allReportParams, findReport } from '@/content/sponsor-reports'
import ReportTracking from './ReportTracking'
import BlockView, { StatPanel } from '@/components/sponsor-report/BlockView'
import SectionNav from '@/components/sponsor-report/SectionNav'

/**
 * Permanent, branded sponsor reports:
 * /sponsors/<campaign>/<sponsor>/<token>.
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
  params: Promise<{ campaign: string; sponsor: string; token: string }>
}): Promise<Metadata> {
  const { campaign, sponsor, token } = await params
  const found = findReport(campaign, sponsor, token)
  if (!found) return { title: 'Sponsor report' }
  return {
    title: `${found.report.sponsor} — ${found.campaign.name} | Green Streets Initiative`,
    description: `What ${found.report.sponsor}'s support delivered across ${found.campaign.name}, ${found.campaign.period}.`,
    robots: { index: false, follow: false },
  }
}

export default async function SponsorReportPage({
  params,
}: {
  params: Promise<{ campaign: string; sponsor: string; token: string }>
}) {
  const { campaign: campaignSlug, sponsor: sponsorSlug, token } = await params
  const found = findReport(campaignSlug, sponsorSlug, token)
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

        <SectionNav sections={report.sections.map((s) => ({ id: s.id, title: s.navLabel ?? s.title }))} />

        <StatPanel rows={report.summary} />

        {report.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="mt-9 scroll-mt-[140px] border-t border-white/10 pt-8"
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
