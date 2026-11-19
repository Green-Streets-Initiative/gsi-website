'use client'

import { Plus, Trash2 } from 'lucide-react'
import { routeOptionName } from '@/lib/rides/public'
import { routeMiles } from '@/lib/organizers/route-geo'
import { draftOf } from '@/lib/organizers/saved-route'
import type { LatLng, RouteDraft, RouteOption } from '@/lib/organizers/types'
import RouteSection from './RouteSection'
import { Button, Field, Input } from './ui'

/**
 * More than one route on the same ride or date (Shift 01868): Walk 'N Mass
 * walks a 5K and a 10K, Charles River Wheelers rides 25, 34 and 47 miles from
 * the same start. The main route (the one above this) keeps the live map and
 * the street colors; these are shown beside it with their own map and
 * distance. Up to two more.
 */
export interface OptionDraft {
  /** Keeps each option's route tool mounted as its own. Not saved. */
  key: string
  name: string
  route: RouteDraft | null
}

export const MAX_ROUTE_OPTIONS = 2

const newKey = () => Math.random().toString(36).slice(2, 10)

/** Saved options, as the editor holds them. */
export function optionsOf(opts: RouteOption[] | null | undefined): OptionDraft[] {
  return (opts ?? []).slice(0, MAX_ROUTE_OPTIONS).map((o) => ({
    key: newKey(),
    name: o.name ?? '',
    route: draftOf({
      route_waypoints: o.route_waypoints, route_pins: null, route_flags: null, comfort_segments: null,
      comfort_rating: null, comfort_summary: null, route_elevation: o.route_elevation,
    }),
  }))
}

/** The options as both saves take them. Options without a route are left out (the form asks for one first). */
export function optionsPayload(opts: OptionDraft[]): RouteOption[] {
  return opts.filter((o) => (o.route?.waypoints.length ?? 0) >= 2).map((o) => ({
    name: o.name.trim() || null,
    route_waypoints: o.route!.waypoints,
    route_miles: Math.round(routeMiles(o.route!.waypoints) * 10) / 10,
    route_elevation: o.route!.elevation ?? null,
  }))
}

/** What's missing before the options can save, or null. */
export function optionsProblem(opts: OptionDraft[]): string | null {
  const i = opts.findIndex((o) => (o.route?.waypoints.length ?? 0) < 2)
  return i < 0 ? null : `Add a route for route option ${i + 2}, or remove it`
}

export default function RouteOptions({ mainName, onMainName, mainRoute, options, onOptions, meetup, pace, activity }: {
  mainName: string
  onMainName: (v: string) => void
  /** The route above; options are offered once there is one. */
  mainRoute: RouteDraft | null
  options: OptionDraft[]
  onOptions: (next: OptionDraft[]) => void
  meetup: (LatLng & { label?: string }) | null
  pace: string | null
  activity: 'bike' | 'walk'
}) {
  if (!mainRoute) return null
  const walk = activity === 'walk'
  const mainDefault = routeOptionName(null, routeMiles(mainRoute.waypoints), walk)
  const update = (i: number, patch: Partial<OptionDraft>) => onOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))

  return (
    <div className="mt-5 grid gap-4 border-t border-(--ev-line) pt-5">
      <div>
        <p className="text-[16px] font-semibold text-(--ev-ink)">More than one distance?</p>
        <p className="mt-0.5 text-[15px] text-(--ev-ink-80)">
          Add up to two more routes from the same start{walk ? ', like a 5K and a 10K' : ', like 25, 34 and 47 miles'}. People see each one with its map and distance, and pick theirs. The live map follows the route above.
        </p>
      </div>
      {options.length > 0 && (
        <Field label="Name of the route above" htmlFor="route-main-name" optional hint={`Empty shows “${mainDefault}”.`}>
          <Input id="route-main-name" value={mainName} maxLength={60} onChange={(e) => onMainName(e.target.value)} placeholder={mainDefault} className="max-w-[320px]" />
        </Field>
      )}
      {options.map((o, i) => {
        const miles = o.route ? routeMiles(o.route.waypoints) : null
        return (
          <div key={o.key} className="grid gap-3 rounded-xl border border-(--ev-line-mid) bg-(--ev-panel-faint) p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[16px] font-semibold text-(--ev-ink)">Route option {i + 2}{o.route ? `: ${routeOptionName(o.name, miles, walk)}` : ''}</p>
              <Button size="sm" variant="ghost" onClick={() => onOptions(options.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" aria-hidden />Remove
              </Button>
            </div>
            <Field label="Name" htmlFor={`route-opt-${o.key}`} optional
              hint={miles != null ? `Empty shows “${routeOptionName(null, miles, walk)}”.` : `Like “${walk ? '10K' : 'Long route'}”. Empty shows its distance.`}>
              <Input id={`route-opt-${o.key}`} value={o.name} maxLength={60} onChange={(e) => update(i, { name: e.target.value })} className="max-w-[320px]" />
            </Field>
            <RouteSection route={o.route} onRoute={(r) => update(i, { route: r })} meetup={meetup} pace={pace} activity={activity} />
          </div>
        )
      })}
      {options.length < MAX_ROUTE_OPTIONS && (
        <Button size="sm" className="w-fit" onClick={() => onOptions([...options, { key: newKey(), name: '', route: null }])}>
          <Plus className="h-4 w-4" aria-hidden />Add another route
        </Button>
      )}
    </div>
  )
}
