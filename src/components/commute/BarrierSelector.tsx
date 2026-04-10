'use client'

import type { Mode, BarrierCode } from '@/lib/types/commute'

interface BarrierOption {
  code: BarrierCode
  label: string
}

const BIKE_BARRIERS: BarrierOption[] = [
  { code: 'safety', label: "I'm not confident biking in traffic" },
  { code: 'routes', label: "I don't know the best route" },
  { code: 'sweating', label: "I'm worried about arriving sweaty" },
  { code: 'gear', label: "I don't know what gear I need" },
  { code: 'bike_parking', label: "I'm not sure where to park my bike" },
  { code: 'weather', label: "I don't want to deal with weather" },
  { code: 'time', label: "I'm not sure it would be faster" },
  { code: 'habit', label: "Nothing — I'm ready to try it" },
]

const TRANSIT_BARRIERS: BarrierOption[] = [
  { code: 'planning', label: 'It seems complicated to plan' },
  { code: 'time', label: "I'm not sure it would be faster" },
  { code: 'routes', label: "I don't know which routes to take" },
  { code: 'habit', label: "Nothing — I'm ready to try it" },
]

const WALK_BARRIERS: BarrierOption[] = [
  { code: 'time', label: 'It takes too long' },
  { code: 'carrying', label: 'I need to carry things' },
  { code: 'weather', label: "I don't want to deal with weather" },
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
  selected: BarrierCode[]
  onSelect: (barriers: BarrierCode[]) => void
}

export default function BarrierSelector({ modes, selected, onSelect }: BarrierSelectorProps) {
  const barriers = getBarriersForModes(modes)

  const toggleBarrier = (code: BarrierCode) => {
    if (code === 'habit') {
      // "Ready to try it" clears all others
      onSelect(selected.includes('habit') ? [] : ['habit'])
      return
    }
    // Remove 'habit' if selecting a real barrier
    const without = selected.filter(b => b !== 'habit' && b !== code)
    if (selected.includes(code)) {
      onSelect(without)
    } else {
      onSelect([...without, code])
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
        One more thing
      </div>
      <h4 className="mb-1 font-display text-[1.125rem] font-bold text-white">
        Any hesitations?
      </h4>
      <p className="mb-5 text-[0.8125rem] text-white/40">Select all that apply</p>

      <div className="flex flex-col gap-2.5">
        {barriers.map((b) => {
          const isSelected = selected.includes(b.code)
          return (
            <button
              key={b.code}
              onClick={() => toggleBarrier(b.code)}
              className={`rounded-xl border px-4 py-3 text-left text-[0.9375rem] transition-colors ${
                isSelected
                  ? 'border-[#BAF14D]/40 bg-[#BAF14D]/[0.08] text-white'
                  : 'border-white/[0.08] text-white/70 hover:border-white/[0.2] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                    b.code === 'habit' ? 'rounded-full' : ''
                  } border-2 ${
                    isSelected ? 'border-[#BAF14D] bg-[#BAF14D]' : 'border-white/30'
                  }`}
                >
                  {isSelected && (
                    <svg className="h-3 w-3 text-[#191A2E]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                {b.label}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
