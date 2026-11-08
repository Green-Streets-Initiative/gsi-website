import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import TrackedLink from '@/components/TrackedLink'
import { CAMPAIGN_ICONS } from './icons'
import { dateRangeET, shortDateET } from '@/lib/campaigns/format'
import type { Promotable, PromotablePhase } from '@/lib/campaigns/types'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { hubStrings } from '@/lib/site-strings/challenges'

/*
 * One entry on /challenges. Rows with hairlines and dotted leaders, matching
 * the home page's audience index — a card grid would read as product UI on a
 * page that is meant to read as a programme listing.
 *
 * This component must never import @/lib/semester/campaign. The Semester
 * redemption code lives there, and the Promotable type deliberately carries
 * no field that could hold it; not importing the module keeps that true no
 * matter how the environment flag is set.
 *
 * `locale`: the hub's language. The registry's own copy (routes.ts: blurbs,
 * supply and gate labels, "Official rules") is translated by campaign slug;
 * an event the registry doesn't know keeps its database name and description.
 */

/** Registry slugs whose copy has translations. */
const KNOWN = ['walk-ride-day', 'shift-your-summer', 'semester', 'new-routes'] as const
type Known = (typeof KNOWN)[number]
const knownSlug = (p: Promotable): Known | null => {
  const slug = p.id.split(':')[1]
  return (KNOWN as readonly string[]).includes(slug) ? (slug as Known) : null
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-[13px] text-ink-soft">{label}</dt>
      <dd className="order-3 shrink-0 text-[13px] font-semibold text-navy">{value}</dd>
      <span className="order-2 min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-navy/30" />
    </div>
  )
}

export default function ChallengeRow({ p, phase, locale = 'en' }: { p: Promotable; phase: PromotablePhase; locale?: SiteLocale }) {
  const t = translator(hubStrings, locale)
  const en = locale === 'en'
  const slug = knownSlug(p)
  const facts: { label: string; value: string }[] = []

  if (p.kind === 'flagship') {
    facts.push({ label: phase === 'wrapped' ? t('row.ran') : t('row.when'), value: dateRangeET(p, locale) })
    facts.push({ label: t('row.where'), value: t('row.anywhere') })
    if (p.event?.sponsorName) facts.push({ label: t('row.supported'), value: p.event.sponsorName })
  } else if (p.mechanic) {
    const m = p.mechanic
    // "Sign up by", never "When" — a signup window is not an event window.
    facts.push({ label: phase === 'wrapped' ? t('row.signups_ran') : t('row.sign_up_by'), value: dateRangeET(p, locale) })
    facts.push({
      label: t('row.what_you_do'),
      value: t('row.trips_in_days', { trips: m.tripsRequired, days: m.windowDays }),
    })
    // A payload cached before rewardDollars existed has it undefined: keep its label.
    const reward = en || m.rewardDollars === undefined
      ? m.rewardLabel
      : m.rewardDollars ? t('row.reward_dollars', { amount: m.rewardDollars }) : t('row.reward_choice')
    facts.push({ label: t('row.what_you_get'), value: reward })
    const gate = !en && slug && (slug === 'semester' || slug === 'new-routes') && m.gateLabel ? t(`gate.${slug}`) : m.gateLabel
    const supply = !en && slug && (slug === 'semester' || slug === 'new-routes') && m.supplyLabel ? t(`supply.${slug}`) : m.supplyLabel
    if (gate) facts.push({ label: t('row.who'), value: gate })
    if (supply) facts.push({ label: t('row.how_many'), value: supply })
  }

  // Registry copy, translated by slug; a database description stays as written.
  const blurb = !en && slug && p.blurb ? t(`blurb.${slug}`) : p.blurb
  const secondaryLabel = !en && p.secondaryLabel === 'Official rules' ? t('row.official_rules') : p.secondaryLabel

  const nextDates = p.event?.seriesNextDates ?? []

  const CampaignIcon = CAMPAIGN_ICONS[p.icon]

  const body = (
    <>
      <span className="flex items-start gap-3">
        <CampaignIcon size={26} weight="regular" className="mt-1 shrink-0 text-forest" aria-hidden />
        <span className="font-serif text-[1.5rem] leading-tight text-navy">{p.shortTitle}</span>
      </span>
      <span className="block">
        {blurb && <span className="block text-[15px] leading-relaxed text-ink-soft">{blurb}</span>}
        <dl className="mt-3 flex flex-col gap-1.5">
          {facts.map((f) => (
            <Fact key={f.label} {...f} />
          ))}
        </dl>
        {nextDates.length > 0 && (
          <span className="mt-3 block text-[13px] text-ink-soft">
            {t('row.then', { dates: nextDates.map((d) => shortDateET(d, locale)).join(', ') })}
          </span>
        )}
      </span>
    </>
  )

  return (
    <li className="border-b border-navy/15">
      {p.href ? (
        <TrackedLink
          href={withLang(p.href, locale)}
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
          {p.secondaryHref && secondaryLabel && (
            <TrackedLink
              href={withLang(p.secondaryHref, locale)}
              placement="challenges_hub"
              destination={`${p.id}:secondary`}
              className="inline-flex min-h-[44px] items-center font-semibold text-forest underline-offset-4 hover:underline"
            >
              {secondaryLabel} &nbsp;&rarr;
            </TrackedLink>
          )}
          {!p.href && (
            <>
              <TrackedLink
                href={withLang('/shift', locale)}
                placement="challenges_hub"
                destination={`${p.id}:app`}
                className="inline-flex min-h-[44px] items-center font-semibold text-forest underline-offset-4 hover:underline"
              >
                {t('row.get_app')} &rarr;
              </TrackedLink>
              <TrackedLink
                href={withLang('/nearby', locale)}
                placement="challenges_hub"
                destination={`${p.id}:nearby`}
                className="inline-flex min-h-[44px] items-center font-semibold text-forest underline-offset-4 hover:underline"
              >
                {t('row.near_you')} &rarr;
              </TrackedLink>
            </>
          )}
        </div>
      )}
    </li>
  )
}
