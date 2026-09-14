/*
 * The real Shift brand marks. Paths, metrics and colors are copied verbatim
 * from the canonical assets, which are also checked in at public/brand/:
 *   shift-wordmark-white.svg · shift-wordmark-dark.svg · shift-mark.svg
 *
 * These are inlined rather than loaded with <img src="*.svg"> because the
 * wordmark's <text> needs Bricolage Grotesque from the page — inside an <img>
 * the SVG cannot see the page's webfonts and falls back to Arial Black.
 *
 * Never hand-draw the chevrons anywhere else. The mark is lime + blue with a
 * 3pt gap; a single-color pair is wrong.
 */

const LIME = '#BAF14D'
const BLUE = '#2966E5'
const BRICOLAGE = "var(--font-bricolage), 'Bricolage Grotesque', 'Arial Black', sans-serif"

/** Chevrons only, no word. From shift-mark.svg (viewBox 36×28). */
export function ShiftMark({ height = 14, className = '' }: { height?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 36 28"
      height={height}
      width={(height * 36) / 28}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill={LIME} />
      <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill={BLUE} />
    </svg>
  )
}

/** Full "Shift" wordmark + chevrons. From shift-wordmark-*.svg (viewBox 125×40). */
export default function ShiftWordmark({
  tone = 'white',
  height = 20,
  className = '',
  title = 'Shift',
}: {
  tone?: 'white' | 'dark'
  height?: number
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 125 40"
      height={height}
      width={(height * 125) / 40}
      className={className}
      role="img"
      aria-label={title}
    >
      <text
        x="0"
        y="30"
        fontFamily={BRICOLAGE}
        fontWeight={800}
        fontSize={34}
        letterSpacing={-1.36}
        fill={tone === 'white' ? '#FFFFFF' : '#191A2E'}
      >
        Shift
      </text>
      <path d="M85,7 L101,20 L85,33 L85,26 L95,20 L85,14Z" fill={LIME} />
      <path d="M104,7 L120,20 L104,33 L104,26 L114,20 L104,14Z" fill={BLUE} />
    </svg>
  )
}

/**
 * The Pacesetter tier icon: three gold chevrons. Tier icons are their own
 * shapes, not the brand mark recolored. Copied from the app's TierIcon set.
 */
export function PacesetterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M1 5L9.5 16L1 27L1 23L5 16L1 9Z" fill="#EDB93C" />
      <path d="M11 5L19.5 16L11 27L11 23L15 16L11 9Z" fill="#EDB93C" />
      <path d="M21 5L29.5 16L21 27L21 23L25 16L21 9Z" fill="#EDB93C" />
    </svg>
  )
}
