'use client'

import { MatchCard } from '@/components/together/MatchCard'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { togetherStrings } from '@/lib/site-strings/together'
import type { Match, PartnerDay, PartnerKind } from '@/lib/together'

/**
 * The real match card with made-up sample data, marked "Example" (enrich
 * pass, Keith 2026-11-09): "Alex" is not a member, has no photo (an initial,
 * as for anyone without a public profile photo) and the card can't be
 * clicked. `side`: whose view it is, so a guide sees what a guide gets.
 */
const WEEKDAYS: PartnerDay[] = ['mon', 'tue', 'wed', 'thu', 'fri']

function sample(side: PartnerKind): Match {
  const other: Match['other'] = {
    first_name: 'Alex', modes: ['bike', 'transit'], shared_modes: ['bike'], days: WEEKDAYS, time_of_day: ['morning'], arrive_by: null,
    carpool_role: null, group_name: null, trips_60d: 34, avatar_url: null, member_since: '2025-05-01', status_name: null, primary_mode: 'bike',
    shared_groups: [], shared_days: WEEKDAYS, shared_times: ['morning'], my_days: WEEKDAYS, my_times: ['morning'], email: null, last_initial: null,
    languages: ['en', 'es'], shared_languages: ['en'],
  }
  const base = { id: 'example', status: 'proposed' as const, my_answer: null, their_answer: null, my_rating: null, created_at: '2026-11-01', connected_at: null }
  if (side === 'carpool') {
    return { ...base, kind: 'carpool', my_kind: 'carpool', home_miles: 1.2, dest_miles: 0.3, detour_minutes: 4, i_drive: false,
      other: { ...other, modes: [], shared_modes: [], trips_60d: null, primary_mode: 'drive', carpool_role: 'driver', arrive_by: '08:45' } }
  }
  if (side === 'guide') {
    // What a guide sees: someone nearby who wants to start.
    return { ...base, kind: 'guide', my_kind: 'guide', home_miles: 0.6, dest_miles: 0.4,
      other: { ...other, modes: ['bike'], trips_60d: 0, primary_mode: 'walk', member_since: '2026-10-01' } }
  }
  return { ...base, kind: 'guide', my_kind: 'newcomer', home_miles: 0.6, dest_miles: 0.4, other }
}

export default function ExampleMatch({ side = 'newcomer', locale = 'en', heading = true }: { side?: PartnerKind; locale?: SiteLocale; heading?: boolean }) {
  const t = translator(togetherStrings, locale)
  const noop = () => {}
  return (
    <section aria-label={t('matches.example_title')} className="grid grid-cols-1 gap-3">
      {heading ? (
        <div>
          <h2 className="font-display text-[22px] font-extrabold">{t('matches.example_title')}</h2>
          <p className="mt-1 text-[15px] text-(--ev-ink-80)">{t('matches.example_hint')}</p>
        </div>
      ) : null}
      <div className="relative">
        <span className="absolute -top-3 left-4 z-10 rounded-full bg-(--ev-ink) px-3 py-1 text-[13px] font-bold text-white">{t('how.example')}</span>
        {/* inert: the sample's buttons look real but do nothing and are skipped by keyboard and screen readers. */}
        <ul inert aria-hidden className="pointer-events-none grid grid-cols-1 select-none">
          <MatchCard m={sample(side)} locale={locale} t={t} busy={false} myArrive={side === 'carpool' ? '09:00' : null}
            onAnswer={noop} onWent={noop} onRate={noop} onEnd={noop} onReport={noop} />
        </ul>
        <p className="sr-only">{t('how.match_aria')}</p>
      </div>
    </section>
  )
}
