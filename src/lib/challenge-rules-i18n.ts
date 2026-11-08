/**
 * The workplace challenge rule sentences in the page's language, for the
 * public rules page (/shift/challenge/[id]) that the app opens with ?lang=.
 *
 * English is challenge-rules.ts itself, untouched: `challengeRulesFor('en')`
 * hands back its functions, so the English page, the portal, the flyer, the
 * nudge route and the assistant all keep the same sentences, and the parity
 * test with the app (node --test src/lib/challenge-rules.test.ts) still runs
 * on a file with no imports. The other languages follow the same rules with
 * the app's employer_challenge.rules words (strings: site-strings/challenges.ts).
 */
import {
  countingSentences,
  deliverySentence,
  dollars,
  drawingSentence,
  effectiveRules,
  eligibilitySentence,
  etDateRange,
  midSentence,
  orderSentence,
  prizeSentence,
  topSentence,
  type ChallengeRulesInput,
} from '@/lib/challenge-rules'
import { SITE_LOCALE_TAG, siteDate, translator, type SiteLocale } from '@/lib/site-i18n'
import { workplaceStrings } from '@/lib/site-strings/challenges'

export interface ChallengeRules {
  prizeSentence: (i: ChallengeRulesInput) => string
  drawingSentence: (i: ChallengeRulesInput, metric?: string | null) => string
  topSentence: (i: ChallengeRulesInput, metric: string | null | undefined) => string
  countingSentences: (i: ChallengeRulesInput) => string[]
  eligibilitySentence: (i: ChallengeRulesInput) => string | null
  orderSentence: () => string
  deliverySentence: (i: ChallengeRulesInput) => string
  etDateRange: (startIso: string, endIso: string) => string
}

const ENGLISH: ChallengeRules = {
  prizeSentence,
  drawingSentence,
  topSentence,
  countingSentences,
  eligibilitySentence,
  orderSentence,
  deliverySentence,
  etDateRange,
}

const ET = 'America/New_York'

