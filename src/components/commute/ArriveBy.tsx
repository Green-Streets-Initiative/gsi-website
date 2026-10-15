'use client'

import { useId, useState } from 'react'
import { formatClock } from '@/lib/employer/commute-costs'

/**
 * "Arrive by 9:00 · change": the time the plan is built around. Reads as a
 * sentence until tapped, then a time input. The employer page seeds it from
 * the office's usual start; the public page from 09:00.
 */
export default function ArriveBy({ value, onChange }: { value: string; onChange: (hhmm: string) => void }) {
  const [editing, setEditing] = useState(false)
  const id = useId()

  if (!editing) {
    return (
      <p className="text-[0.9375rem] text-[#191A2E]">
        Arrive by <span className="font-bold">{formatClock(value)}</span>
        <span className="mx-1.5 text-[#5A5C6E]">·</span>
        <button type="button" onClick={() => setEditing(true)} className="font-semibold text-[#2D6A4F] underline-offset-2 hover:underline">
          change
        </button>
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label htmlFor={id} className="text-[0.9375rem] text-[#191A2E]">Arrive by</label>
      <input
        id={id}
        type="time"
        value={value}
        step={300}
        autoFocus
        onChange={(e) => { if (/^\d{2}:\d{2}/.test(e.target.value)) onChange(e.target.value.slice(0, 5)) }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false) }}
        className="rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.15)] bg-white px-3 py-2 text-[0.9375rem] font-bold text-[#191A2E] outline-none focus:border-[#2D6A4F]"
      />
      <button type="button" onClick={() => setEditing(false)} className="text-[0.8125rem] font-semibold text-[#2D6A4F]">
        Done
      </button>
    </div>
  )
}
