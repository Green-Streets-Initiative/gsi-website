import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PageHero from '@/components/org/PageHero'
import { LANE } from '@/components/home/RouteLine'
import { allReportParams, findReport } from '@/content/sponsor-reports'
import ReportTracking from './ReportTracking'
import BlockView, { StatPanel } from '@/components/sponsor-report/BlockView'
import { fetchFulfillment } from '@/content/sponsor-reports/fulfillment'
import { resolveLiveStats } from '@/content/sponsor-reports/resolve-live'
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

// Rebuild hourly so live fulfillment figures stay current without a deploy.
export const revalidate = 3600

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
  const { campaign, report: staticReport } = found

  // Fulfillment keeps moving after a campaign closes, so those few figures are
  // read live. Everything else stays exactly as published. A failed lookup
  // falls back to the written values rather than blanking the page.
  const fulfillment = await fetchFulfillment(campaign.competitionId)
  const report = resolveLiveStats(staticReport, fulfillment)

  return (
    <>
      <Nav variant="light" />
      <ReportTracking campaign={campaign.slug} sponsor={report.slug} />
      <main className="bg-cream">
        <PageHero eyebrow={`Sponsor report · ${campaign.period}`} title={report.heading} lede={report.intro} />

        <div className={`mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
          <div className="hidden md:block" />
          <article className="max-w-[820px] pb-14 lg:pb-16">
            <SectionNav sections={report.sections.map((s) => ({ id: s.id, title: s.navLabel ?? s.title }))} />

            <StatPanel rows={report.summary} />

            {report.sections.map((section) => (
              <section key={section.id} id={section.id} className="mt-9 scroll-mt-[140px] border-t border-navy/15 pt-8">
                <h2 className="font-serif text-[clamp(1.5rem,3vw,2rem)] leading-[1.15] text-navy text-balance">{section.title}</h2>
                {section.blocks.map((block, i) => (
                  <BlockView key={i} block={block} />
                ))}
              </section>
            ))}

            <p className="mt-10 border-t border-navy/15 pt-6 text-[14px] text-ink-soft">
              Figures as of {campaign.asOf}. Questions about this report:{' '}
              <a href="mailto:info@gogreenstreets.org" className="font-semibold text-forest underline underline-offset-2">
                info@gogreenstreets.org
              </a>
            </p>
          </article>
        </div>
      </main>
      <Footer variant="light" />
    </>
  )
}
