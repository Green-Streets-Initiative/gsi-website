'use client'

import PhoneShell, { BEZEL, SCREEN_WIDTH } from '@/components/shift-mockup/PhoneShell'
import PartnerCobrand from '@/components/nearby/PartnerCobrand'
import { useSignup } from './PartnerSignupForm'

/**
 * The page residents get, on a phone: a real screenshot of /nearby at 375px
 * (Prospect Hill, Somerville, New Routes context) with the partner strip left blank, and
 * the live PartnerCobrand drawn into that strip from the form's name and
 * logo. Same component and row classes as NearbyShell, so what the visitor
 * sees here is what their residents see.
 *
 * Screenshot: public/images/move-in/nearby-phone.webp, 375×812 CSS px at 2x.
 * The blank strip sits at STRIP_TOP. Retake it (headless Chrome, partner
 * row emptied before capture) if /nearby's mobile header changes. Pick a
 * residential block a few minutes from a square, not the square itself: at
 * a T station the nearest bus stops hide under the station marker. The map
 * widens its own fit as stops load, so wait for it to settle, then zoom in
 * ~4 wheel notches around the home dot (the 2026-10-12 take: lat 42.383,
 * lng -71.0975, label "Prospect Hill").
 */

const SHOT_WIDTH = 375
const SHOT_HEIGHT = 812
const STRIP_TOP = 92
const STRIP_HEIGHT = 40
const STATUS_BAR = 54
const ZOOM = SCREEN_WIDTH / SHOT_WIDTH
const MOCKUP_WIDTH = SCREEN_WIDTH + BEZEL * 2
const MOCKUP_HEIGHT = STATUS_BAR + Math.round(SHOT_HEIGHT * ZOOM) + BEZEL * 2

export default function ResidentPreview() {
  const { name, logoPreview } = useSignup()
  const displayName = name.trim()

  return (
    <div className="flex flex-col items-center lg:pt-1">
      <p className="mb-4 text-center text-[16px] font-bold text-navy">What residents see on their phone</p>
      <figure
        role="img"
        aria-label={`The neighborhood page on a phone: ${
          displayName ? `"In partnership with ${displayName}"` : 'your logo'
        } at the top, a map of nearby T stops, buses, Bluebikes and bike routes, and the $15 Shift welcome offer`}
        className="relative m-0 [--mockup-scale:0.66] sm:[--mockup-scale:0.72] lg:[--mockup-scale:0.8]"
        style={{
          width: `calc(${MOCKUP_WIDTH}px * var(--mockup-scale))`,
          height: `calc(${MOCKUP_HEIGHT}px * var(--mockup-scale))`,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none origin-top-left select-none"
          style={{ width: MOCKUP_WIDTH, height: MOCKUP_HEIGHT, transform: 'scale(var(--mockup-scale))' }}
        >
          <PhoneShell>
            <div className="bg-[#F4F8EE]" style={{ height: STATUS_BAR }} />
            <div className="relative" style={{ width: SHOT_WIDTH, height: SHOT_HEIGHT, zoom: ZOOM }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/move-in/nearby-phone.webp"
                alt=""
                width={SHOT_WIDTH}
                height={SHOT_HEIGHT}
                className="block"
              />
              <div
                className="nearby-tone-light absolute inset-x-0 flex items-center border-b border-(--nb-line) bg-(--nb-bg) px-4"
                style={{ top: STRIP_TOP, height: STRIP_HEIGHT }}
              >
                {displayName || logoPreview ? (
                  <PartnerCobrand
                    partner={{ slug: 'preview', name: displayName || 'Your logo', logoUrl: logoPreview, campaign: 'newroutes' }}
                    logoClass="max-h-6"
                    gsiClass="max-h-4"
                    textClass="text-[0.7rem]"
                  />
                ) : (
                  <LogoSlot />
                )}
              </div>
            </div>
          </PhoneShell>
        </div>
      </figure>
      <p className="mt-5 max-w-[340px] text-[15px] leading-[1.6] text-ink-soft">
        New residents who take 10 walking, biking or transit trips with Shift in their first 30
        days unlock $15 at a local shop or a digital gift card, their choice. For the first 200
        people to finish.
      </p>
    </div>
  )
}

/** Before anything is typed: the real lockup with an outlined slot where
 *  the partner's logo goes. */
function LogoSlot() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 rounded-md bg-white px-2 py-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/gsi-wordmark.png" alt="" className="max-h-4 w-auto" />
      </span>
      <span className="text-[0.7rem] leading-snug text-(--nb-ink-80)">In partnership with</span>
      <span className="shrink-0 rounded-md border border-dashed border-forest px-2 py-0.5 text-[0.7rem] font-bold text-forest">
        Your logo
      </span>
    </div>
  )
}
