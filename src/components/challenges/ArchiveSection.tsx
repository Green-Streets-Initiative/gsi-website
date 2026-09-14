import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import TrackedLink from '@/components/TrackedLink'
import { LANE, RouteSegment } from '@/components/home/RouteLine'
import { campaigns } from '@/content/sponsor-reports'

/*
 * Past campaigns with a written report. Sourced from the sponsor-reports
 * index, filtered to campaigns with a public wrap, so adding next year's
 * report to that index adds it here too. Figures are the report's own
 * summary rows, which are static by design: a report keeps saying what it
 * said when it was published.
 */

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-[13px] text-ink-soft">{label}</dt>
      <dd className="order-3 shrink-0 text-[13px] font-semibold text-navy">{value}</dd>
      <span aria-hidden className="order-2 min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-navy/30" />
    </div>
  )
}

export default function ArchiveSection() {
  const past = campaigns.filter((c) => c.wrap)
  if (!past.length) return null

  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderRight" />
        <div className="hidden md:block" />
        <div className="py-7 lg:py-8">
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">Past campaigns</h2>
          <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
            What each one added up to, with the full report.
          </p>
          <ul className="mt-6 border-t border-navy/15">
            {past.map((c) => {
              const year = c.period.slice(-4)
              return (
                <li key={c.slug} className="border-b border-navy/15">
                  <TrackedLink
                    href={`/sponsors/${c.slug}`}
                    placement="challenges_hub"
                    destination={`archive:${c.slug}`}
                    className="group grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2 py-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:grid-cols-[220px_1fr_auto]"
                  >
                    <span className="font-serif text-[1.5rem] leading-tight text-navy">
                      {c.name} {year}
                    </span>
                    <span className="col-span-2 block md:col-span-1">
                      <span className="block text-[15px] leading-relaxed text-ink-soft">{c.period}</span>
                      <dl className="mt-3 flex max-w-[420px] flex-col gap-1.5">
                        {c.wrap!.summary.slice(0, 3).map((r) => (
                          <Fact key={r.label} label={r.label} value={r.value} />
                        ))}
                      </dl>
                      <span className="mt-3 block text-[14px] font-semibold text-forest">Read the report</span>
                    </span>
                    <ArrowRight size={20} className="col-start-2 row-start-1 mt-1 text-forest transition-transform group-hover:translate-x-1 md:col-start-3" />
                  </TrackedLink>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
