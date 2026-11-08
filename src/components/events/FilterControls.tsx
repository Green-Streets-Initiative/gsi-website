'use client'

import { Navigation } from 'lucide-react'
import {
  EVENT_TYPES, TYPE_FILTER_ORDER,
  RIDE_STYLE_ORDER, styleFilterValue,
} from '@/lib/events'
import { typeLabel, tagLabel, rideLevelFilterLabel, rideLevelBlurb, placeLabel, plural, ownNameRepeats } from '@/lib/events-i18n'
import type { EventsKey } from '@/lib/site-strings/events'
import { typeInk, rideStyleInk } from '@/lib/events-tone'
import { useEventsTone, useEventsI18n } from './EventsTone'
import CityAutocomplete from './CityAutocomplete'
import {
  DISTANCE_OPTIONS, WHEN_OPTIONS, GOOD_FOR_TAGS, AUDIENCE_TAGS, languageFilterLabel,
  type DistanceValue, type WhenValue, type GeoStatus, type UserLoc,
} from './useEventFilters'
import { languageLabel, type PartnerLanguage } from '@/lib/languages'

/**
 * The individual filter controls, shared by the phone filters sheet and the
 * desktop filter bar popovers so both always offer the same choices.
 */

export const pillClass = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
    active ? 'border-(--ev-accent-line) text-(--ev-accent)' : 'border-(--ev-line-mid) text-(--ev-ink-78) hover:bg-(--ev-panel)'
  }`

const rowClass = (active: boolean) =>
  `flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
    active ? 'border border-(--ev-accent-line-30) bg-(--ev-accent-tint) text-(--ev-accent)' : 'text-(--ev-ink-85) hover:bg-(--ev-panel)'
  }`

// --- When ---

export function WhenPills({ value, onChange }: { value: WhenValue; onChange: (v: WhenValue) => void }) {
  const { t } = useEventsI18n()
  return (
    <div className="flex flex-wrap gap-1.5">
      {WHEN_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className={pillClass(value === opt.value)}>
          {t(`when.${opt.value}` as EventsKey)}
        </button>
      ))}
    </div>
  )
}

export function WhenList({ value, onChange }: { value: WhenValue; onChange: (v: WhenValue) => void }) {
  const { t } = useEventsI18n()
  return (
    <div className="flex flex-col gap-0.5">
      {WHEN_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className={rowClass(value === opt.value)}>
          {t(`when.${opt.value}` as EventsKey)}
        </button>
      ))}
    </div>
  )
}

// --- Near ---

export function DistancePills({ value, onChange }: { value: DistanceValue; onChange: (v: DistanceValue) => void }) {
  const { t } = useEventsI18n()
  return (
    <div className="flex flex-wrap gap-1.5">
      {DISTANCE_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className={pillClass(value === opt.value)}>
          {t(`dist.${opt.value}` as EventsKey)}
        </button>
      ))}
    </div>
  )
}

interface LocationControlProps {
  geoStatus: GeoStatus
  userLoc: UserLoc
  initialCity?: string
  onUseMyLocation: () => void
  onCitySelect: (loc: UserLoc) => void
}

export function LocationControl({ geoStatus, userLoc, initialCity, onUseMyLocation, onCitySelect }: LocationControlProps) {
  const { locale, t } = useEventsI18n()
  const place = placeLabel(userLoc.label, locale)
  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button
          onClick={onUseMyLocation}
          disabled={geoStatus === 'locating'}
          className="flex items-center gap-1.5 rounded-lg border border-(--ev-line-mid) px-3 py-1.5 text-[12px] font-medium text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel) disabled:opacity-60"
        >
          <Navigation size={13} />
          {geoStatus === 'locating' ? t('loc.locating') : t('loc.use_mine')}
        </button>
      </div>
      <CityAutocomplete onSelect={onCitySelect} initialValue={initialCity} placeholder={t('loc.placeholder')} />
      <p className="mt-1.5 text-[11px] text-(--ev-ink-75)">
        {geoStatus === 'active' ? t('loc.near', { place }) : t('loc.measured', { place })}
      </p>
    </div>
  )
}

// --- Type ---

interface TypeProps {
  value: string
  counts: Record<string, number>
  onChange: (t: string) => void
}

/** Phone sheet: pills in the canonical order, hiding empty types. */
export function TypePills({ value, counts, onChange }: TypeProps) {
  const { locale, t } = useEventsI18n()
  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => onChange('All')} className={pillClass(value === 'All')}>{t('types.all')}</button>
      {TYPE_FILTER_ORDER.map((t) => {
        const meta = EVENT_TYPES[t]
        if (!meta || (counts[t] ?? 0) === 0) return null
        return (
          <button key={t} onClick={() => onChange(t === value ? 'All' : t)} className={pillClass(value === t)}>
            {typeLabel(t, locale)}
          </button>
        )
      })}
    </div>
  )
}

/** Desktop popover: rows with counts, most common first; long tail behind a disclosure. */
export function TypeList({ value, counts, types, expanded, onToggleExpanded, onChange }: TypeProps & {
  types: string[]
  expanded: boolean
  onToggleExpanded: () => void
}) {
  const { tone } = useEventsTone()
  const { locale, t: tr } = useEventsI18n()
  const TOP = 6
  const visible = expanded ? types : types.slice(0, TOP)
  const hidden = types.length - visible.length
  return (
    <div className="flex flex-col gap-0.5">
      <button onClick={() => onChange('All')} className={rowClass(value === 'All')}>
        <span>{tr('types.all_types')}</span>
        <span className="font-mono text-[12px] text-(--ev-ink-70)">{counts.All ?? 0}</span>
      </button>
      {visible.map((t) => {
        const meta = EVENT_TYPES[t]
        return (
          <button key={t} onClick={() => onChange(t === value ? 'All' : t)} className={rowClass(value === t)}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: typeInk(meta, tone) }} />
              {typeLabel(t, locale)}
            </span>
            <span className="font-mono text-[12px] text-(--ev-ink-70)">{counts[t] ?? 0}</span>
          </button>
        )
      })}
      {(hidden > 0 || expanded) && (
        <button
          onClick={onToggleExpanded}
          className="mt-1 rounded-lg px-3 py-1.5 text-left text-[12px] font-semibold text-(--ev-accent) transition-colors hover:bg-(--ev-panel-faint)"
        >
          {expanded ? tr('types.show_fewer') : plural(tr, hidden, 'types.show_more_one', 'types.show_more_other')}
        </button>
      )}
      <LevelRows value={value} counts={counts} onChange={onChange} />
    </div>
  )
}

// --- Rides by level ---

/**
 * Levels sit in the same radio group as the types (a level already means
 * "rides"). Empty levels stay hidden: production has no moderate rides today
 * and a zero-count row would only invite the question.
 */
function visibleLevels(value: string, counts: Record<string, number>) {
  return RIDE_STYLE_ORDER.filter((s) => (counts[styleFilterValue(s)] ?? 0) > 0 || value === styleFilterValue(s))
}

function LevelRows({ value, counts, onChange }: TypeProps) {
  const { tone } = useEventsTone()
  const { locale, t } = useEventsI18n()
  const levels = visibleLevels(value, counts)
  if (levels.length === 0) return null
  return (
    <>
      <p className="mb-1 mt-3 border-t border-(--ev-line) px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--ev-ink-75)">
        {t('sheet.level')}
      </p>
      {levels.map((s) => {
        const v = styleFilterValue(s)
        const active = value === v
        return (
          <button key={v} onClick={() => onChange(active ? 'All' : v)} className={rowClass(active)}>
            <span className="flex min-w-0 items-start gap-2">
              <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: rideStyleInk(s, tone) }} />
              <span className="min-w-0">
                <span className="block">{rideLevelFilterLabel(s, locale)}</span>
                <span className={`block text-[11px] font-normal leading-snug ${active ? 'text-(--ev-accent-90)' : 'text-(--ev-ink-75)'}`}>
                  {rideLevelBlurb(s, locale)}
                </span>
              </span>
            </span>
            <span className="ml-2 shrink-0 font-mono text-[12px] text-(--ev-ink-70)">{counts[v] ?? 0}</span>
          </button>
        )
      })}
    </>
  )
}

/** Phone sheet: one pill per level that has rides. */
export function LevelPills({ value, counts, onChange }: TypeProps) {
  const { locale } = useEventsI18n()
  const levels = visibleLevels(value, counts)
  if (levels.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {levels.map((s) => {
        const v = styleFilterValue(s)
        const active = value === v
        return (
          <button key={v} onClick={() => onChange(active ? 'All' : v)} aria-pressed={active} className={pillClass(active)}>
            {rideLevelFilterLabel(s, locale)}
            <span className={`ml-1.5 font-mono text-[11px] ${active ? 'text-(--ev-accent-90)' : 'text-(--ev-ink-70)'}`}>{counts[v] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}

// --- Good for ---

interface TagProps {
  selected: string[]
  counts: Record<string, number>
  onToggle: (t: string) => void
}

export function TagToggles({ selected, counts, onToggle }: TagProps) {
  const { locale } = useEventsI18n()
  return (
    <div className="flex flex-wrap gap-1.5">
      {GOOD_FOR_TAGS.map((t) => {
        const active = selected.includes(t)
        const n = counts[t] ?? 0
        return (
          <button
            key={t}
            onClick={() => onToggle(t)}
            disabled={!active && n === 0}
            aria-pressed={active}
            className={`${pillClass(active)} disabled:opacity-60`}
          >
            {tagLabel(t, locale)}
            <span className={`ml-1.5 font-mono text-[11px] ${active ? 'text-(--ev-accent-90)' : 'text-(--ev-ink-70)'}`}>{n}</span>
          </button>
        )
      })}
    </div>
  )
}

// --- Rides for ---

/** Groups with events under the current filters (and any picked one). A
 *  group with nothing is left out: "LGBTQ+ 0" reads as "nothing for you". */
export function AudienceToggles({ selected, counts, onToggle }: TagProps) {
  const { locale } = useEventsI18n()
  const shown = AUDIENCE_TAGS.filter((t) => (counts[t] ?? 0) > 0 || selected.includes(t))
  if (shown.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((t) => {
        const active = selected.includes(t)
        const n = counts[t] ?? 0
        return (
          <button key={t} onClick={() => onToggle(t)} aria-pressed={active} className={pillClass(active)}>
            {tagLabel(t, locale)}
            <span className={`ml-1.5 font-mono text-[11px] ${active ? 'text-(--ev-accent-90)' : 'text-(--ev-ink-70)'}`}>{n}</span>
          </button>
        )
      })}
    </div>
  )
}

export function hasAudienceChoices(selected: string[], counts: Record<string, number>): boolean {
  return AUDIENCE_TAGS.some((t) => (counts[t] ?? 0) > 0 || selected.includes(t))
}

// --- Language ---

/**
 * "In Spanish · Español": only languages with events under the other filters
 * (and any picked one), so the row is absent when there is nothing to pick.
 * Each also carries its own name, for the reader who speaks it. Shift 01697.
 */
export function LanguageToggles({ choices, selected, counts, onToggle }: {
  choices: PartnerLanguage[]
  selected: PartnerLanguage[]
  counts: Partial<Record<PartnerLanguage, number>>
  onToggle: (c: PartnerLanguage) => void
}) {
  const { locale } = useEventsI18n()
  if (choices.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {choices.map((c) => {
        const active = selected.includes(c)
        return (
          <button key={c} onClick={() => onToggle(c)} aria-pressed={active} className={pillClass(active)}>
            {languageFilterLabel(c, locale)}
            {/* "En español · Español" says it twice, so the own name goes when it matches. */}
            {!ownNameRepeats(c, locale) && (
              <span lang={c} className={`ml-1 ${active ? 'text-(--ev-accent-90)' : 'text-(--ev-ink-75)'}`}>· {languageLabel(c)}</span>
            )}
            <span className={`ml-1.5 font-mono text-[11px] ${active ? 'text-(--ev-accent-90)' : 'text-(--ev-ink-70)'}`}>{counts[c] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}
