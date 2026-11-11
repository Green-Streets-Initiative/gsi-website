/**
 * The crossing guard's stop paddle (Shift 01745), drawn once for the ride
 * page's map and its "Crossing guards" list, and for the live map.
 *
 * A red octagon with a white rim and a raised palm, like the paddle a
 * crossing guard holds up. Red when someone has the crossing; white with a
 * red edge while it still needs someone. On a map it stands on a short
 * handle whose tip marks the crossing.
 */
const RED = '#C8102E'
const HANDLE = '#3A3B4F'
// Phosphor HandPalm, fill weight (256 grid).
const PALM = 'M216,104v48a88,88,0,0,1-176,0V64a16,16,0,0,1,32,0v56a8,8,0,0,0,16,0V32a16,16,0,0,1,32,0v80a8,8,0,0,0,16,0V48a16,16,0,0,1,32,0v80.67A48.08,48.08,0,0,0,128,176a8,8,0,0,0,16,0,32,32,0,0,1,32-32,8,8,0,0,0,8-8V104a16,16,0,0,1,32,0Z'

/** A regular octagon around (c, c) with flat top and sides. */
function octagon(c: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 8) * (2 * i + 1)
    pts.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

/** The sign as SVG markup. `handle` adds the stick below it (for maps). */
export function guardSignSvg(guarded: boolean, size: number, handle = false): string {
  const h = handle ? 46 : 32
  const outer = octagon(16, 15)
  const rim = octagon(16, 12.6)
  const sign = guarded
    ? `<polygon points="${outer}" fill="${RED}"/><polygon points="${rim}" fill="none" stroke="#fff" stroke-width="1.6"/>`
    : `<polygon points="${outer}" fill="#fff" stroke="${RED}" stroke-width="2.4"/>`
  const palm = `<path transform="translate(8.6 8.4) scale(0.058)" d="${PALM}" fill="${guarded ? '#fff' : RED}"/>`
  const stick = handle ? `<rect x="14.2" y="30" width="3.6" height="15" rx="1.8" fill="${HANDLE}" stroke="#fff" stroke-width="1"/>` : ''
  return `<svg width="${size}" height="${(size * h) / 32}" viewBox="0 0 32 ${h}" aria-hidden="true">${stick}${sign}${palm}</svg>`
}
