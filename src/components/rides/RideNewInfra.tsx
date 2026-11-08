import { CalendarClock } from 'lucide-react'
import NewInfraRow from '@/components/new-infra/NewInfraRow'
import { comingWhen, type NewInfra } from '@/lib/new-infra'
import { todayKey } from '@/lib/organizers/ride-words'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

/**
 * "New on this route": lanes and paths the ride uses that opened in the last
 * six months, then street projects along it with a hearing coming (Shift 01577).
 * A ride with no drawn route gets the same for the half mile around its
 * meeting spot. Opened leads: it's the news a rider can use on the day.
 */
export default function RideNewInfra({ info, onRoute, locale = 'en' }: { info: NewInfra; onRoute: boolean; locale?: SiteLocale }) {
  const t = translator(ridesStrings, locale)
  const today = todayKey()
  return (
    <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4">
      <h2 className="text-[16px] font-bold text-(--ev-ink)">{onRoute ? t('new.route') : t('new.start')}</h2>
      {info.opened.length > 0 && (
        <ul className="mt-3 space-y-3">
          {info.opened.slice(0, 4).map((o) => (
            <li key={`${o.name}|${o.facility}`}>
              <NewInfraRow o={o} onRoute={onRoute} showTown tone="ride" />
            </li>
          ))}
        </ul>
      )}
      {info.coming.length > 0 && (
        <>
          <p className="mt-4 text-[14px] font-bold text-(--ev-ink)">{t('new.coming')}</p>
          <ul className="mt-2 space-y-3">
            {info.coming.slice(0, 3).map((c) => (
              <li key={c.id} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-ink-75)">
                  <CalendarClock size={17} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-(--ev-ink)">{c.what}</p>
                  <p className="mt-0.5 text-[14px] text-(--ev-ink-75)">
                    {comingWhen(c, today)}
                    {c.href && (
                      <>
                        {' · '}
                        <a href={c.href} className="font-semibold text-(--ev-accent) hover:underline">{t('new.weigh_in')}</a>
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-[14px] text-(--ev-ink-75)">
        {info.coming.length > 0 ? t('new.source_both') : t('new.source')}
      </p>
    </div>
  )
}
