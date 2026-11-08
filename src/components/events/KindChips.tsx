import Link from 'next/link'
import { EVENT_KINDS, kindPath, type EventKindSlug } from '@/lib/event-kinds'

/**
 * "Browse by kind": links to the kind pages (/events/group-rides...), on
 * /events and at the foot of each kind page. Plain links, rendered on the
 * server, so search finds the pages from the calendar. Cream-site colors.
 */
export default function KindChips({ current, className = '' }: { current?: EventKindSlug; className?: string }) {
  return (
    <nav aria-label="Browse by kind" className={className}>
      <p className="text-[14px] font-semibold text-navy">Browse by kind</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {EVENT_KINDS.map((k) => (
          k.slug === current ? (
            <span key={k.slug} aria-current="page" className="rounded-full bg-navy px-3.5 py-1.5 text-[14px] font-semibold text-white">
              {k.chip}
            </span>
          ) : (
            <Link
              key={k.slug}
              href={kindPath(k.slug)}
              className="rounded-full bg-navy/[0.06] px-3.5 py-1.5 text-[14px] font-semibold text-navy transition-colors hover:bg-navy/[0.12]"
            >
              {k.chip}
            </Link>
          )
        ))}
      </div>
    </nav>
  )
}
