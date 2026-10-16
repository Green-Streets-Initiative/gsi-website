'use client'

import { Armchair, Backpack, FlagCheckered, Key, Lock, PathIcon, TShirt, type Icon } from '@phosphor-icons/react'
import type { StageLabel, TripStage } from './trip-stages'

/**
 * The six stages of one way in as a compact icon strip under its row:
 * Wear, Vehicle, Cargo, Route, Arrive, Store. One short fact each; a stage
 * with nothing to do (no vehicle, nothing to store) draws faint. (Seat
 * said "Rider" or "Driver" and was cut, 2026-10-15; the label stays in the
 * type because the guide questions still map onto it.)
 * Icons at the house weight (regular at 15dp and up); Lock is a state
 * marker and may fill, but here it names the stage, so it stays regular.
 *
 * The strip is its own row under the mode row, the full width of the card
 * (Keith 2026-10-06: "spaced evenly horizontally and vertically, not
 * offset a bit to the top and right"). It is not on the grid's template:
 * six equal columns from 560px, with the same padding on every side and
 * the three lines (icon, label, fact) stacked on one line-height. The fact
 * has room for two lines, so every stage's baseline matches across the
 * row. Under 560px the six wrap to two centred rows of three.
 */

export const STAGE_ICONS: Record<StageLabel, Icon> = {
  Wear: TShirt,
  Vehicle: Key,
  Cargo: Backpack,
  Route: PathIcon,
  Seat: Armchair,
  Arrive: FlagCheckered,
  Store: Lock,
}

export default function StageStrip({ stages, open = false }: {
  stages: TripStage[]
  open?: boolean
}) {
  return (
    <div
      className={`flex flex-wrap justify-center border-t border-dashed border-[rgba(25,26,46,0.12)] px-3 py-3 min-[560px]:grid min-[560px]:grid-cols-[repeat(6,minmax(0,1fr))] ${open ? 'bg-[#E7F0EA]' : ''}`}
      role="group"
      aria-label="The trip, stage by stage"
    >
      {stages.map((s) => {
        const I = STAGE_ICONS[s.label]
        return (
          <div
            key={s.label}
            className="flex min-w-0 basis-1/3 flex-col items-center px-1 text-center min-[560px]:basis-auto"
            title={`${s.label}: ${s.fact}`}
          >
            {/* A muted stage fades its icon and softens its label; the text
                itself stays at full contrast (portal review A11Y-10). */}
            <I size={18} weight="regular" className={`mb-1 shrink-0 text-[#2D6A4F] ${s.muted ? 'opacity-45' : ''}`} aria-hidden />
            <span className={`text-[0.66rem] font-bold leading-[1.3] ${s.muted ? 'text-[#4A4D68]' : 'text-[#191A2E]'}`}>{s.label}</span>
            <span className="min-h-[calc(2*1.3*0.66rem)] text-[0.66rem] leading-[1.3] text-[#4A4D68]">{s.fact}</span>
          </div>
        )
      })}
    </div>
  )
}
