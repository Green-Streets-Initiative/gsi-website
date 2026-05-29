import type { ReactNode } from 'react'

const CHEV = (
  <span className="font-display text-[15px] font-extrabold leading-[1.4] tracking-[-0.08em] text-[#BAF14D]">
    &#8250;&#8250;
  </span>
)

export function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-[15.5px] leading-[1.6] text-white/80">
      <span className="mt-0.5 shrink-0">{CHEV}</span>
      <span>{children}</span>
    </li>
  )
}

export default function FeatureRow({
  eyebrow,
  eyebrowColor = '#BAF14D',
  heading,
  children,
  media,
  reverse = false,
  darkAlt = false,
  id,
}: {
  eyebrow: string
  eyebrowColor?: string
  heading: string
  children: ReactNode
  media: ReactNode
  reverse?: boolean
  darkAlt?: boolean
  id?: string
}) {
  return (
    <div
      id={id}
      className={`px-8 py-10 ${darkAlt ? 'bg-[#121320]' : ''}`}
    >
      <div className="mx-auto grid max-w-[1120px] items-center gap-16 md:grid-cols-2">
        {/* Copy side */}
        <div className={reverse ? 'md:order-2' : ''}>
          <span
            className="mb-1 inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em]"
            style={{ color: eyebrowColor }}
          >
            <span className="font-extrabold tracking-[-0.08em]" style={{ color: eyebrowColor }}>
              &#8250;&#8250;
            </span>
            {eyebrow}
          </span>
          <h3 className="mt-4 font-display text-[clamp(22px,2.6vw,30px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-white">
            {heading}
          </h3>
          <div className="mt-5">{children}</div>
        </div>

        {/* Visual side */}
        <div className={`flex justify-center ${reverse ? 'md:order-1' : ''}`}>
          {media}
        </div>
      </div>
    </div>
  )
}
