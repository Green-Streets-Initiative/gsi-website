'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { guidesIndexStrings } from '@/lib/site-strings/guides-index'

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
  /** The guide's page in the reader's language, when it has one; else the English page. */
  href?: string
}

type K = keyof (typeof guidesIndexStrings)['en']

const MODES: { value: string; label: K }[] = [
  { value: 'all', label: 'guidesidx.mode_all' },
  { value: 'cycling', label: 'guidesidx.mode_cycling' },
  { value: 'transit', label: 'guidesidx.mode_transit' },
  { value: 'walking', label: 'guidesidx.mode_walking' },
  { value: 'multimodal', label: 'guidesidx.mode_multimodal' },
]

const MODE_LABEL: Record<string, K> = {
  cycling: 'guidesidx.mode_cycling',
  biking: 'guidesidx.mode_cycling',
  transit: 'guidesidx.mode_transit',
  walking: 'guidesidx.mode_walking',
  multimodal: 'guidesidx.mode_multimodal',
}

// Friendly labels for known topics (guidesidx.topic_<topic>); unknowns fall through to title-cased raw value.
const TOPICS = new Set([
  'apps', 'bike-share', 'cargo', 'e-bikes', 'errands', 'family', 'fares', 'gear', 'getting-started',
  'infrastructure', 'mbta-basics', 'motivation', 'multimodal', 'parking', 'planning', 'routes', 'safety',
  'security', 'short-trips', 'weather', 'year-round',
])

function topicLabel(t: string, tr: (key: K) => string): string {
  if (TOPICS.has(t)) return tr(`guidesidx.topic_${t}` as K)
  return t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function GuideLibrary({ guides, locale = 'en' }: { guides: GuideCard[]; locale?: SiteLocale }) {
  const tr = translator(guidesIndexStrings, locale)
  const router = useRouter()
  const searchParams = useSearchParams()
  // The visitor's ?lang= stays in the address as the filters change.
  const lang = searchParams.get('lang')

  const initialMode = searchParams.get('mode') ?? 'all'
  const initialTopic = searchParams.get('topic') ?? 'all'

  const [mode, setMode] = useState<string>(initialMode)
  const [topic, setTopic] = useState<string>(initialTopic)

  // Sync URL when filters change (preserves shareable state).
  useEffect(() => {
    const params = new URLSearchParams()
    if (mode !== 'all') params.set('mode', mode)
    if (topic !== 'all') params.set('topic', topic)
    if (lang) params.set('lang', lang)
    const qs = params.toString()
    router.replace(qs ? `/guides?${qs}` : '/guides', { scroll: false })
  }, [mode, topic, lang, router])

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
                ? 'border border-navy bg-navy text-white'
                : 'border border-navy/25 bg-transparent text-navy hover:border-navy/50')
            }
          >
            {tr(m.label)}
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
                ? 'border border-navy/60 bg-navy/[0.06] text-navy'
                : 'border border-navy/15 bg-transparent text-ink-soft hover:border-navy/40')
            }
          >
            {tr('guidesidx.topic_all')}
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
                  ? 'border border-navy/60 bg-navy/[0.06] text-navy'
                  : 'border border-navy/15 bg-transparent text-ink-soft hover:border-navy/40')
              }
            >
              {topicLabel(t, tr)}
            </button>
          ))}
        </div>
      )}

      {/* Result count */}
      <div className="mb-4 text-[0.8125rem] text-ink-soft">
        {tr(filtered.length === 1 ? 'guidesidx.count_one' : 'guidesidx.count_other', { n: filtered.length })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-[14px] border border-navy/10 bg-white p-8 text-center">
          <p className="text-[0.9375rem] text-ink-soft">
            {tr('guidesidx.empty')}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <Link
              key={g.id}
              href={g.href ?? `/guides/${g.slug ?? g.id}`}
              className="flex flex-col rounded-[14px] border border-navy/10 bg-white p-6 transition-colors hover:border-navy/30"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-forest">
                  {MODE_LABEL[g.primary_mode] ? tr(MODE_LABEL[g.primary_mode]) : g.primary_mode}
                </span>
                {g.is_starter && (
                  <span className="rounded-full border border-navy/25 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-soft">
                    {tr('guidesidx.starter')}
                  </span>
                )}
                {g.read_time_minutes && (
                  <span className="text-[0.75rem] text-ink-soft">
                    {tr('guidesidx.minutes', { n: g.read_time_minutes })}
                  </span>
                )}
              </div>
              <h2 className="mb-2 font-serif text-[1.375rem] leading-tight text-navy">
                {g.title}
              </h2>
              <p className="line-clamp-3 text-[1rem] leading-relaxed text-navy">
                {g.summary}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
