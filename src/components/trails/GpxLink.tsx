'use client'

import { Download } from 'lucide-react'
import { gaEvent } from '@/lib/ga'

/** The trail's GPX file (/trails/<id>/gpx), counted in GA4 as trail_gpx_download. */
export default function GpxLink({ trailId, className }: { trailId: string; className?: string }) {
  return (
    <a
      href={`/trails/${trailId}/gpx`}
      download={`${trailId}.gpx`}
      onClick={() => gaEvent('trail_gpx_download', { trail: trailId })}
      className={className}
    >
      <Download size={15} aria-hidden /> Download the GPX
    </a>
  )
}
