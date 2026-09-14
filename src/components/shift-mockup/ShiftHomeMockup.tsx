import PhoneShell, { BEZEL, SCREEN_WIDTH } from './PhoneShell'
import {
  AroundYouCard,
  ConfirmTripsCard,
  Greeting,
  NewRoutesStrip,
  RecentTripsCard,
  ShiftHeader,
  StatusBar,
  UpNextCard,
} from './cards'

// Native geometry: header 44 + content padding 16/40 + greeting 56 + seven
// blocks (180+160+116+88+84+180) + six 12px gaps. Reserved up front so the
// scaled figure never causes a layout jump.
const STATUS_BAR = 54 // clears the dynamic island, like the real safe area
const SCREEN_HEIGHT = STATUS_BAR + 44 + 16 + 56 + (180 + 160 + 116 + 88 + 84 + 180) + 6 * 12 + 40
export const MOCKUP_WIDTH = SCREEN_WIDTH + BEZEL * 2
export const MOCKUP_HEIGHT = SCREEN_HEIGHT + BEZEL * 2

/**
 * The shipped Shift home screen as a CSS component, scaled with a reserved
 * box (no layout shift, no overflow). Decorative for assistive tech: one
 * sentence via aria-label, everything inside hidden.
 *
 * `scale` is a Tailwind class list that sets `--mockup-scale` per breakpoint.
 */
export default function ShiftHomeMockup({
  name = 'Sam',
  scale = '[--mockup-scale:0.62] md:[--mockup-scale:0.78] lg:[--mockup-scale:0.84]',
  className = '',
}: {
  name?: string
  scale?: string
  className?: string
}) {
  return (
    <figure
      role="img"
      aria-label="The Shift home screen: live departures around you, today's commute suggestion, and your status tier and streak"
      className={`relative m-0 ${scale} ${className}`}
      style={{
        width: `calc(${MOCKUP_WIDTH}px * var(--mockup-scale))`,
        height: `calc(${MOCKUP_HEIGHT}px * var(--mockup-scale))`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none select-none origin-top-left"
        style={{ width: MOCKUP_WIDTH, height: MOCKUP_HEIGHT, transform: 'scale(var(--mockup-scale))' }}
      >
        <PhoneShell>
          <div style={{ height: STATUS_BAR }} />
          <ShiftHeader />
          <div className="flex flex-col gap-3 px-5 pb-10 pt-4">
            <Greeting name={name} />
            <AroundYouCard />
            <UpNextCard />
            <ConfirmTripsCard />
            <StatusBar />
            <NewRoutesStrip />
            <RecentTripsCard />
          </div>
        </PhoneShell>
      </div>
    </figure>
  )
}
