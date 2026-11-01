'use client'

import { useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { openedLink, openedMeta, openedPhoto, openedPlace, openedTitle, type OpenedItem } from '@/lib/new-infra'

/**
 * One opened stretch, the same on the ride page and the town page: a picture
 * of it (the trail's photo, or Street View taken after it opened), what it is,
 * when it opened and how long, where it is, and where to read more.
 * `tone` picks the page's palette: the ride page's event tokens or the town
 * page's cream.
 */
export default function NewInfraRow({ o, onRoute, showTown, tone }: {
  o: OpenedItem
  onRoute: boolean
  showTown: boolean
  tone: 'ride' | 'town'
}) {
  const photo = openedPhoto(o)
  const [failed, setFailed] = useState(false)
  const place = openedPlace(o, showTown)
  const link = openedLink(o)
  const c = tone === 'ride'
    ? { title: 'text-(--ev-ink)', meta: 'text-(--ev-ink-75)', link: 'text-(--ev-accent)', icon: 'bg-(--ev-accent-tint-14) text-(--ev-accent)', thumb: 'bg-(--ev-panel)' }
    : { title: 'text-navy', meta: 'text-ink-soft', link: 'text-green-deep', icon: 'bg-green-deep/10 text-green-deep', thumb: 'bg-navy/5' }

  return (
    <div className="flex gap-3">
      {photo && !failed ? (
        <span className={`relative h-[60px] w-[84px] shrink-0 overflow-hidden rounded-lg ${c.thumb}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        </span>
      ) : (
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${c.icon}`}>
          <ShieldCheck size={17} aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className={`text-[15px] font-semibold ${c.title}`}>{openedTitle(o)}</p>
        <p className={`mt-0.5 text-[14px] ${c.meta}`}>{openedMeta(o, onRoute)}</p>
        {place && <p className={`text-[14px] ${c.meta}`}>{place}</p>}
        {link && (
          <a
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={`mt-1 inline-flex items-center gap-1 text-[14px] font-semibold ${c.link} underline-offset-4 hover:underline`}
          >
            {link.label}
            <ArrowRight size={14} aria-hidden />
          </a>
        )}
        {photo && !failed && photo.credit && <p className={`mt-1 text-[13px] ${c.meta}`}>{photo.credit}</p>}
      </div>
    </div>
  )
}
