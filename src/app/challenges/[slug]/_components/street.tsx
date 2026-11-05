import type { ReactNode } from 'react'

/*
 * Page-local copy of the site's "street sign" kit (components/street/Street.tsx,
 * part of the site redesign that is not published yet), so the challenge
 * pages build on the published site today. The published globals.css already
 * has the .street wrapper and font-headline these rely on. Once the redesign
 * ships, switch the imports to '@/components/street/Street' and delete this
 * file (same move as src/app/move-in/sign.tsx).
 */


export const CONTAINER = 'mx-auto w-full max-w-[1120px] px-6 lg:px-8'

/** The line at the top of the sign: "Friday, October 30  Walk/Ride Day". */
export function SignTop({ strong, children }: { strong?: ReactNode; children?: ReactNode }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[1.0625rem] leading-snug text-white md:text-[1.25rem]">
      {strong && <span className="font-bold">{strong}</span>}
      {children && <span>{children}</span>}
    </p>
  )
}

/**
 * The page's hero: a forest-green sign holding the top line, the headline
 * and the lede. `after` sits under the sign on the page background (store
 * buttons, a next-date line); `aside` sits beside it on wide screens.
 */
export function SignHero({
  top,
  title,
  lede,
  after,
  aside,
}: {
  top?: ReactNode
  title: ReactNode
  lede?: ReactNode
  after?: ReactNode
  aside?: ReactNode
}) {
  const sign = (
    <div>
      <div className="rounded-[20px] bg-forest px-5 pb-8 pt-7 text-white sm:px-10 sm:pb-11 sm:pt-9 md:rounded-[24px]">
        {top}
        <h1 className={`${top ? 'mt-4 md:mt-5' : ''} font-headline text-[clamp(2rem,5.2vw,3.75rem)] font-extrabold leading-[1.02] tracking-[-0.01em] text-white`}>
          {title}
        </h1>
        {lede && <div className="mt-5 max-w-[600px] text-[1.0625rem] leading-[1.55] text-white md:text-[1.1875rem]">{lede}</div>}
      </div>
      {after}
    </div>
  )
  return (
    <section className="bg-cream pt-[60px]">
      <div className={`${CONTAINER} pb-8 pt-6 md:pt-10 lg:pb-10`}>
        {aside ? (
          <div className="grid items-center gap-8 lg:grid-cols-[7fr_5fr] lg:gap-10">
            {sign}
            {aside}
          </div>
        ) : (
          sign
        )}
      </div>
    </section>
  )
}

export function StreetSection({
  children,
  tone = 'cream',
  width = 'wide',
  closing = false,
  id,
  className = '',
}: {
  children: ReactNode
  tone?: 'cream' | 'white'
  /** `read` narrows the column for tables and prose. */
  width?: 'wide' | 'read'
  /** The page's last section: a deeper bottom before the footer. */
  closing?: boolean
  id?: string
  className?: string
}) {
  return (
    <section id={id} className={`${tone === 'white' ? 'bg-white' : 'bg-cream'} ${className}`}>
      <div className={`${CONTAINER} ${closing ? 'pb-20 pt-10 lg:pb-24 lg:pt-12' : 'py-10 lg:py-12'}`}>
        <div className={width === 'read' ? 'max-w-[900px]' : ''}>{children}</div>
      </div>
    </section>
  )
}

export function StreetHeading({
  title,
  lede,
  aside,
  as: Tag = 'h2',
}: {
  title: ReactNode
  lede?: ReactNode
  /** Sits on the heading's baseline at the right: a button or a count. */
  aside?: ReactNode
  as?: 'h2' | 'h3'
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <Tag className="font-headline text-[clamp(1.75rem,3.4vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.01em] text-navy">
          {title}
        </Tag>
        {lede && <p className="mt-3 max-w-[600px] text-[1.0625rem] leading-[1.6] text-ink-soft">{lede}</p>}
      </div>
      {aside}
    </div>
  )
}

/** A smaller headline: card titles, list items, step names. */
export const H3 = 'font-headline text-[1.375rem] font-extrabold leading-[1.15] text-navy'

/** Big numbers in forest Overpass over a Trebuchet label, between two rules. */
export function Stats({
  items,
  note,
  cols = 3,
}: {
  items: { value: ReactNode; label: ReactNode }[]
  note?: ReactNode
  cols?: 3 | 4
}) {
  return (
    <div className="border-y-2 border-navy/[0.14] py-6">
      <dl className={`grid gap-x-8 gap-y-6 ${cols === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {items.map((r, i) => (
          <div key={i} className="flex flex-col-reverse justify-end">
            <dt className="mt-2 text-[15px] leading-snug text-navy">{r.label}</dt>
            <dd className="font-headline text-[2.125rem] font-extrabold leading-none tracking-[-0.01em] text-forest md:text-[2.75rem]">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-5 text-[14px] leading-relaxed text-ink-soft">{note}</p>}
    </div>
  )
}

/** A numbered step marker: a small green sign with a white numeral. */
export function StepSign({ n }: { n: number }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-forest font-headline text-[1.25rem] font-extrabold text-white">
      {n}
    </span>
  )
}

/** Text link in forest with an arrow. */
export function StreetLink({ href, children, external = false }: { href: string; children: ReactNode; external?: boolean }) {
  const cls = 'inline-flex min-h-[44px] items-center gap-1.5 font-bold text-forest underline-offset-4 hover:underline'
  return (
    <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children} <span aria-hidden>&rarr;</span>
    </a>
  )
}

/** The navy button on cream. */
export const BUTTON =
  'inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[16px] font-bold text-white transition-opacity hover:opacity-90'
