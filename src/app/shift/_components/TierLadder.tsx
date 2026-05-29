const TIERS: {
  name: string
  chevrons: number
  color: string
  current?: boolean
  tag?: string
}[] = [
  { name: 'Starter', chevrons: 1, color: '#B6BBC9' },
  { name: 'Mover', chevrons: 1, color: '#2966E5', tag: 'Perks unlock here' },
  { name: 'Shifter', chevrons: 2, color: '#BAF14D', current: true },
  { name: 'Pacesetter', chevrons: 3, color: '#E8A93C' },
  { name: 'Trailblazer', chevrons: 3, color: 'url(#tbGrad)' },
]

function ChevronBadge({ count, color }: { count: number; color: string }) {
  const w = count === 1 ? 16 : count === 2 ? 30 : 44
  const isGradient = color.startsWith('url(')
  return (
    <svg viewBox={`0 0 ${w} 28`} className="h-[24px] w-auto">
      {isGradient && (
        <defs>
          <linearGradient id="tbGrad" gradientUnits="userSpaceOnUse" x1="3" y1="14" x2={w - 4} y2="14">
            <stop offset="0" stopColor="#2966E5" />
            <stop offset="0.5" stopColor="#52B788" />
            <stop offset="1" stopColor="#BAF14D" />
          </linearGradient>
        </defs>
      )}
      {Array.from({ length: count }, (_, i) => {
        const x = i * 14
        return (
          <polyline
            key={i}
            points={`${x + 3},5 ${x + 12},14 ${x + 3},23`}
            fill="none"
            stroke={color}
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
    </svg>
  )
}

export default function TierLadder() {
  return (
    <div className="flex flex-col gap-2.5">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className={`flex items-center gap-4 rounded-[14px] px-[18px] py-[13px] ${
            tier.current
              ? 'border-[1.5px] border-[#BAF14D] bg-[rgba(186,241,77,0.07)]'
              : 'border border-[#2E3252] bg-[#1E2038]'
          }`}
        >
          <span className="flex w-[44px] shrink-0 items-center">
            <ChevronBadge count={tier.chevrons} color={tier.color} />
          </span>
          <span
            className="font-display text-[17px] font-bold"
            style={{ color: tier.current ? '#BAF14D' : tier.name === 'Mover' ? '#7AA2FF' : '#E8E8EE' }}
          >
            {tier.name}
          </span>
          {tier.current && (
            <span className="ml-3 rounded-full bg-[rgba(186,241,77,0.18)] px-3 py-1 font-display text-xs font-bold tracking-[0.02em] text-[#BAF14D]">
              Current
            </span>
          )}
          {tier.tag && (
            <span className="ml-auto font-display text-xs font-semibold text-[#52B788]">
              {tier.tag}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
