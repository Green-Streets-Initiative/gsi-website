import Link from 'next/link'
import type { CampaignReports } from '@/content/sponsor-reports'
import { Section, SectionHeading } from './Section'

/*
 * Finalized campaign impact stats for Shift Your Summer 2026.
 * Source: Shift repo docs/reports/campaigns/sys-2026/postmortem.md, every
 * figure traced in appendix-queries.md. Keyed to the campaign slug so a
 * future year's wrap never prints 2026's numbers.
 *
 * "157 people who logged a trip" is a different basis from the 189 who joined
 * (see the sponsor report): 157 is everyone with a verified active trip, which
 * is the same population behind the 11,747 trips and 36,706 miles.
 */
const HIGHLIGHTS: Record<string, { value: string; label: string; detail: string }[]> = {
  'shift-your-summer-2026': [
    { value: '11,747', label: 'active trips', detail: 'by 157 people who logged a trip' },
    { value: '36,706', label: 'miles walked, biked, and ridden', detail: 'across Massachusetts' },
    { value: '13.9', label: 'metric tons CO₂ avoided', detail: 'equal to 634 trees’ annual absorption' },
    { value: '$25,694', label: 'saved on transportation', detail: 'money kept in participants’ pockets' },
    { value: '2,299', label: 'hours of active travel', detail: 'walking, biking, and riding transit' },
    { value: '38', label: 'prizes awarded', detail: 'across 17 brands' },
  ],
}

export function highlightsFor(report: CampaignReports | null) {
  return report ? HIGHLIGHTS[report.slug] ?? null : null
}

export function ImpactSection({ report }: { report: CampaignReports | null }) {
  const highlights = highlightsFor(report)
  if (!highlights) return null
  return (
    <Section shape="wanderRight" width="read">
      <SectionHeading
        title={
          <>
            What the summer <em className="text-green-deep">added up to.</em>
          </>
        }
        lede={`Two months of walking, biking, and riding transit across Massachusetts, ${report!.period}.`}
      />
      <dl className="grid gap-x-10 gap-y-7 border-y border-navy/15 py-8 sm:grid-cols-2 md:grid-cols-3">
        {highlights.map((h) => (
          <div key={h.label}>
            <dd className="font-serif text-[2.5rem] leading-none tracking-[-0.01em] text-navy">{h.value}</dd>
            <dt className="mt-2 text-[15px] font-semibold leading-snug text-navy">{h.label}</dt>
            <dd className="mt-0.5 text-[13px] text-ink-soft">{h.detail}</dd>
          </div>
        ))}
      </dl>
      {report?.wrap && (
        <p className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[13px] text-ink-soft">
          <span>Figures as of {report.asOf}.</span>
          <Link href={`/sponsors/${report.slug}`} className="font-semibold text-forest underline-offset-4 hover:underline">
            Read the full report &rarr;
          </Link>
        </p>
      )}
    </Section>
  )
}
