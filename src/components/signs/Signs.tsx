import Link from 'next/link'
import type { ReactNode } from 'react'
import './signs.css'

/**
 * Sign pieces for the wayfinding prototype (2026-11-04). Each one does the
 * job its real-world sign does: names a place, points to a destination with a
 * number, or holds a note. See signs.css for the look; pages opt in with
 * <SignScope>.
 */

export function SignScope({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`sg ${className}`}>{children}</div>
}

/** Street-name blade. Put it inside the page's h1 so the place name is the heading. */
export function StreetBlade({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`sg-blade ${className}`}>{children}</span>
}

function Arrow() {
  return (
    <svg className="sg-row-arrow" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M4 14h17M14 6l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export interface GuideRowProps {
  href: string
  name: string
  /** One short line under the name: the next date, the nearest one. */
  sub?: string | null
  /** The number on the right, like the miles on a guide sign. */
  value?: string | null
}

export function GuideSign({ title, rows, className = '' }: { title?: string; rows: GuideRowProps[]; className?: string }) {
  if (rows.length === 0) return null
  return (
    <nav className={`sg-guide ${className}`} aria-label={title ?? 'On this page'}>
      <div className="sg-guide-inner">
        {title && <div className="sg-guide-title">{title}</div>}
        {rows.map((r) => (
          <GuideRow key={r.href + r.name} {...r} />
        ))}
      </div>
    </nav>
  )
}

export function GuideRow({ href, name, sub, value }: GuideRowProps) {
  const inner = (
    <>
      <span className="sg-row-name">{name}</span>
      {value && <span className="sg-row-value">{value}</span>}
      <Arrow />
      {sub && <span className="sg-row-sub">{sub}</span>}
    </>
  )
  if (href.startsWith('#') || href.startsWith('http')) {
    return (
      <a href={href} className="sg-row">
        {inner}
      </a>
    )
  }
  return (
    <Link href={href} className="sg-row">
      {inner}
    </Link>
  )
}

export function MileMarkers({ items, className = '' }: { items: Array<{ value: string; label: string }>; className?: string }) {
  if (items.length === 0) return null
  return (
    <dl className={`sg-markers ${className}`}>
      {items.map((m) => (
        <div key={m.label} className="sg-marker">
          <div className="sg-marker-plate">
            <dt className="sg-marker-label">{m.label}</dt>
            <dd className="sg-marker-value">{m.value}</dd>
          </div>
          <div className="sg-marker-post" aria-hidden="true" />
        </div>
      ))}
    </dl>
  )
}

export function Plaque({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`sg-plaque ${className}`}>{children}</div>
}

/** Date tile for event lists: a small green sign with the month and day. */
export function DateTile({ date }: { date: string }) {
  const d = new Date(`${date}T12:00:00`)
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const day = d.getDate()
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  return (
    <span className="sg-date" aria-hidden="true">
      <span className="sg-date-wd">{weekday}</span>
      <span className="sg-date-day">{day}</span>
      <span className="sg-date-mo">{month}</span>
    </span>
  )
}