export function challengeRulesFor(locale: SiteLocale): ChallengeRules {
  if (locale === 'en') return ENGLISH
  const t = translator(workplaceStrings, locale)

  // The translations put each list after a colon ("Cuentan: caminatas..."), so it isn't capitalized.
  const day = (iso: string) => siteDate(locale, iso, { month: 'short', day: 'numeric', timeZone: ET })
  const year = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', timeZone: ET })
  const num = (n: number) => n.toLocaleString(SITE_LOCALE_TAG[locale], { maximumFractionDigits: 1 })
  const sep = t('rl.list_sep')
  const listAnd = (items: string[]) =>
    items.length <= 1
      ? items.join('')
      : items.length === 2
        ? t('rl.list_and_two', { a: items[0], b: items[1] })
        : t('rl.list_and_many', { rest: items.slice(0, -1).join(sep), last: items[items.length - 1] })
  const listOr = (items: string[]) =>
    items.length <= 1 ? items.join('') : t('rl.list_or', { rest: items.slice(0, -1).join(sep), last: items[items.length - 1] })
  const trips = (n: number) => t(n === 1 ? 'rl.trips_one' : 'rl.trips_other', { count: n })
  const reward = (i: ChallengeRulesInput) =>
    i.funded && i.amountCents
      ? t('rl.gift_card', { amount: dollars(i.amountCents), employer: i.employer })
      : midSentence(i.description) || t('rl.prize_default', { employer: i.employer })

  const range = (startIso: string, endIso: string) => {
    const ys = year(startIso)
    const ye = year(endIso)
    if (day(startIso) === day(endIso) && ys === ye) return t('rl.range_day', { date: day(startIso), year: ys })
    return ys === ye
      ? t('rl.range_same', { start: day(startIso), end: day(endIso), year: ye })
      : t('rl.range_two', { start: day(startIso), ys, end: day(endIso), ye })
  }

  return {
    prizeSentence(i) {
      const one = i.spots === 1
      const vars = { spots: i.spots, trips: trips(i.goal), prize: reward(i) }
      if (i.metric === 'tried_new') {
        if (i.goal > 1) return t(one ? 'rl.new_n_one' : 'rl.new_n_other', vars)
        return t(one ? 'rl.new_1_one' : 'rl.new_1_other', vars)
      }
      return t(one ? 'rl.reach_one' : 'rl.reach_other', vars)
    },

    drawingSentence(i, metric) {
      const g = i.goal
      const vars = { n: num(g), date: day(i.endsAt) }
      const who = !(g > 0)
        ? t('rl.draw_all', vars)
        : metric === 'tried_new'
          ? t(g === 1 ? 'rl.draw_new_1' : 'rl.draw_new_n', vars)
          : metric === 'active_days'
            ? t(g === 1 ? 'rl.draw_days_1' : 'rl.draw_days_n', vars)
            : metric === 'miles'
              ? t(g === 1 ? 'rl.draw_miles_1' : 'rl.draw_miles_n', vars)
              : metric === 'pct_non_car'
                ? t('rl.draw_rate', vars)
                : t(g === 1 ? 'rl.draw_trips_1' : 'rl.draw_trips_n', vars)
      const win = t(i.spots === 1 ? 'rl.win_one' : 'rl.win_other', { n: i.spots, prize: reward(i) })
      return `${who}${locale === 'zh-Hans' ? '' : ' '}${win}`
    },

    topSentence(i, metric) {
      const m = metric === 'active_days' || metric === 'miles' || metric === 'pct_non_car' ? metric : 'trips'
      const vars = { n: i.spots, prize: reward(i) }
      return i.spots === 1 ? t(`rl.top_one_${m}`, vars) : t(`rl.top_other_${m}`, vars)
    },

    countingSentences(i) {
      const r = effectiveRules(i.rules)
      const out: string[] = []
      const parts: string[] = []
      if (r.modes.includes('walk')) {
        parts.push(
          r.min_walk_miles > 0
            ? t('rl.walks_min', { miles: t(r.min_walk_miles === 1 ? 'rl.miles_one' : 'rl.miles_other', { count: num(r.min_walk_miles) }) })
            : t('rl.walks'),
        )
      }
      if (r.modes.includes('bike')) parts.push(t('rl.bike'))
      if (r.modes.includes('escooter')) parts.push(t('rl.escooter'))
      if (r.modes.includes('carpool')) parts.push(t('rl.carpool'))
      const transit = (['transit_bus', 'transit_train', 'transit_commuter_rail', 'ferry'] as const)
        .filter((m) => r.modes.includes(m))
        .map((m) => t(`rl.${m}`))
      if (transit.length > 0) parts.push(t('rl.transit_trips', { list: listAnd(transit) }))
      out.push(t('rl.counts', { list: listAnd(parts) }))
      if (r.commute_only) {
        const where = (i.offices ?? r.offices.map((o) => o.address)).filter(Boolean)
        out.push(
          t(where.length > 1 ? 'rl.office_other' : 'rl.office_one', {
            employer: i.employer,
            where: where.length > 0 ? ` (${listOr(where)})` : '',
          }),
        )
      }
      const excluded = [t('rl.driving_alone')]
      if (!r.modes.includes('carpool')) excluded.push(t('rl.carpool'))
      if (!r.modes.includes('escooter')) excluded.push(t('rl.escooter'))
      out.push(t(excluded.length === 1 ? 'rl.excluded_one' : 'rl.excluded_other', { list: listAnd(excluded) }))
      out.push(
        r.max_trips_per_day == null
          ? t('rl.cap_none')
          : t(r.max_trips_per_day === 1 ? 'rl.cap_one' : 'rl.cap_other', { count: r.max_trips_per_day }),
      )
      out.push(t('rl.window', { start: day(i.startsAt), end: day(i.endsAt) }))
      out.push(t('rl.automatic'))
      out.push(t('rl.fix'))
      if (r.modes.includes('carpool')) out.push(t('rl.carpool_how'))
      return out
    },

    eligibilitySentence(i) {
      if (!i.requiresWorkEmail) return null
      const d = i.domains.length > 0 ? listOr(i.domains.map((x) => `@${x}`)) : t('rl.work')
      return t('rl.eligibility', { domains: d })
    },

    orderSentence: () => t('rl.order'),

    // One line per kind: the English names the prize ("Fleece winners tap
    // Claim..."); the translations say "the prize", as the app does.
    deliverySentence: (i) => (i.funded ? t('rl.delivery_funded') : t('rl.delivery_self', { employer: i.employer })),

    etDateRange: range,
  }
}
