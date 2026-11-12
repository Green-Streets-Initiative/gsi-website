'use client'

/*
 * The week as 7 days × morning, afternoon, evening, for the free lesson
 * pages: a learner's free times on the instructor's Yes / Can't page (read
 * only), and an instructor's usual hours on their own page (tap to change).
 * Cells are 'mon-am' … 'sun-eve', as in Shift's lesson_teachers.hours.
 */

const DAYS = [
  ['mon', 'M', 'Monday'],
  ['tue', 'T', 'Tuesday'],
  ['wed', 'W', 'Wednesday'],
  ['thu', 'T', 'Thursday'],
  ['fri', 'F', 'Friday'],
  ['sat', 'S', 'Saturday'],
  ['sun', 'S', 'Sunday'],
] as const
const PARTS = [
  ['am', 'AM', 'morning'],
  ['pm', 'PM', 'afternoon'],
  ['eve', 'Eve', 'evening'],
] as const

export default function WeekGrid({
  cells,
  onToggle,
  color = '#2D6A4F',
}: {
  cells: Set<string> | string[]
  onToggle?: (cell: string) => void
  color?: string
}) {
  const on = cells instanceof Set ? cells : new Set(cells)
  return (
    <div className="grid grid-cols-[38px_repeat(7,minmax(0,1fr))] gap-1.5" role="group">
      <span />
      {DAYS.map(([d, short]) => (
        <span key={d} className="text-center text-[0.8125rem] font-semibold text-navy/80" aria-hidden="true">
          {short}
        </span>
      ))}
      {PARTS.map(([p, short, long]) => (
        <Row key={p} label={short}>
          {DAYS.map(([d, , day]) => {
            const cell = `${d}-${p}`
            const lit = on.has(cell)
            const style = lit ? { background: color, borderColor: color } : { background: '#fff', borderColor: '#E3E6DE' }
            const label = `${day} ${long}${lit ? ', yes' : ''}`
            return onToggle ? (
              <button
                key={cell}
                type="button"
                onClick={() => onToggle(cell)}
                aria-pressed={lit}
                aria-label={`${day} ${long}`}
                className="h-11 rounded-lg border-2 transition-colors"
                style={style}
              />
            ) : (
              <span key={cell} role="img" aria-label={label} className="h-9 rounded-lg border-2" style={style} />
            )
          })}
        </Row>
      ))}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="flex items-center text-[0.8125rem] font-semibold text-navy/80">{label}</span>
      {children}
    </>
  )
}
