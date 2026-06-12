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
      onSelect(selected.includes('habit') ? [] : ['habit'])
      return
    }
    const without = selected.filter(b => b !== 'habit' && b !== code)
    if (selected.includes(code)) {
      onSelect(without)
    } else {
      onSelect([...without, code])
    }
  }

  return (
    <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-7 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A5C6E]">
        One more thing
      </div>
      <h4 className="mb-1 text-[1.125rem] font-bold text-[#191A2E]">
        Any hesitations?
      </h4>
      <p className="mb-5 text-[0.8125rem] text-[#5A5C6E]">Select all that apply</p>

      <div className="flex flex-col gap-2.5">
        {barriers.map((b) => {
          const isSelected = selected.includes(b.code)
          return (
            <button
              key={b.code}
              onClick={() => toggleBarrier(b.code)}
              className={`rounded-xl border px-4 py-3 text-left text-[0.9375rem] transition-colors ${
                isSelected
                  ? 'border-[#2D6A4F]/30 bg-[#E7F0EA] text-[#191A2E]'
                  : 'border-[rgba(25,26,46,0.06)] text-[#5A5C6E] hover:border-[rgba(25,26,46,0.12)] hover:text-[#191A2E]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                    b.code === 'habit' ? 'rounded-full' : ''
                  } border-2 ${
                    isSelected ? 'border-[#2D6A4F] bg-[#2D6A4F]' : 'border-[rgba(25,26,46,0.18)]'
                  }`}
                >
                  {isSelected && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
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
