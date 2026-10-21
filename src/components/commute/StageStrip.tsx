'use client'

import { useId, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Armchair, ArrowRight, Backpack, BookOpenText, FlagCheckered, Key, Lock, PathIcon, TShirt, X, type Icon } from '@phosphor-icons/react'
import type { StageLabel, TripStage } from './trip-stages'
import { guideHref, type GuideGroup } from './guide-topics'

/**
 * The six stages of one way in as an icon strip under its row: Wear,
 * Vehicle, Cargo, Route, Arrive, Store. One short fact each; a stage with
 * nothing to do (no vehicle, nothing to store) draws faint. (Seat said
 * "Rider" or "Driver" and was cut, 2026-10-15; the label stays in the
 * type because the guide questions still map onto it.)
 * Icons at the house weight (regular at 15dp and up); Lock is a state
 * marker and may fill, but here it names the stage, so it stays regular.
 *
 * A stage with guides is a button with a small book on its icon; tapping
 * it opens that stage's guides in a panel right under the strip, and
 * tapping it again (or another stage) closes or swaps it. Closed by
 * default (Keith 2026-10-21: the guides belong to the stages, not a card
 * at the bottom of the page, and not open until asked for).
 *
 * The strip is its own row under the mode row, the full width of the card
 * (Keith 2026-10-06: "spaced evenly horizontally and vertically, not
 * offset a bit to the top and right"): six equal columns from 560px, the
 * three lines (icon, label, fact) stacked the same in every cell. Under
 * 560px the six wrap to two centred rows of three.
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

export default function StageStrip({ stages, open = false, guides, more, onGuideEvent }: {
  stages: TripStage[]
  open?: boolean
  /** The open row's guides, by the stage they open from. */
  guides?: Partial<Record<StageLabel, GuideGroup[]>>
  /** "All biking guides" under the open panel. */
  more?: { href: string; label: string } | null
  onGuideEvent?: (name: 'advisor_stage_guides_opened' | 'advisor_guide_clicked', props: Record<string, unknown>) => void
}) {
  const [active, setActive] = useState<StageLabel | null>(null)
  const base = useId()
  const panelId = `${base}-guides`
  const groups = active ? guides?.[active] ?? [] : []
  const ActiveIcon = active ? STAGE_ICONS[active] : null
  // The panel's pointer sits under the open stage, so the guides read as that
  // stage's (Keith 2026-10-21: the panel needed a clearer tie to what it abuts).
  const wrapRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<StageLabel, HTMLButtonElement>())
  const [pointerX, setPointerX] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!active) return
    const place = () => {
      const cell = cellRefs.current.get(active)
      const wrap = wrapRef.current
      if (!cell || !wrap) return
      const a = cell.getBoundingClientRect()
      const b = wrap.getBoundingClientRect()
      setPointerX(a.left + a.width / 2 - b.left)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [active])

  return (
    // The space under an open panel is padding, not the panel's margin: a
    // margin collapsed through this box and showed the card's white between
    // the panel and the drawer.
    <div ref={wrapRef} className={`border-t border-dashed border-[rgba(25,26,46,0.12)] ${open ? 'bg-[#E7F0EA]' : ''} ${active && groups.length > 0 ? 'pb-4' : ''}`}>
      <div
        className="flex flex-wrap justify-center gap-y-1 px-3 py-3 min-[560px]:grid min-[560px]:grid-cols-[repeat(6,minmax(0,1fr))] min-[560px]:gap-x-1"
        role="group"
        aria-label="The trip, stage by stage"
      >
        {stages.map((s) => {
          const I = STAGE_ICONS[s.label]
          const count = (guides?.[s.label] ?? []).reduce((n, g) => n + g.guides.length, 0)
          const isOn = active === s.label
          const body = (
            <>
              {/* A muted stage fades its icon; the text itself stays at full contrast (portal review A11Y-10). */}
              <span className="relative mb-1 inline-flex">
                <I size={22} weight="regular" className={`shrink-0 text-[#2D6A4F] ${s.muted ? 'opacity-45' : ''}`} aria-hidden />
                {count > 0 && (
                  <span aria-hidden className={`absolute -right-2.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2 ${isOn ? 'bg-[#191A2E] ring-white' : 'bg-[#2D6A4F] ring-[#E7F0EA]'}`}>
                    <BookOpenText size={11} weight="bold" className="text-white" />
                  </span>
                )}
              </span>
              <span className={`text-[0.875rem] font-bold leading-tight ${s.muted ? 'text-[#4A4D68]' : 'text-[#191A2E]'}`}>{s.label}</span>
              <span className="mt-0.5 text-[0.875rem] leading-snug text-[#4A4D68]">{s.fact}</span>
            </>
          )
          const cell = 'flex min-w-0 basis-1/3 flex-col items-center rounded-lg px-1 py-1.5 text-center min-[560px]:basis-auto'
          if (count === 0) {
            return <div key={s.label} className={cell}>{body}</div>
          }
          return (
            <button
              key={s.label}
              ref={(el) => { if (el) cellRefs.current.set(s.label, el); else cellRefs.current.delete(s.label) }}
              type="button"
              aria-expanded={isOn}
              aria-controls={panelId}
              aria-label={`${s.label}: ${s.fact}. ${count} guide${count === 1 ? '' : 's'}`}
              onClick={() => {
                const next = isOn ? null : s.label
                setActive(next)
                if (next) onGuideEvent?.('advisor_stage_guides_opened', { stage: next, guides: count })
              }}
              className={`${cell} cursor-pointer transition-colors ${isOn ? 'bg-white shadow-[0_1px_2px_rgba(25,26,46,0.08)]' : 'hover:bg-white/70'}`}
            >
              {body}
            </button>
          )
        })}
      </div>

      {active && groups.length > 0 && ActiveIcon && (
        <div id={panelId} className="relative mx-3 rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 pb-3.5 pt-3 shadow-[0_2px_6px_rgba(25,26,46,0.06)]">
          {pointerX != null && (
            <span
              aria-hidden
              className="absolute -top-[8px] h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-l border-t border-[rgba(25,26,46,0.12)] bg-white"
              // The panel starts 12px in (mx-3); the pointer is placed in the panel's own box.
              style={{ left: pointerX - 12 }}
            />
          )}
          <div className="divide-y divide-[rgba(25,26,46,0.08)]">
            {groups.map((grp, gi) => (
              <section key={grp.question} className={gi > 0 ? 'pt-3' : ''}>
                <div className="mb-1 flex items-center gap-2">
                  <ActiveIcon size={20} weight="regular" className="shrink-0 text-[#2D6A4F]" aria-hidden />
                  <h4 className="m-0 flex-1 text-[1rem] font-extrabold text-[#191A2E]">{grp.question}</h4>
                  {gi === 0 && (
                    <button type="button" onClick={() => setActive(null)} aria-label="Close the guides" className="-my-2 -mr-3 flex h-11 w-11 items-center justify-center rounded-full text-[#4A4D68] hover:bg-[#F4F8EE] hover:text-[#191A2E]">
                      <X size={18} weight="bold" aria-hidden />
                    </button>
                  )}
                </div>
                <ul className={`m-0 list-none p-0 ${gi < groups.length - 1 ? 'pb-2' : ''}`}>
                  {grp.guides.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={guideHref(g)}
                        target="_blank"
                        rel="noopener"
                        onClick={() => onGuideEvent?.('advisor_guide_clicked', { guide_id: g.id, question: grp.question, stage: active })}
                        className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[0.9375rem] font-semibold leading-snug text-[#191A2E] hover:bg-[#F4F8EE] hover:text-[#2D6A4F]"
                      >
                        {g.title}
                        <ArrowRight size={16} weight="bold" className="shrink-0 text-[#2D6A4F]" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {more && (
            <div className="mt-2 border-t border-[rgba(25,26,46,0.08)] pt-2.5">
              <Link href={more.href} target="_blank" rel="noopener" className="text-[0.875rem] font-semibold text-[#2D6A4F] hover:underline">
                {more.label}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
