import type { ReactNode } from 'react'
import { Eyebrow, LANE, RouteSegment } from '@/components/home/RouteLine'

/**
 * The cream editorial page header: the GSI-tier equivalent of the navy hero
 * with a Bricolage headline and a lime pill that the rest of the site still
 * uses. Extracted from the home page so the organization pages can share it.
 */
export default function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: ReactNode
  lede?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="relative overflow-x-clip bg-cream" style={{ paddingTop: '60px' }}>
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderLeft" />
        <div className="hidden md:block" />
        <div className="max-w-[780px] pb-12 pt-14 md:pt-20 lg:pb-16 lg:pt-24">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
            {title}
          </h1>
          {lede && <p className="mt-6 max-w-[560px] text-[1.125rem] leading-[1.6] text-ink-soft">{lede}</p>}
          {children}
        </div>
      </div>
    </section>
  )
}
