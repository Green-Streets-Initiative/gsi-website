import type { ReactNode } from 'react'
import { LANE, RouteSegment } from '@/components/home/RouteLine'

/*
 * The organization-tier section skeleton, shared by the home refresh, the
 * challenges hub, the Shift Your Summer page, and the Shift Your Semester
 * pages: a 1120px grid with the 56px route lane on the left, one dotted
 * segment per section so the line runs the length of the page.
 */

type Shape = 'straight' | 'wanderLeft' | 'wanderRight' | 'terminal'

export function Section({
  children,
  shape = 'straight',
  tone = 'cream',
  width = 'wide',
  closing = false,
  id,
  className = '',
}: {
  children: ReactNode
  shape?: Shape
  tone?: 'cream' | 'white'
  /** `read` narrows the column for tables and prose. */
  width?: 'wide' | 'read'
  /** The page's last section: a deep bottom so the footer does not crowd the CTA. */
  closing?: boolean
  id?: string
  className?: string
}) {
  return (
    <section id={id} className={`relative overflow-x-clip ${tone === 'white' ? 'bg-white' : 'bg-cream'} ${className}`}>
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape={shape} />
        <div className="hidden md:block" />
        <div className={`${closing ? 'pb-20 pt-8 lg:pb-24 lg:pt-10' : 'py-8 lg:py-10'} ${width === 'read' ? 'max-w-[900px]' : ''}`}>{children}</div>
      </div>
    </section>
  )
}

export function SectionHeading({
  title,
  lede,
  aside,
}: {
  title: ReactNode
  lede?: ReactNode
  /** Sits on the heading's baseline at the right: a button or a count. */
  aside?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">{title}</h2>
        {lede && <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">{lede}</p>}
      </div>
      {aside}
    </div>
  )
}

/** A label · dotted leader · value row, the ledger idiom from the home page. */
export function Fact({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-[13px] text-ink-soft">{label}</dt>
      <dd className="order-3 shrink-0 text-[13px] font-semibold text-navy">{value}</dd>
      <span aria-hidden className="order-2 min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-navy/30" />
    </div>
  )
}

/** Text link with the site's forest arrow treatment. */
export function ArrowLink({ href, children, external = false }: { href: string; children: ReactNode; external?: boolean }) {
  const cls = 'inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-forest underline-offset-4 hover:underline'
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children} <span aria-hidden>&rarr;</span>
    </a>
  ) : (
    <a href={href} className={cls}>
      {children} <span aria-hidden>&rarr;</span>
    </a>
  )
}

/** The navy pill CTA on cream pages. */
export const PILL = 'inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90'
