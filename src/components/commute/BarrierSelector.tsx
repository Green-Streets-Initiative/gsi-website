'use client'

import type { Mode, BarrierCode } from '@/lib/types/commute'

interface BarrierOption {
  code: BarrierCode
  label: string
}

const BIKE_BARRIERS: BarrierOption[] = [
  { code: 'safety', label: "I'm not confident biking in traffic" },
  { code: 'routes', label: "I don't know the best route" },
  { code: 'logistics', label: "I'm worried about arriving sweaty" },
  { code: 'weather', label: "I don't want to deal with weather" },
  { code: 'time', label: "I'm not sure it would be faster" },
  { code: 'habit', label: "Nothing — I'm ready to try it" },
]

const TRANSIT_BARRIERS: BarrierOption[] = [
  { code: 'logistics', label: 'It seems complicated to plan' },
  { code: 'time', label: "I'm not sure it would be faster" },
  { code: 'routes', label: "I don't know which routes to take" },
  { code: 'habit', label: "Nothing — I'm ready to try it" },
]

const WALK_BARRIERS: BarrierOption[] = [
  { code: 'time', label: 'It takes too long' },
  { code: 'carrying', label: 'I need to carry things' },
  { code: 'habit', label: "Nothing — I'm ready to try it" },
]

function getBarriersForModes(modes: Mode[]): BarrierOption[] {
  if (modes.includes('walk')) return WALK_BARRIERS
  if (modes.includes('transit') || modes.includes('bus')) {
    if (modes.includes('bike') || modes.includes('ebike')) return BIKE_BARRIERS
    return TRANSIT_BARRIERS
  }
  if (modes.includes('bike') || modes.includes('ebike')) return BIKE_BARRIERS
  return BIKE_BARRIERS
}

interface BarrierSelectorProps {
  modes: Mode[]
  selected: BarrierCode | null
  onSelect: (barrier: BarrierCode) => void
}

export default function BarrierSelector({ modes, selected, onSelect }: BarrierSelectorProps) {
  const barriers = getBarriersForModes(modes)

  return (
    <div className="mt-6 rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
        One more thing
      </div>
      <h4 className="mb-5 font-display text-[1.125rem] font-bold text-white">
        What&apos;s your biggest hesitation?
      </h4>

      <div className="flex flex-col gap-2.5">
        {barriers.map((b) => (
          <button
            key={b.code}
            onClick={() => onSelect(b.code)}
            className={`rounded-xl border px-4 py-3 text-left text-[0.9375rem] transition-colors ${
              selected === b.code
                ? 'border-[#BAF14D]/40 bg-[#BAF14D]/[0.08] text-white'
                : 'border-white/[0.08] text-white/70 hover:border-white/[0.2] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected === b.code ? 'border-[#BAF14D] bg-[#BAF14D]' : 'border-white/30'
                }`}
              >
                {selected === b.code && (
                  <div className="h-2 w-2 rounded-full bg-[#191A2E]" />
                )}
              </div>
              {b.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
