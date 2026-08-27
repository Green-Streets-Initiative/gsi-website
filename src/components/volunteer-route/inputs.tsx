'use client'

// Shared inputs for the volunteer walk form. Visual language matches the
// original portal (pill radios, brand blue, dark-navy section headers).

export function RadioGroup({ label, value, options, onChange }: {
  label: string
  value: string | null
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-[#191A2E] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              value === opt.value
                ? 'border-[#2966E5] bg-[#2966E5]/10 text-[#2966E5] font-medium'
                : 'border-gray-200 bg-white text-[#6B7280] hover:border-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ConditionalNote({ show, value, onChange, placeholder }: {
  show: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  if (!show) return null
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Describe...'}
      rows={2}
      className="mt-1 mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none"
    />
  )
}

export function ScoreSlider({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-[#191A2E]">{label}</span>
        <span className="text-lg font-bold text-[#2966E5]">{value}</span>
      </div>
      <input
        type="range" min={1} max={10} step={1} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-[#2966E5]"
      />
      <div className="flex justify-between text-[10px] text-[#6B7280]">
        <span>1 (Poor)</span><span>10 (Excellent)</span>
      </div>
    </div>
  )
}

export function NumberField({ label, value, onChange, placeholder, unit }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  unit?: string
}) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-[#191A2E] mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none"
        />
        {unit && <span className="text-xs text-[#6B7280]">{unit}</span>}
      </div>
    </div>
  )
}

export function FreeTextField({ label, value, onChange, placeholder, rows = 2 }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-[#191A2E] mb-1">{label}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none"
      />
    </div>
  )
}
