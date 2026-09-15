/**
 * The Shift Your Semester social card, shared by the hub and school
 * opengraph-image routes. Cream ground, navy headline, forest eyebrow.
 */
import { loadBricolage } from '@/lib/og-fonts'

export const CREAM = '#F4F8EE'
export const NAVY = '#191A2E'
export const FOREST = '#2D6A4F'
export const INK_SOFT = '#4A4D68'

export async function semesterFonts() {
  const [regular, bold, extra] = await Promise.all([loadBricolage(400), loadBricolage(700), loadBricolage(800)])
  return [
    { name: 'Bricolage Grotesque', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: extra, weight: 800 as const, style: 'normal' as const },
  ]
}

export function SemesterCard({ eyebrow, headline, sub }: { eyebrow: string; headline: string; sub: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: CREAM,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        fontFamily: 'Bricolage Grotesque',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ color: FOREST, fontSize: 26, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase' }}>{eyebrow}</span>
        <span style={{ color: NAVY, fontSize: headline.length > 34 ? 72 : 88, fontWeight: 800, lineHeight: 1.04, marginTop: 24, maxWidth: 1000 }}>
          {headline}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <span style={{ color: INK_SOFT, fontSize: 30, fontWeight: 400, maxWidth: 760, lineHeight: 1.3 }}>{sub}</span>
        <span style={{ display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 700 }}>
          <span style={{ color: FOREST }}>Green Streets</span>
          <span style={{ color: NAVY, marginLeft: 10 }}>Initiative</span>
        </span>
      </div>
    </div>
  )
}

