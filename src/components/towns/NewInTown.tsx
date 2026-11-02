import { SectionHeading } from '@/components/org/Section'
import NewInfraRow from '@/components/new-infra/NewInfraRow'
import { comingWhen, type NewInfra } from '@/lib/new-infra'
import { todayKey } from '@/lib/organizers/ride-words'

/**
 * "New in {town}": bike lanes and paths that opened here in the last two
 * years (Shift 01577), newest first. What's coming is already the Get involved
 * list above, so it gets one line pointing there, not a second list.
 */
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

export default function NewInTown({ info, townName, hasInvolved }: { info: NewInfra; townName: string; hasInvolved: boolean }) {
  const next = info.coming[0]
  const shown = info.opened.slice(0, 6)
  return (
    <div className="max-w-[720px]">
      <SectionHeading
        title={`New in ${townName}`}
        lede="Bike lanes and paths that opened in the last six months, from MassDOT's bike inventory."
      />
      <ul className="divide-y divide-navy/10 border-y border-navy/15">
        {shown.map((o) => (
          <li key={`${o.name}|${o.facility}`} className="py-3">
            <NewInfraRow o={o} onRoute={false} showTown={false} tone="town" />
          </li>
        ))}
      </ul>
      {info.opened.length > shown.length && (
        <p className="mt-3 text-[14px] text-ink-soft">And {info.opened.length - shown.length} more.</p>
      )}
      {next && (
        <p className="mt-4 text-[15px] text-ink-soft">
          <span className="font-semibold text-navy">Coming:</span> {next.what}, {lowerFirst(comingWhen(next, todayKey()))}.
          {hasInvolved && (
            <>
              {' '}
              <a href="#involved" className="font-semibold text-green-deep underline-offset-4 hover:underline">
                See what&rsquo;s coming and how to weigh in
              </a>
            </>
          )}
        </p>
      )}
    </div>
  )
}
