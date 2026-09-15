import type { ReactNode } from 'react'

type Tone = 'dark' | 'light'

// `dark` is the app's navy product block; `light` is the same row on the
// site's cream sections, where the eyebrow goes forest and the heading serif.
function Chev({ tone }: { tone: Tone }) {
  return (
    <span className={`font-display text-[15px] font-extrabold leading-[1.4] tracking-[-0.08em] ${tone === 'light' ? 'text-forest' : 'text-[#BAF14D]'}`}>
      &#8250;&#8250;
    </span>
  )
}

export function Bullet({ children, tone = 'dark' }: { children: ReactNode; tone?: Tone }) {
  return (
    <li className={`flex gap-3 text-[15.5px] leading-[1.6] ${tone === 'light' ? 'text-ink-soft' : 'text-white/80'}`}>
      <span className="mt-0.5 shrink-0"><Chev tone={tone} /></span>
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
  tone = 'dark',
  id,
}: {
  eyebrow: string
  eyebrowColor?: string
  heading: string
  children: ReactNode
  media: ReactNode
  reverse?: boolean
  darkAlt?: boolean
  tone?: Tone
  id?: string
}) {
  const light = tone === 'light'
  // Teal and lime eyebrows are tuned for navy; on cream every eyebrow is forest.
  const eyebrowStyle = light ? undefined : { color: eyebrowColor }
  return (
    <div
      id={id}
      className={`px-8 py-10 ${darkAlt && !light ? 'bg-[#121320]' : ''}`}
    >
      <div className="mx-auto grid max-w-[1120px] items-center gap-16 md:grid-cols-2">
        {/* Copy side */}
        <div className={reverse ? 'md:order-2' : ''}>
          <span
            className={`mb-1 inline-flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] ${light ? 'text-forest' : ''}`}
            style={eyebrowStyle}
          >
            <span className="font-extrabold tracking-[-0.08em]" style={eyebrowStyle}>
              &#8250;&#8250;
            </span>
            {eyebrow}
          </span>
          <h3 className={light
            ? 'mt-4 font-serif text-[clamp(1.75rem,3vw,2.25rem)] font-normal leading-[1.1] text-navy'
            : 'mt-4 font-display text-[clamp(22px,2.6vw,30px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-white'}>
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
