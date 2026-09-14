import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import TrackedLink from '@/components/TrackedLink'
import { CAMPAIGN_ICONS } from './icons'
import { dateRangeET, shortDateET } from '@/lib/campaigns/format'
import type { Promotable, PromotablePhase } from '@/lib/campaigns/types'

/*
 * One entry on /challenges. Rows with hairlines and dotted leaders, matching
 * the home page's audience index — a card grid would read as product UI on a
 * page that is meant to read as a programme listing.
 *
 * This component must never import @/lib/semester/campaign. The Semester
 * redemption code lives there, and the Promotable type deliberately carries
 * no field that could hold it; not importing the module keeps that true no
 * matter how the environment flag is set.
 */

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-[13px] text-ink-soft">{label}</dt>
      <dd className="order-3 shrink-0 text-[13px] font-semibold text-navy">{value}</dd>
      <span className="order-2 min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-navy/30" />
    </div>
  )
}

export default function ChallengeRow({ p, phase }: { p: Promotable; phase: PromotablePhase }) {
  const facts: { label: string; value: string }[] = []

  if (p.kind === 'flagship') {
    facts.push({ label: phase === 'wrapped' ? 'Ran' : 'When', value: dateRangeET(p) })
    facts.push({ label: 'Where', value: 'Anywhere in Massachusetts' })
    if (p.event?.sponsorName) facts.push({ label: 'Supported by', value: p.event.sponsorName })
  } else if (p.mechanic) {
    // "Sign up by", never "When" — a signup window is not an event window.
    facts.push({ label: phase === 'wrapped' ? 'Signups ran' : 'Sign up by', value: dateRangeET(p) })
    facts.push({
      label: 'What you do',
      value: `${p.mechanic.tripsRequired} trips in ${p.mechanic.windowDays} days`,
    })
    facts.push({ label: 'What you get', value: p.mechanic.rewardLabel })
    if (p.mechanic.gateLabel) facts.push({ label: 'Who it is for', value: p.mechanic.gateLabel })
    if (p.mechanic.supplyLabel) facts.push({ label: 'How many', value: p.mechanic.supplyLabel })
  }

  const nextDates = p.event?.seriesNextDates ?? []

  const CampaignIcon = CAMPAIGN_ICONS[p.icon]

  const body = (
    <>
      <span className="flex items-start gap-3">
        <CampaignIcon size={26} weight="regular" className="mt-1 shrink-0 text-forest" aria-hidden />
        <span className="font-serif text-[1.5rem] leading-tight text-navy">{p.shortTitle}</span>
      </span>
      <span className="block">
        {p.blurb && <span className="block text-[15px] leading-relaxed text-ink-soft">{p.blurb}</span>}
        <dl className="mt-3 flex flex-col gap-1.5">
          {facts.map((f) => (
            <Fact key={f.label} {...f} />
          ))}
        </dl>
        {nextDates.length > 0 && (
          <span className="mt-3 block text-[13px] text-ink-soft">
            Then {nextDates.map((d) => shortDateET(d)).join(', ')}.
          </span>
        )}
      </span>
    </>
  )

  return (
    <li className="border-b border-navy/15">
      {p.href ? (
        <TrackedLink
          href={p.href}
          placement="challenges_hub"
          destination={p.id}
          className="group grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2 py-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:grid-cols-[220px_1fr_auto]"
        >
          {body}
          <ArrowRight
            size={20}
            className="col-start-2 row-start-1 mt-1 text-forest transition-transform group-hover:translate-x-1 md:col-start-3"
          />
        </TrackedLink>
      ) : (
        <div className="grid grid-cols-1 items-start gap-x-4 gap-y-2 py-7 md:grid-cols-[220px_1fr]">{body}</div>
      )}

      {/* Secondary and fallback links sit outside the row link, so a campaign
          with no page of its own is still actionable rather than a dead end. */}
      {(p.secondaryHref || !p.href) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 pb-6 text-[14px] md:pl-[236px]">
          {p.secondaryHref && p.secondaryLabel && (
            <TrackedLink
              href={p.secondaryHref}
              placement="challenges_hub"
              destination={`${p.id}:secondary`}
              className="inline-flex min-h-[44px] items-center font-semibold text-forest underline-offset-4 hover:underline"
            >
              {p.secondaryLabel} &nbsp;&rarr;
            </TrackedLink>
          )}
          {!p.href && (
            <>
              <TrackedLink
                href="/shift"
                placement="challenges_hub"
                destination={`${p.id}:app`}
                className="inline-flex min-h-[44px] items-center font-semibold text-forest underline-offset-4 hover:underline"
              >
                Get the Shift app &rarr;
              </TrackedLink>
              <TrackedLink
                href="/nearby"
                placement="challenges_hub"
                destination={`${p.id}:nearby`}
                className="inline-flex min-h-[44px] items-center font-semibold text-forest underline-offset-4 hover:underline"
              >
                See what is near you &rarr;
              </TrackedLink>
            </>
          )}
        </div>
      )}
    </li>
  )
}
