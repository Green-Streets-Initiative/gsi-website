'use client'

import { Download } from 'lucide-react'
import { gaEvent } from '@/lib/ga'

/** The trail's GPX file (/trails/<id>/gpx), counted in GA4 as trail_gpx_download. */
/** `label`: the link text in the page's language (trail pages pass it). */
export default function GpxLink({ trailId, className, label = 'Download the GPX' }: { trailId: string; className?: string; label?: string }) {
  return (
    <a
      href={`/trails/${trailId}/gpx`}
      download={`${trailId}.gpx`}
      onClick={() => gaEvent('trail_gpx_download', { trail: trailId })}
      className={className}
    >
      <Download size={15} aria-hidden /> {label}
    </a>
  )
}
