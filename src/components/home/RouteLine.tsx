/*
 * The page's spine: a dotted walking-route line that runs down a 56px lane
 * on the left of every home section, with a checkpoint dot pinned to each
 * section heading. One SVG segment per section — a page-spanning path can't
 * know section heights, so each segment enters at (28,0) and leaves at
 * (28,100) and consecutive sections join seamlessly at any height.
 */

export const LANE = 'grid-cols-1 md:grid-cols-[56px_1fr]'

type Tone = 'light' | 'dark'

const PATHS = {
  straight: 'M28 0 V100',
  wanderLeft: 'M28 0 C 28 30, 14 45, 20 60 S 28 90, 28 100',
  wanderRight: 'M28 0 C 28 25, 40 40, 34 55 S 28 85, 28 100',
  // Fades out before the section ends, so the line finishes rather than
  // running into the footer.
  terminal: 'M28 0 C 28 20, 20 34, 24 46 S 28 60, 28 72',
} as const

export function RouteSegment({ shape = 'straight', tone = 'light' }: { shape?: keyof typeof PATHS; tone?: Tone }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 56 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-0 left-0 hidden h-full w-[56px] md:block"
    >
      <path
        d={PATHS[shape]}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 7"
        vectorEffect="non-scaling-stroke"
        className={tone === 'dark' ? 'stroke-teal' : 'stroke-forest/60'}
      />
    </svg>
  )
}

/** The mobile stand-in for the lane: a small dot before an eyebrow. */
export function InlineDot({ tone = 'light' }: { tone?: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={`mr-2 inline-block h-[7px] w-[7px] rounded-full align-middle md:hidden ${tone === 'dark' ? 'bg-teal' : 'bg-forest'}`}
    />
  )
}

export function Eyebrow({ children, tone = 'light' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <p className={`mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] ${tone === 'dark' ? 'text-teal' : 'text-forest'}`}>
      <InlineDot tone={tone} />
      {children}
    </p>
  )
}
