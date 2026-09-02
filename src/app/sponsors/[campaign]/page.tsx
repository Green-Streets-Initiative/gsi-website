import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { campaigns, findCampaign } from '@/content/sponsor-reports'
import BlockView, { StatPanel } from '@/components/sponsor-report/BlockView'

/**
 * Public campaign wrap: /sponsors/<campaign>.
 *
 * Unlike the per-sponsor reports, this page is public and indexable. It holds
 * only what is true for the whole campaign — impact, how prizes were awarded,
 * how we promoted it, what we learned, and the donor roll. Deliberately no
 * per-sponsor analytics: every donor can be sent this link without exposing
 * what any other donor's support returned.
 */

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

  return (
    <div className="min-h-screen bg-[#191A2E]">
      <Nav />
      <main className="mx-auto max-w-[820px] px-6 py-12 sm:py-16">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[#BAF14D]">
          Campaign report · {campaign.period}
        </p>
        <h1 className="mt-3 font-display text-[clamp(1.9rem,4.6vw,2.6rem)] font-extrabold leading-[1.08] tracking-tighter text-white text-balance">
          {wrap.heading}
        </h1>
        <p className="mt-4 max-w-[64ch] text-white/90">{wrap.intro}</p>

        <StatPanel rows={wrap.summary} />

        {wrap.sections.map((section) => (
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

        <section className="mt-9 border-t border-white/10 pt-8">
          <h2 className="font-display text-[21px] font-bold tracking-tight text-white">
            Thank you to our donors
          </h2>
          <p className="mt-3 max-w-[64ch] text-white/90">
            Every prize in this campaign was donated. These businesses and organizations made
            Shift Your Summer possible:
          </p>
          {wrap.donors.map((g) => (
            <div key={g.group} className="mt-6">
              <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[#BAF14D]">
                {g.group}
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {g.names.map((n) => (
                  <li
                    key={n}
                    className="rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[14px] text-white/90"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <p className="mt-10 border-t border-white/10 pt-6 text-sm text-white/75">
          Figures as of {campaign.asOf}. Questions:{' '}
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
