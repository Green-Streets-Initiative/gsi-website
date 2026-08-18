'use client'

import type { NearbyPartner } from '@/lib/nearby/partner'

/**
 * Partner logo + credit line for the snapshot's dark surfaces. The white
 * chip behind the logo keeps any partner artwork legible on navy — partners
 * upload one transparent mark and it works here and on the light print page
 * (which renders its own chipless variant). GSI branding stays primary;
 * this treatment is deliberately quiet.
 */
export default function PartnerCobrand({ partner, logoClass = 'max-h-8', textClass = 'text-[0.72rem]', center = false }: {
  partner: NearbyPartner
  /** Height constraint for the logo (width stays auto for odd aspect ratios) */
  logoClass?: string
  textClass?: string
  center?: boolean
}) {
  // The logo already carries the partner's name — repeating it in the text
  // read as clutter (Keith, 2026-08-18). Name-in-text only when there's no
  // logo to say it.
  return (
    <div className={`flex items-center gap-2.5 ${center ? 'justify-center' : ''}`}>
      <span className={`${textClass} leading-snug text-white/80`}>
        {partner.logoUrl
          ? 'In partnership with'
          : <>In partnership with <span className="font-semibold text-white">{partner.name}</span></>}
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
