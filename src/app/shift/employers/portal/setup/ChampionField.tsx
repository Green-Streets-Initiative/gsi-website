'use client'

import { useId, useState, type KeyboardEvent } from 'react'
import { matchSuggestions, type ChampionSuggestion } from './champion-suggestions'

/**
 * A champion's name or email field that suggests people as you type: team
 * members and people on the invitation list (Keith 2026-10-01). Picking one
 * fills both fields when both are known. A plain text field otherwise, so
 * anyone can still be typed in by hand.
 *
 * ARIA 1.2 combobox: the input owns a listbox; Up/Down move through it,
 * Enter picks, Escape closes, and the active option is announced through
 * aria-activedescendant while focus stays in the field.
 */
export default function ChampionField({
  field,
  value,
  onChange,
  onPick,
  suggestions,
  exclude,
  label,
  placeholder,
  className,
}: {
  field: 'name' | 'email'
  value: string
  onChange: (v: string) => void
  onPick: (s: ChampionSuggestion) => void
  suggestions: ChampionSuggestion[]
  exclude: { emails: Set<string>; names: Set<string> }
  label: string
  placeholder: string
  className: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const matches = open ? matchSuggestions(suggestions, value, exclude) : []
  const expanded = matches.length > 0
  const optionId = (i: number) => `${listId}-opt-${i}`

  function pick(s: ChampionSuggestion) {
    onPick(s)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      if (matches.length) setActive((a) => (a + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      if (!expanded) return
      e.preventDefault()
      setActive((a) => (a <= 0 ? matches.length - 1 : a - 1))
    } else if (e.key === 'Enter') {
      if (expanded && active >= 0 && matches[active]) {
        e.preventDefault()
        pick(matches[active])
      }
    } else if (e.key === 'Escape') {
      if (expanded) {
        e.preventDefault()
        setOpen(false)
        setActive(-1)
      }
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        type={field === 'email' ? 'email' : 'text'}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={`People matching "${value.trim()}"`}
        hidden={!expanded}
        className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-[264px] min-w-[240px] overflow-auto rounded-[10px] border border-line bg-surface py-1 shadow-lg"
      >
        {matches.map((s, i) => (
          <li
            key={s.key}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            // mousedown only keeps focus in the field (so it never blurs); the
            // pick happens on click, which screen-reader activation also sends.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(s)}
            onMouseEnter={() => setActive(i)}
            className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left ${
              i === active ? 'bg-accent-soft' : ''
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-ink">{s.name ?? s.email}</span>
              {s.name && s.email && <span className="block truncate text-[12.5px] text-ink-muted">{s.email}</span>}
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-ink-muted">
              {s.source === 'joined' ? 'On the team' : 'Invited'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
