'use client'

import { useEffect, useState } from 'react'

interface Progress {
  total: number
  submitted: number
  inProgress: number
  reviewsSubmitted: number
  reviewsPending: number
  reviewsApplied: number
}

/** One line of live progress for the guide header; silent on any error. */
export default function ShortlistProgress({ className = '' }: { className?: string }) {
  const [p, setP] = useState<Progress | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/volunteer-guide/shortlist/progress')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.total === 'number') setP(d as Progress)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  if (!p) return null
  const parts = [`${p.submitted} of ${p.total} schools submitted`]
  if (p.inProgress > 0) parts.push(`${p.inProgress} in progress`)
  if (p.reviewsSubmitted > 0) parts.push(`${p.reviewsSubmitted} route${p.reviewsSubmitted === 1 ? '' : 's'} reviewed`)
  if (p.reviewsPending > 0) parts.push(`${p.reviewsPending} suggestion${p.reviewsPending === 1 ? '' : 's'} waiting for Keith`)
  return <span className={className}>{parts.join(' · ')}</span>
}
