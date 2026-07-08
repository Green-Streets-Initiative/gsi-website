import Link from 'next/link'
import type { RoamSummary } from '@/lib/roams/queries'

/** Minimum shape the card needs — TownRoam (towns/queries) also satisfies it. */
export type RoamCardData = Omit<RoamSummary, 'featured'>

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
      </div>
    </Link>
  )
}
