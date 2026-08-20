'use client'

import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { Bicycle } from '@phosphor-icons/react'
import type { NearbyPromo } from '@/lib/nearby/alerts'
import { useNearbyT } from './NearbyI18n'

/** Compact "bike instead" card shown under a matching disruption's detail —
 *  headline + tap-to-copy code + a get-the-app CTA + sponsor credit. Bluebikes
 *  brand blue. Positive alternative framing (never anti-car). */
const BLUEBIKES_BLUE = '#2B6CB0'

export default function NearbyPromoCard({ promo }: { promo: NearbyPromo }) {
  const tr = useNearbyT()
  const [copied, setCopied] = useState(false)
  const shownRef = useRef(false)

  useEffect(() => {
    if (shownRef.current) return
    shownRef.current = true
    posthog.capture('snapshot_promo_shown', { promo: promo.id, provider: promo.provider })
  }, [promo.id, promo.provider])

  const copyCode = async () => {
    if (!promo.code) return
    try {
      await navigator.clipboard.writeText(promo.code)
    } catch {
      // clipboard can be blocked; the code is still visible to type by hand
    }
    setCopied(true)
    posthog.capture('snapshot_promo_copy', { promo: promo.id })
    setTimeout(() => setCopied(false), 1800)
  }

  const ctaUrl = promo.ctaUrl ?? promo.ctaUrlIos ?? promo.ctaUrlAndroid

  return (
    // Sits inside the alert detail (a button / role=button toggle) — stop taps
    // here from collapsing the alert.
    <div
      onClick={e => e.stopPropagation()}
      className="mt-2 w-full overflow-hidden rounded-lg border px-3 py-2.5"
      style={{ borderColor: `${BLUEBIKES_BLUE}66`, backgroundColor: `${BLUEBIKES_BLUE}1f` }}
    >
      <span className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider" style={{ color: '#9FC0E8' }}>
        <Bicycle size={14} weight="fill" aria-hidden="true" />
        {tr('promo.eyebrow')}
      </span>
      <span className="mt-1 block text-[0.9rem] font-bold leading-snug text-white">{promo.title}</span>
      {promo.subtitle && <span className="mt-0.5 block text-[0.75rem] text-white/70">{promo.subtitle}</span>}

      {promo.code && (
        <button
          type="button"
          onClick={copyCode}
          className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-white/30 bg-white/[0.06] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.1]"
        >
          <span className="font-mono text-[0.85rem] font-bold tracking-wider text-white">{promo.code}</span>
          <span className="text-[0.68rem] font-semibold text-[#BAF14D]">
            {copied ? tr('promo.copied') : tr('promo.copy_hint')}
          </span>
        </button>
      )}

      {ctaUrl && (
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog.capture('snapshot_promo_cta', { promo: promo.id })}
          className="mt-2 inline-block rounded-lg px-3 py-1.5 text-[0.78rem] font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: BLUEBIKES_BLUE }}
        >
          {promo.ctaLabel ?? tr('promo.get_app')} &rarr;
        </a>
      )}

      {promo.sponsor && (
        <span className="mt-2 flex items-center gap-1.5 text-[0.68rem] text-white/60">
          {promo.sponsorLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={promo.sponsorLogoUrl} alt={promo.sponsor} className="h-4 w-auto" />
          )}
          {tr('promo.sponsored_by', { sponsor: promo.sponsor })}
        </span>
      )}
      {promo.finePrint && <span className="mt-1 block text-[0.64rem] leading-snug text-white/45">{promo.finePrint}</span>}
    </div>
  )
}
