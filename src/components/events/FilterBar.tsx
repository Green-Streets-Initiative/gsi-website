'use client'

import { useState } from 'react'
import { Bookmark, Search } from 'lucide-react'
import { getTypeMeta, getTagMeta } from '@/lib/events'
import FilterPill from './FilterPill'
import { WhenList, LocationControl, DistancePills, TypeList, TagToggles } from './FilterControls'
import { WHEN_OPTIONS, type EventFilters } from './useEventFilters'

/**
 * Desktop filter bar: one sticky row under the site nav. Search, then a pill
 * per dimension (each pill reads out its current value), a Saved toggle, and
 * the live result count. Mounted at lg and up; phones use FiltersSheet.
 */

interface FilterBarProps {
  filters: EventFilters
  savedCount: number
  resultCount: number
}

type PillKey = 'when' | 'near' | 'type' | 'tags'

export default function FilterBar({ filters: f, savedCount, resultCount }: FilterBarProps) {
  const [open, setOpen] = useState<PillKey | null>(null)
  const [typesExpanded, setTypesExpanded] = useState(false)
  const close = () => setOpen(null)

  const whenLabel = f.dateRange === 'upcoming' ? 'When' : WHEN_OPTIONS.find((o) => o.value === f.dateRange)?.label ?? 'When'
  const nearLabel =
    f.geoStatus === 'active'
      ? `Near ${f.userLoc.label}${f.distance !== 'all' ? ` · ${f.distance} mi` : ''}`
      : f.distance !== 'all'
        ? `Within ${f.distance} mi`
        : 'Near'
  const typeLabel = f.typeFilter === 'All' ? 'Type' : getTypeMeta(f.typeFilter).label
  const tagLabel =
    f.tags.length === 0 ? 'Good for' : f.tags.length === 1 ? getTagMeta(f.tags[0]).label : `Good for · ${f.tags.length}`

  return (
    <section className="sticky top-[60px] z-30 hidden border-b border-white/[0.07] bg-navy/95 px-8 backdrop-blur lg:block">
      <div className="mx-auto flex h-[56px] max-w-[1200px] items-center gap-2.5">
        <div className="relative w-[240px] shrink-0 xl:w-[300px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            type="search"
            value={f.query}
            onChange={(e) => f.setQuery(e.target.value)}
            placeholder="Search events"
            aria-label="Search events"
            className="h-9 w-full rounded-full border border-white/[0.14] bg-[#1F2034] pl-9 pr-3 text-[13px] text-white placeholder:text-white/60 focus:border-lime focus:outline-none"
          />
        </div>

        <FilterPill label={whenLabel} active={f.dateRange !== 'upcoming'} open={open === 'when'} onOpen={() => setOpen('when')} onClose={close} panelClassName="w-[220px]">
          <WhenList value={f.dateRange} onChange={(v) => { f.setDateRange(v); close() }} />
        </FilterPill>

        <FilterPill label={nearLabel} active={f.geoStatus === 'active' || f.distance !== 'all'} open={open === 'near'} onOpen={() => setOpen('near')} onClose={close} panelClassName="w-[300px]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Where are you?</p>
          <LocationControl
            geoStatus={f.geoStatus}
            userLoc={f.userLoc}
            initialCity={f.initialCity}
            onUseMyLocation={f.useMyLocation}
            onCitySelect={f.selectCity}
          />
          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">How far</p>
          <DistancePills value={f.distance} onChange={f.setDistance} />
        </FilterPill>

        <FilterPill label={typeLabel} active={f.typeFilter !== 'All'} open={open === 'type'} onOpen={() => setOpen('type')} onClose={close} panelClassName="w-[280px]">
          <TypeList
            value={f.typeFilter}
            counts={f.typeCounts}
            types={f.typesByCount}
            expanded={typesExpanded}
            onToggleExpanded={() => setTypesExpanded((v) => !v)}
            onChange={(t) => { f.setTypeFilter(t); close() }}
          />
        </FilterPill>

        <FilterPill label={tagLabel} active={f.tags.length > 0} open={open === 'tags'} onOpen={() => setOpen('tags')} onClose={close} panelClassName="w-[320px]">
          <TagToggles selected={f.tags} counts={f.tagCounts} onToggle={f.toggleTag} />
        </FilterPill>

        {(savedCount > 0 || f.savedOnly) && (
          <button
            onClick={() => f.setSavedOnly(!f.savedOnly)}
            aria-pressed={f.savedOnly}
            className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
              f.savedOnly ? 'border-lime/50 bg-lime/[0.08] text-lime' : 'border-white/[0.14] text-white/85 hover:bg-white/[0.06]'
            }`}
          >
            <Bookmark size={14} className={f.savedOnly ? 'fill-lime' : ''} />
            Saved · {savedCount}
          </button>
        )}

        <span className="ml-auto shrink-0 font-mono text-[13px] text-white/75">
          {resultCount} event{resultCount === 1 ? '' : 's'}
        </span>
      </div>
    </section>
  )
}
