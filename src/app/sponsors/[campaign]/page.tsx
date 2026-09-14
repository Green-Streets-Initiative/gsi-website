import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PageHero from '@/components/org/PageHero'
import { LANE } from '@/components/home/RouteLine'
import { campaigns, findCampaign } from '@/content/sponsor-reports'
import BlockView, { StatPanel } from '@/components/sponsor-report/BlockView'
import SectionNav from '@/components/sponsor-report/SectionNav'
import SponsorLogos from '@/components/SponsorLogos'
import { fetchPublicSponsorships } from '@/lib/sponsors/roll'

/**
 * Public campaign wrap: /sponsors/<campaign>.
 *
 * Unlike the per-sponsor reports, this page is public and indexable. It holds
 * only what is true for the whole campaign — impact, how prizes were awarded,
 * how we promoted it, what we learned, and the donor roll. Deliberately no
 * per-sponsor analytics: every donor can be sent this link without exposing
 * what any other donor's support returned.
 */

// Rebuild hourly so a sponsor's updated logo shows without a deploy.
export const revalidate = 3600

export async function generateStaticParams() {
  return campaigns.filter((c) => c.wrap).map((c) => ({ campaign: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campaign: string }>
}): Promise<Metadata> {
  const { campaign } = await params
  const found = findCampaign(campaign)
  if (!found?.wrap) return { title: 'Campaign report' }
  return {
    title: `${found.name} ${found.period.slice(-4)} results | Green Streets Initiative`,
    description: `What Massachusetts residents did during ${found.name}: 11,747 active trips, 36,706 miles, and 38 prizes from 19 local and national donors.`,
  }
}

export default async function CampaignWrapPage({
  params,
}: {
  params: Promise<{ campaign: string }>
}) {
  const { campaign: slug } = await params
  const campaign = findCampaign(slug)
  if (!campaign?.wrap) notFound()
  const wrap = campaign.wrap

  // Logos come from the same sponsorship rows the event page shows. The
  // written donor roll is the fallback if that read fails.
  const sponsorships = await fetchPublicSponsorships(campaign.competitionId)

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream">
        <PageHero eyebrow={`Campaign report · ${campaign.period}`} title={wrap.heading} lede={wrap.intro} />

        <div className={`mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
          <div className="hidden md:block" />
          <article className="max-w-[820px] pb-14 lg:pb-16">
            <SectionNav
              sections={[
                ...wrap.sections.map((s) => ({ id: s.id, title: s.navLabel ?? s.title })),
                { id: 'donors', title: 'Donors' },
              ]}
            />

            <StatPanel rows={wrap.summary} />

            {wrap.sections.map((section) => (
              <section key={section.id} id={section.id} className="mt-9 scroll-mt-[140px] border-t border-navy/15 pt-8">
                <h2 className="font-serif text-[clamp(1.5rem,3vw,2rem)] leading-[1.15] text-navy text-balance">{section.title}</h2>
                {section.blocks.map((block, i) => (
                  <BlockView key={i} block={block} />
                ))}
              </section>
            ))}

            <section id="donors" className="mt-9 scroll-mt-[140px] border-t border-navy/15 pt-8">
              <h2 className="font-serif text-[clamp(1.5rem,3vw,2rem)] leading-[1.15] text-navy">Thank you to our donors</h2>
              <p className="mt-3 max-w-[64ch] text-[1.0625rem] leading-[1.65] text-navy">
                Every prize in this campaign was donated. These businesses and organizations made {campaign.name} possible:
              </p>
              {sponsorships.length > 0 ? (
                <div className="mt-8">
                  <SponsorLogos sponsorships={sponsorships} utm={{ medium: 'campaign_report', campaign: campaign.slug }} />
                </div>
              ) : (
                wrap.donors.map((g) => (
                  <div key={g.group} className="mt-6">
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">{g.group}</h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {g.names.map((n) => (
                        <li key={n} className="rounded-full border border-navy/15 bg-white px-3.5 py-1.5 text-[14px] text-navy">
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>

            <p className="mt-10 border-t border-navy/15 pt-6 text-[14px] text-ink-soft">
              Figures as of {campaign.asOf}. Questions:{' '}
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
