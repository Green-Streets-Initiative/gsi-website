import { ShieldCheck } from 'lucide-react'
import { SectionHeading } from '@/components/org/Section'
import { comingWhen, openedMeta, openedTitle, type NewInfra } from '@/lib/new-infra'
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
        lede="Bike lanes and paths that opened in the last two years, from MassDOT's bike inventory."
      />
      <ul className="divide-y divide-navy/10 border-y border-navy/15">
        {shown.map((o) => (
          <li key={`${o.name}|${o.facility}`} className="flex gap-3 py-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-green-deep" aria-hidden />
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-navy">{openedTitle(o)}</p>
              <p className="mt-0.5 text-[14px] text-ink-soft">{openedMeta(o, false)}</p>
            </div>
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
