'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export interface GuideCard {
  id: string
  slug: string | null
  title: string
  summary: string
  primary_mode: string
  primary_barrier: string | null
  topics: string[]
  read_time_minutes: number | null
  is_starter: boolean
}

const MODES: { value: string; label: string }[] = [
  { value: 'all', label: 'All modes' },
  { value: 'cycling', label: 'Biking' },
  { value: 'transit', label: 'Transit' },
  { value: 'walking', label: 'Walking' },
]

const MODE_LABEL: Record<string, string> = {
  cycling: 'Biking',
  transit: 'Transit',
  walking: 'Walking',
}

// Friendly labels for known topics; unknowns fall through to title-cased raw value.
const TOPIC_LABEL: Record<string, string> = {
  apps: 'Apps',
  'bike-share': 'Bike share',
  cargo: 'Cargo',
  'e-bikes': 'E-bikes',
  errands: 'Errands',
  family: 'Family',
  fares: 'Fares',
  gear: 'Gear',
  'getting-started': 'Getting started',
  infrastructure: 'Infrastructure',
  'mbta-basics': 'MBTA basics',
  motivation: 'Why bother',
  multimodal: 'Multimodal',
  parking: 'Parking',
  planning: 'Planning',
  routes: 'Routes',
  safety: 'Safety',
  security: 'Security',
  'short-trips': 'Short trips',
  weather: 'Weather',
  'year-round': 'Year-round',
}

function topicLabel(t: string): string {
  return TOPIC_LABEL[t] ?? t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function GuideLibrary({ guides }: { guides: GuideCard[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialMode = searchParams.get('mode') ?? 'all'
  const initialTopic = searchParams.get('topic') ?? 'all'

  const [mode, setMode] = useState<string>(initialMode)
  const [topic, setTopic] = useState<string>(initialTopic)

  // Sync URL when filters change (preserves shareable state).
  useEffect(() => {
    const params = new URLSearchParams()
    if (mode !== 'all') params.set('mode', mode)
    if (topic !== 'all') params.set('topic', topic)
    const qs = params.toString()
    router.replace(qs ? `/guides?${qs}` : '/guides', { scroll: false })
  }, [mode, topic, router])

  // All topics that actually appear in the visible-by-mode subset, sorted.
  const visibleTopics = useMemo(() => {
    const set = new Set<string>()
    for (const g of guides) {
      if (mode === 'all' || g.primary_mode === mode) {
        for (const t of g.topics) set.add(t)
      }
    }
    return [...set].sort()
  }, [guides, mode])

  // Reset topic when mode changes if the current topic isn't available.
  useEffect(() => {
    if (topic !== 'all' && !visibleTopics.includes(topic)) {
      setTopic('all')
    }
  }, [visibleTopics, topic])

  const filtered = useMemo(() => {
    return guides.filter((g) => {
      if (mode !== 'all' && g.primary_mode !== mode) return false
      if (topic !== 'all' && !g.topics.includes(topic)) return false
      return true
    })
  }, [guides, mode, topic])

  return (
    <div>
      {/* Mode chips */}
      <div className="mb-3 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            aria-pressed={mode === m.value}
            className={
              'rounded-full px-4 py-1.5 text-[0.8125rem] font-semibold transition-colors ' +
              (mode === m.value
                ? 'border border-[#BAF14D] bg-[#BAF14D]/[0.12] text-[#BAF14D]'
                : 'border border-white/[0.16] bg-transparent text-white/80 hover:border-white/40')
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Topic chips */}
      {visibleTopics.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTopic('all')}
            aria-pressed={topic === 'all'}
            className={
              'rounded-full px-3 py-1 text-[0.75rem] font-semibold transition-colors ' +
              (topic === 'all'
                ? 'border border-white/40 bg-white/[0.08] text-white'
                : 'border border-white/[0.12] bg-transparent text-white/75 hover:border-white/30')
            }
          >
            All topics
          </button>
          {visibleTopics.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              aria-pressed={topic === t}
              className={
                'rounded-full px-3 py-1 text-[0.75rem] font-semibold transition-colors ' +
                (topic === t
                  ? 'border border-white/40 bg-white/[0.08] text-white'
                  : 'border border-white/[0.12] bg-transparent text-white/75 hover:border-white/30')
              }
            >
              {topicLabel(t)}
            </button>
          ))}
        </div>
      )}

      {/* Result count */}
      <div className="mb-4 text-[0.8125rem] text-white/75">
        {filtered.length} {filtered.length === 1 ? 'guide' : 'guides'}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-8 text-center">
          <p className="text-[0.9375rem] text-white/80">
            No guides match this combination yet. Try widening the filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <Link
              key={g.id}
              href={`/guides/${g.slug ?? g.id}`}
              className="flex flex-col rounded-2xl border border-white/[0.12] bg-[#242538] p-6 transition-colors hover:border-[#BAF14D]/40"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-[#BAF14D]/[0.12] px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-[#BAF14D]">
                  {MODE_LABEL[g.primary_mode] ?? g.primary_mode}
                </span>
                {g.is_starter && (
                  <span className="rounded-full border border-white/[0.2] px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-white/80">
                    Starter
                  </span>
                )}
                {g.read_time_minutes && (
                  <span className="text-[0.75rem] text-white/75">
                    {g.read_time_minutes} min
                  </span>
                )}
              </div>
              <h3 className="mb-2 font-display text-[1.0625rem] font-bold leading-snug text-white">
                {g.title}
              </h3>
              <p className="line-clamp-3 text-[0.875rem] leading-relaxed text-white/80">
                {g.summary}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
