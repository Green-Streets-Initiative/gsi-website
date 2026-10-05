'use client'

import { useRef, type KeyboardEvent } from 'react'

/**
 * A row of tabs at the top of a page or card (Keith 2026-10-05: long pages
 * get tabs at the top, not stacked cards, and nothing may be discoverable
 * only by scrolling). Always visible at every width; scrolls sideways on a
 * phone instead of wrapping. Arrow keys move between tabs, Home/End jump to
 * the ends. Panels take `tabPanelProps()` so screen readers tie them to
 * their tab.
 */
export type TabItem = {
  id: string
  label: string
  /** A number shown after the label (people, requests). */
  count?: number
}

export function tabId(prefix: string, id: string) {
  return `${prefix}-tab-${id}`
}

export function tabPanelProps(prefix: string, id: string) {
  return {
    role: 'tabpanel' as const,
    id: `${prefix}-panel-${id}`,
    'aria-labelledby': tabId(prefix, id),
    tabIndex: 0,
  }
}

export default function TabStrip<T extends string>({
  tabs,
  value,
  onChange,
  label,
  prefix,
  className = '',
}: {
  tabs: TabItem[]
  value: T
  onChange: (id: T) => void
  /** What this set of tabs switches between, for assistive tech. */
  label: string
  /** Makes the tab and panel ids unique on the page. */
  prefix: string
  className?: string
}) {
  const listRef = useRef<HTMLDivElement>(null)

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next === null) return
    e.preventDefault()
    const target = tabs[next]
    onChange(target.id as T)
    listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(prefix, target.id))}`)?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={`flex items-end gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {tabs.map((t, i) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={tabId(prefix, t.id)}
            aria-selected={on}
            aria-controls={`${prefix}-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id as T)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-[8px] border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              on
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:border-line hover:text-ink'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span
                className={`rounded-full px-[7px] py-[1px] text-[11.5px] font-semibold leading-[1.4] ${
                  on ? 'bg-accent-soft text-accent-ink' : 'bg-surface-2 text-ink-muted'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
