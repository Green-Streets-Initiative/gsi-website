'use client'

import { useNearbyT } from './NearbyI18n'
import type { NearbyPartner } from '@/lib/nearby/partner'

/**
 * Partner logo + credit line for the snapshot's dark surfaces. The white
 * chip behind the logo keeps any partner artwork legible on navy — partners
 * upload one transparent mark and it works here and on the light print page
 * (which renders its own chipless variant). GSI branding stays primary;
 * this treatment is deliberately quiet.
 */
export default function PartnerCobrand({ partner, logoClass = 'max-h-8', gsiClass = 'max-h-5', textClass = 'text-[0.72rem]', center = false }: {
  partner: NearbyPartner
  /** Height constraint for the logo (width stays auto for odd aspect ratios) */
  logoClass?: string
  /** Height constraint for the GSI wordmark chip — the mark is ~7:1, so cap
   *  it a step below the partner logo or it dominates the lockup */
  gsiClass?: string
  textClass?: string
  center?: boolean
}) {
  const tr = useNearbyT()
  // Full lockup: our mark first, then the relationship, then theirs —
  // "In partnership with" floating alone read as an orphan with no primary
  // entity (Keith, 2026-08-21). Same white-chip treatment for both marks;
  // the wordmark ships from /public so nothing here leaves our origin.
  // The logo already carries the partner's name — repeating it in the text
  // read as clutter (Keith, 2026-08-18). Name-in-text only when there's no
  // logo to say it.
  return (
    <div className={`flex items-center gap-2.5 ${center ? 'justify-center' : ''}`}>
      <span className="shrink-0 rounded-md bg-white px-2 py-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/gsi-wordmark.png" alt="Green Streets Initiative" className={`${gsiClass} w-auto`} />
      </span>
      <span className={`${textClass} leading-snug text-white/80`}>
        {partner.logoUrl
          ? tr('partner.in_partnership_with')
          : <>{tr('partner.in_partnership_with')} <span className="font-semibold text-white">{partner.name}</span></>}
      </span>
      {partner.logoUrl && (
        <span className="shrink-0 rounded-md bg-white px-2 py-1">
          {/* Plain <img>: partner logos come from Supabase storage at runtime */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={partner.logoUrl} alt={partner.name} className={`${logoClass} w-auto`} />
        </span>
      )}
    </div>
  )
}
