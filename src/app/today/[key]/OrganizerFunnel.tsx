/**
 * Ride organizers on GSI Today (Shift 01864, 01869): each step of the
 * invitation as a bar out of the links sent, then the organizers who opened
 * their link and haven't saved a ride yet, so Keith knows who to check in
 * with. Matches the morning email (supabase/functions/gsi-today/compose.ts).
 */

const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold leading-none text-forest'
const n = (x: unknown) => Number(x ?? 0).toLocaleString('en-US')

export type Waiting = { name: string; opened: string }

export default function OrganizerFunnel({ links, steps, waiting }: {
  links: number
  steps: { value: number; label: string }[]
  waiting: Waiting[]
}) {
  return (
    <div>
      <ol className="space-y-4">
        <li className="flex items-baseline gap-4">
          <span className={`${HEAD} w-14 shrink-0 text-[1.75rem]`}>{n(links)}</span>
          <span className="text-[1rem] text-ink">{links === 1 ? 'organizer link sent' : 'organizer links sent'}</span>
        </li>
        {steps.map((s) => {
          const pct = links > 0 ? Math.max(s.value > 0 ? 3 : 0, Math.round((s.value / links) * 100)) : 0
          return (
            <li key={s.label} className="flex items-start gap-4">
              <span className={`${HEAD} w-14 shrink-0 text-[1.75rem]`}>{n(s.value)}</span>
              <div className="min-w-0 flex-1 pt-[2px]">
                <div className="text-[1rem] leading-snug text-ink">{s.label}</div>
                <div className="mt-2 h-[10px] w-full rounded-full bg-[#E6F0DF]" role="presentation">
                  <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {waiting.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[1rem] font-bold text-ink">Opened their link, no ride saved yet</h3>
          <ul className="mt-2 divide-y divide-[#E3E8DA]">
            {waiting.map((w) => (
              <li key={w.name} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-[1rem] font-bold text-ink">{w.name}</span>
                <span className="shrink-0 text-[0.9375rem] text-ink-muted">opened {w.opened}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
