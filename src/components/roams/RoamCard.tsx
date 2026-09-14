import Link from 'next/link'
import { MapPin } from 'lucide-react'
import type { RoamSummary } from '@/lib/roams/queries'

/** Minimum shape the card needs — TownRoam (towns/queries) also satisfies it. */
export type RoamCardData = Omit<RoamSummary, 'featured'>

const MIN_COMPLETIONS_TO_SHOW = 10

export function roamMetaLine(r: {
  mode: string
  distance_miles: number | null
  estimated_minutes: number | null
}): string {
  const modeLabel =
    r.mode === 'multi' ? 'walk + transit' : r.mode === 'transit' ? 'transit' : r.mode
  return [
    modeLabel,
    r.distance_miles != null ? `${r.distance_miles} mi` : null,
    r.estimated_minutes != null ? `~${r.estimated_minutes} min` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

type Tone = 'dark' | 'light'

// `light` is the cream campaign pages; `dark` (default) keeps every existing
// caller byte-identical.
const THEME: Record<Tone, { card: string; name: string; meta: string; hook: string; done: string }> = {
  dark: {
    card: 'block overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.04] transition-colors hover:bg-white/[0.07]',
    name: 'text-sm font-semibold leading-snug text-white',
    meta: 'text-xs text-white/75',
    hook: 'mt-1.5 text-xs leading-snug text-white/75',
    done: 'mt-2 flex items-center gap-1 text-[10px] text-white/50',
  },
  light: {
    card: 'block overflow-hidden rounded-[14px] border border-navy/10 bg-white transition-colors hover:border-navy/30',
    name: 'text-[15px] font-semibold leading-snug text-navy',
    meta: 'text-[13px] text-ink-soft',
    hook: 'mt-1.5 text-[13px] leading-snug text-ink-soft',
    done: 'mt-2 flex items-center gap-1 text-[11px] text-ink-soft',
  },
}

/** Hero-image roam card, shared by the roams index, the town pages, and the school pages. */
export default function RoamCard({ roam, tone = 'dark' }: { roam: RoamCardData; tone?: Tone }) {
  const t = THEME[tone]
  return (
    <Link
      href={`/shift/roams/${encodeURIComponent(roam.id)}`}
      className={t.card}
    >
      {roam.hero_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roam.hero_image_url}
          alt={roam.name}
          loading="lazy"
          className="h-32 w-full object-cover"
        />
      )}
      <div className="p-4">
        <p className={t.name}>{roam.name}</p>
        <p className={`mt-0.5 ${t.meta}`}>
          {roamMetaLine(roam)}
          {roam.region ? ` · ${roam.region}` : ''}
        </p>
        {roam.hook && <p className={t.hook}>{roam.hook}</p>}
        {roam.completion_count >= MIN_COMPLETIONS_TO_SHOW && (
          <p className={t.done}>
            <MapPin size={9} />
            {roam.completion_count} completed
          </p>
        )}
      </div>
    </Link>
  )
}
