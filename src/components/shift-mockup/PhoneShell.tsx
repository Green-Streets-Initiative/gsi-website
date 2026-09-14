import type { ReactNode } from 'react'

/** Native width of the screen inside the bezel (matches the app artboard). */
export const SCREEN_WIDTH = 402
/** Bezel padding on each side. */
export const BEZEL = 10

/**
 * A phone bezel that wraps arbitrary children (the CSS-built home screen).
 * Same gradient, radius, and island as the image-based PhoneFrame on /shift,
 * so phones look alike site-wide.
 */
export default function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[44px] shadow-[0_40px_80px_-28px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset]"
      style={{ background: 'linear-gradient(160deg, #2A2D4A, #0E0F1A)', padding: BEZEL, width: SCREEN_WIDTH + BEZEL * 2 }}
    >
      <div className="relative overflow-hidden rounded-[34px] bg-[#191A2E]" style={{ width: SCREEN_WIDTH }}>
        {/* Dynamic island */}
        <div className="absolute left-1/2 top-[12px] z-10 h-[26px] w-[90px] -translate-x-1/2 rounded-full bg-black" />
        {children}
      </div>
    </div>
  )
}
