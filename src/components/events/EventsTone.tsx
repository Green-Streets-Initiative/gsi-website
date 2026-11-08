'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { SiteLocale } from '@/lib/site-i18n'
import { eventsT, type EventsT } from '@/lib/events-i18n'

/**
 * Which surface the /events tree (calendar + event detail) is painting on.
 * The components take their colors from the `--ev-*` variables
 * (events-tone.css: `.events-tone` is the app-dark original,
 * `.events-tone-light` the site's cream system); this context carries the
 * same choice to the places CSS can't reach — the category inks set inline,
 * the map pin — and the base path for links between the calendar and a
 * detail page, so a staged copy stays navigable end to end. It also carries
 * the page's language (translation plan, batch 5); anything rendered outside
 * a translated page reads English.
 */
export type EventsTone = 'dark' | 'light'

interface EventsToneContext {
  tone: EventsTone
  /** Where event links point: `/events` in production, `/preview/events` on the staged copy. */
  hrefBase: string
  locale: SiteLocale
}

const Ctx = createContext<EventsToneContext>({ tone: 'dark', hrefBase: '/events', locale: 'en' })

export function EventsToneProvider({ tone, hrefBase = '/events', locale = 'en', children }: { tone: EventsTone; hrefBase?: string; locale?: SiteLocale; children: ReactNode }) {
  return <Ctx.Provider value={{ tone, hrefBase, locale }}>{children}</Ctx.Provider>
}

export const useEventsTone = () => useContext(Ctx)

/** The page's language and its events strings. */
export function useEventsI18n(): { locale: SiteLocale; t: EventsT } {
  const { locale } = useContext(Ctx)
  return useMemo(() => ({ locale, t: eventsT(locale) }), [locale])
}

/** Root classes for the tree: the variables, and the light overrides when asked. */
export function toneClass(tone: EventsTone): string {
  return tone === 'light' ? 'events-tone events-tone-light' : 'events-tone'
}

/** The map marker on the detail page: lime pin on dark, navy pin on cream. */
export const PIN: Record<EventsTone, { fill: string; dot: string }> = {
  dark: { fill: '#BAF14D', dot: '#191A2E' },
  light: { fill: '#191A2E', dot: '#F4F8EE' },
}
