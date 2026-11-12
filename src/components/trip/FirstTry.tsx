'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import { ArrowRight, BookOpenText, Bicycle, Star, UsersThree } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import type { Novelty } from './useMyWays'

/**
 * Help for a first try, only when the way is new for that person (Keith
 * 2026-11-12: someone planning a trip mostly wants a safe, quick way, often in
 * a mode they use every week, so "Get directions" stays the main button for
 * everyone). Bike and transit only.
 *
 *   new      no trip that way in 60 days: someone to go with (Shift Together),
 *            an easy group ride or a first-ride guide, and the Try something
 *            new offer when their workplace runs one.
 *   unknown  signed out, or too few trips to tell: one quiet line, for the
 *            person who knows it's their first time.
 *   known    nothing.
 */
export default function FirstTry({ way, novelty, tryNew, hasBus, tt }: {
  way: 'bike' | 'transit'
  novelty: Novelty
  tryNew: { employer: string } | null
  hasBus: boolean
  tt: (k: string, v?: Record<string, string | number>) => string
}) {
  if (novelty === 'known') return null
  const track = (target: string) => posthog.capture('trip_first_try_clicked', { way, target, novelty })

  if (novelty === 'unknown') {
    return (
      <p className="mt-4 text-[15px]">
        <Link href="/together" onClick={() => track('together')} className="font-semibold text-(--nb-accent) hover:opacity-80">
          {tt('trip.first_maybe')} →
        </Link>
      </p>
    )
  }

  const rows: { key: string; href: string; icon: Icon; label: string }[] = way === 'bike'
    ? [
        { key: 'together', href: '/together', icon: UsersThree, label: tt('trip.first_together_bike') },
        { key: 'group_ride', href: '/events?level=easy', icon: Bicycle, label: tt('trip.first_group_ride') },
        { key: 'guide', href: '/guides/your-first-ride-in-a-bike-lane', icon: BookOpenText, label: tt('trip.first_guide_bike') },
      ]
    : [
        { key: 'together', href: '/together', icon: UsersThree, label: tt('trip.first_together_transit') },
        hasBus
          ? { key: 'guide', href: '/guides/your-first-bus-ride', icon: BookOpenText, label: tt('trip.first_guide_bus') }
          : { key: 'guide', href: '/guides/how-to-pay-for-the-t', icon: BookOpenText, label: tt('trip.first_guide_pay') },
      ]

  return (
    <section className="mt-5 rounded-xl bg-(--nb-panel) p-3.5" aria-labelledby="first-try-title">
      <h2 id="first-try-title" className="text-[16px] font-bold text-(--nb-ink)">
        {tt(way === 'bike' ? 'trip.first_title_bike' : 'trip.first_title_transit')}
      </h2>
      {tryNew && (
        <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-(--nb-ink)">
          <Star size={18} weight="fill" className="shrink-0 text-(--nb-accent)" aria-hidden="true" />
          {tt('trip.first_try_new', { employer: tryNew.employer })}
        </p>
      )}
      <ul className="mt-2 space-y-1">
        {rows.map(r => (
          <li key={r.key}>
            <Link
              href={r.href}
              onClick={() => track(r.key)}
              className="flex items-center gap-3 rounded-lg px-1.5 py-2 text-[15px] font-semibold text-(--nb-ink) hover:bg-(--nb-card)"
            >
              <r.icon size={22} className="shrink-0 text-(--nb-ink)" aria-hidden="true" />
              <span className="min-w-0 flex-1">{r.label}</span>
              <ArrowRight size={16} weight="bold" className="shrink-0 text-(--nb-ink-80)" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
