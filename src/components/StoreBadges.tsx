'use client'

import posthog from 'posthog-js'
import { gaEvent } from '@/lib/ga'
import { trackAdConversion } from '@/lib/ad-pixels'
import { HOME_CTA_EVENT, type Audience, type Placement } from '@/components/home/tracking'

type Store = 'ios' | 'android'

const IOS_DEFAULT = process.env.NEXT_PUBLIC_IOS_URL ?? 'https://apps.apple.com/us/app/shift-by-gsi/id6761119037'
const ANDROID_DEFAULT =
  process.env.NEXT_PUBLIC_ANDROID_URL ?? 'https://play.google.com/store/apps/details?id=org.greenstreets.shift'

// Google's official PNG (646×250) carries transparent clear space: the badge
// itself is the 168px-tall band from y=41 to y=209. Scale the image so the
// VISIBLE badge matches Apple's height, and cancel the padding with negative
// margins, rather than cropping the official file.
const PLAY_IMG_H = 250
const PLAY_BADGE_H = 168
const PLAY_PAD = 41

export const STORE_CREDIT_LINES =
  'App Store is a trademark of Apple Inc., registered in the U.S. and other countries. Google Play and the Google Play logo are trademarks of Google LLC.'

/**
 * The official App Store and Google Play badges (public/brand/store/, see
 * its README), used unmodified: Apple first, equal heights, a quarter of
 * the height of clear space around each. Replaces the hand-drawn lookalike
 * (brand rule: real marks only). Clicks are tracked like every store link.
 */
export default function StoreBadges({
  iosUrl = IOS_DEFAULT,
  androidUrl = ANDROID_DEFAULT,
  height = 40,
  layout = 'row',
  placement,
  audience = 'individual',
  credit = false,
  className = '',
}: {
  iosUrl?: string
  androidUrl?: string
  /** Badge height in px; Apple's minimum on screen is 40. */
  height?: number
  layout?: 'row' | 'column'
  /** When set, the click also fires `home_cta_clicked` for the home-page funnel. */
  placement?: Placement | string
  audience?: Audience
  /** Print the trademark credit lines under the badges. */
  credit?: boolean
  className?: string
}) {
  const track = (store: Store) => {
    const base = { store, placement }
    gaEvent('shift_store_click', base)
    posthog.capture('shift_store_click', base)
    trackAdConversion('ShiftStoreClick', base)
    if (placement) {
      const props = { placement, destination: store === 'ios' ? 'app_store' : 'google_play', audience }
      posthog.capture(HOME_CTA_EVENT, props)
      gaEvent(HOME_CTA_EVENT, props)
    }
  }
  const pad = Math.round(height / 4)
  const playImgH = (height * PLAY_IMG_H) / PLAY_BADGE_H
  const playInset = (height * PLAY_PAD) / PLAY_BADGE_H

  return (
    <div className={className}>
      <div className={`flex ${layout === 'column' ? 'flex-col items-start' : 'flex-wrap items-center'}`} style={{ gap: pad }}>
        <a
          href={iosUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('ios')}
          className="inline-block leading-none"
          style={{ padding: pad, margin: -pad }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/store/app-store-badge-black-en-us.svg" alt="Download on the App Store" style={{ height }} />
        </a>
        <a
          href={androidUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('android')}
          className="inline-block leading-none"
          style={{ padding: pad, margin: -pad }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/store/google-play-badge-en.png"
            alt="Get it on Google Play"
            style={{ height: playImgH, maxWidth: 'none', margin: -playInset }}
          />
        </a>
      </div>
      {credit && <p className="mt-3 max-w-[60ch] text-[11px] leading-[1.5] text-ink-tertiary">{STORE_CREDIT_LINES}</p>}
    </div>
  )
}
