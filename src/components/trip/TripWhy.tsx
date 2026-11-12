import { Bicycle, NavigationArrow, Rows, UsersThree } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'

/**
 * Why plan here (Keith 2026-11-12: "why would someone use this vs. other
 * tools?"). Shown before a trip is planned, so it is also what search engines
 * and assistants read on /trip. Says what this page adds, then hands off to
 * the maps app people already use for turn-by-turn.
 */
export default function TripWhy({ tt }: { tt: (k: string) => string }) {
  const items: { key: string; icon: Icon }[] = [
    { key: 'calm', icon: Bicycle },
    { key: 'all', icon: Rows },
    { key: 'help', icon: UsersThree },
    { key: 'maps', icon: NavigationArrow },
  ]
  return (
    <section className="mt-8" aria-labelledby="trip-why-title">
      <h2 id="trip-why-title" className="text-[18px] font-bold text-(--nb-ink)">{tt('trip.why_title')}</h2>
      <ul className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {items.map(({ key, icon: I }) => (
          <li key={key} className="flex gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--nb-panel)">
              <I size={20} className="text-(--nb-accent)" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-(--nb-ink)">{tt(`trip.why_${key}`)}</span>
              <span className="block text-[15px] leading-snug text-(--nb-ink-80)">{tt(`trip.why_${key}_sub`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
