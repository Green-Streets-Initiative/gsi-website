import { ArrowUpRight, Bicycle, PersonSimpleWalk, Train } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import { sourceName, type School, type SchoolFact } from '@/lib/semester/schools'
import { withUtm } from '@/lib/utm'

/*
 * What the school already gives you: transit, bike, and around-campus facts
 * from the registry, each citing the school's own page.
 */
const GROUPS: { key: 'transit' | 'bike' | 'moving'; label: string; icon: Icon }[] = [
  { key: 'transit', label: 'Transit', icon: Train },
  { key: 'bike', label: 'Bike', icon: Bicycle },
  { key: 'moving', label: 'Around campus', icon: PersonSimpleWalk },
]

function FactRow({ fact, slug }: { fact: SchoolFact; slug: string }) {
  return (
    <li className="border-b border-navy/15 py-3.5">
      <p className="text-[16px] leading-[1.55] text-navy">{fact.text}</p>
      <a
        href={withUtm(fact.sourceUrl, { medium: 'school_page', campaign: 'semester', content: slug }) ?? fact.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-forest underline-offset-4 hover:underline"
      >
        {sourceName(fact.sourceUrl)}
        <ArrowUpRight size={13} weight="bold" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  )
}

export default function SchoolPerks({ school }: { school: School }) {
  return (
    <div className="grid gap-8 md:grid-cols-3 md:gap-8">
      {GROUPS.filter((g) => school[g.key].length > 0).map((g) => (
        <div key={g.key}>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-forest/50 text-forest">
              <g.icon size={18} aria-hidden />
            </span>
            <h3 className="font-serif text-[1.375rem] leading-tight text-navy">{g.label}</h3>
          </div>
          <ul className="mt-3 border-t border-navy/15">
            {school[g.key].map((f) => (
              <FactRow key={f.sourceUrl + f.text.slice(0, 24)} fact={f} slug={school.slug} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
