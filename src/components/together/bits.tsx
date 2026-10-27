import type { ComponentProps, ReactNode } from 'react'
import { Bike, Bus, Car, Footprints, Scooter, type LucideIcon } from 'lucide-react'
import { Toggle, cx } from '@/components/organizers/ui'
import type { FitLevel, PartnerWay } from '@/lib/together'

/**
 * Small visual pieces for Shift Together on the web, the app's PartnerBits
 * (01350): a person's face (photo when their profile is public, initial
 * otherwise), the icon for each way, and the three-step fit meter so a match
 * reads at a glance instead of as sentences.
 */

export const WAY_ICON: Record<PartnerWay | 'drive', LucideIcon> = { bike: Bike, walk: Footprints, transit: Bus, micro: Scooter, drive: Car }

const TINTS = ['#2F6FD6', '#0F8A7E', '#6B4FD6', '#D9572B', '#B78400']

export function Avatar({ name, url, size = 56 }: { name: string; url: string | null; size?: number }) {
  const letter = (name.trim()[0] ?? '?').toUpperCase()
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- a member's own photo URL from storage
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-display font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: TINTS[letter.charCodeAt(0) % TINTS.length] }}
    >
      {letter}
    </span>
  )
}

/** One row: icon, label, three bars, and the number behind them. */
export function FitMeter({ icon, label, level, value }: { icon: ReactNode; label: string; level: FitLevel; value: string }) {
  return (
    <div className="flex min-h-[36px] items-center gap-3" aria-label={`${label}: ${value}`}>
      <span className="hidden w-5 justify-center text-(--ev-ink-80) sm:flex" aria-hidden>{icon}</span>
      <span className="w-[92px] shrink-0 text-[15px] font-bold sm:w-[104px]">{label}</span>
      <span className="flex shrink-0 gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cx('h-2 w-4 rounded-full sm:w-5', level != null && i <= level ? 'bg-(--ev-accent)' : 'bg-(--ev-line-strong)')} />
        ))}
      </span>
      <span className="ml-1 min-w-0 flex-1 text-[15px] font-semibold leading-tight">{value}</span>
    </div>
  )
}

/** A choice chip: the console Toggle at a 44px touch target, icon and label on one line. */
export function Chip({ className, ...props }: ComponentProps<typeof Toggle>) {
  return <Toggle {...props} className={cx('inline-flex min-h-[44px] items-center gap-1.5 px-4 text-[15px]', className)} />
}

/** A meter-panel row of chips (who wants to try what, a carpool's role), lined up with FitMeter. */
export function ChipRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[36px] flex-wrap items-center gap-x-3 gap-y-2">
      <span className="hidden w-5 justify-center text-(--ev-ink-80) sm:flex" aria-hidden>{icon}</span>
      <span className="w-[92px] shrink-0 text-[15px] font-bold sm:w-[104px]">{label}</span>
      <span className="flex min-w-0 flex-wrap gap-2">{children}</span>
    </div>
  )
}
