import Link from 'next/link'
import { MapPin } from 'lucide-react'
import type { RoamSummary } from '@/lib/roams/queries'

/** Minimum shape the card needs — TownRoam (towns/queries) also satisfies it. */
export type RoamCardData = Omit<RoamSummary, 'featured'>

const VIBE_LABELS: Record<string, string> = {
  chill: 'Chill',
  active: 'Active',
  social: 'Social',
  exploring: 'Exploring',
}

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

/** Hero-image roam card, shared by the roams index and the town pages. */
export default function RoamCard({ roam }: { roam: RoamCardData }) {
  return (
    <Link
      href={`/shift/roams/${encodeURIComponent(roam.id)}`}
      className="block overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.04] transition-colors hover:bg-white/[0.07]"
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
        <p className="text-sm font-semibold leading-snug text-white">{roam.name}</p>
        <p className="mt-0.5 text-xs text-white/75">
          {roamMetaLine(roam)}
          {roam.region ? ` · ${roam.region}` : ''}
        </p>
        {roam.hook && <p className="mt-1.5 text-xs leading-snug text-white/75">{roam.hook}</p>}
        {(roam.vibe_tags.length > 0 || roam.completion_count > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {roam.vibe_tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/60">
                {VIBE_LABELS[tag] ?? tag}
              </span>
            ))}
            {roam.completion_count > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-white/50">
                <MapPin size={9} />
                {roam.completion_count} completed
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
