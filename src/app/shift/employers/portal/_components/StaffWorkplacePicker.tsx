'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Check, Search } from 'lucide-react'
import Badge from '@/components/employer/Badge'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import { TIER_LABEL } from '../_lib/portal-constants'
import { openStaffWorkplace } from '../_lib/staff-workplace'

type Workplace = {
  id: string
  name: string
  tier: string | null
  status: string | null
  agreementSigned: boolean
  team: number
}

/**
 * Every workplace a staff member can open: the employer workplaces, plus
 * any other group with a portal team. Staff read all groups and team rows
 * under RLS (is_gsi_admin), so this is two plain reads.
 */
async function loadWorkplaces(): Promise<Workplace[]> {
  const cols = 'id, name, tier, status, agreement_accepted_at'
  const [wp, ga] = await Promise.all([
    supabase.from('groups').select(cols).eq('type', 'workplace'),
    supabase.from('group_admins').select('group_id'),
  ])
  if (wp.error) throw wp.error
  const team = new Map<string, number>()
  for (const r of ga.data ?? []) team.set(r.group_id, (team.get(r.group_id) ?? 0) + 1)
  const rows = [...(wp.data ?? [])]
  const missing = [...team.keys()].filter((id) => !rows.some((r) => r.id === id))
  if (missing.length) {
    const { data } = await supabase.from('groups').select(cols).in('id', missing)
    rows.push(...(data ?? []))
  }
  return rows
    .map((g) => ({
      id: g.id as string,
      name: (g.name as string) || 'Unnamed workplace',
      tier: g.tier as string | null,
      status: g.status as string | null,
      agreementSigned: !!g.agreement_accepted_at,
      team: team.get(g.id as string) ?? 0,
    }))
    .sort((a, b) => Number(b.team > 0) - Number(a.team > 0) || a.name.localeCompare(b.name))
}

/** The searchable list. Used in the Switch dialog and on its own when staff are on no team. */
export function StaffWorkplaceList({ autoFocus = false }: { autoFocus?: boolean }) {
  const { group } = usePortal()
  const [all, setAll] = useState<Workplace[] | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [opening, setOpening] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let live = true
    loadWorkplaces()
      .then((w) => live && setAll(w))
      .catch(() => live && setError(true))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (all ?? []).filter((w) => !q || w.name.toLowerCase().includes(q))
  }, [all, query])

  function open(w: Workplace) {
    if (w.id === group?.id) return
    setOpening(w.id)
    openStaffWorkplace(w.id)
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Search size={18} strokeWidth={1.75} className="shrink-0 text-ink-icon" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && shown[0]) open(shown[0])
          }}
          placeholder="Find a workplace"
          aria-label="Find a workplace"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-tertiary"
        />
      </div>
      <ul className="max-h-[min(420px,60vh)] overflow-y-auto py-1" aria-label="Workplaces">
        {error && (
          <li className="px-4 py-8 text-center text-[15px] text-ep-danger">
            We couldn&apos;t load the workplaces. Reload the page to try again.
          </li>
        )}
        {!error && !all && <li className="px-4 py-8 text-center text-[15px] text-ink-muted">Loading workplaces…</li>}
        {all && shown.length === 0 && (
          <li className="px-4 py-8 text-center text-[15px] text-ink-muted">Nothing matches &ldquo;{query}&rdquo;</li>
        )}
        {shown.map((w) => {
          const current = w.id === group?.id
          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => open(w)}
                disabled={!!opening}
                aria-current={current ? 'true' : undefined}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors disabled:cursor-wait sm:items-center ${
                  current ? 'bg-accent-softer' : 'hover:bg-surface-2'
                }`}
              >
                <Building2 size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-icon sm:mt-0" />
                {/* Chips sit under the name on a phone and to its right from sm up. */}
                <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-0 sm:flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{w.name}</span>
                    <span className="block text-[14px] text-ink-tertiary">
                      {opening === w.id
                        ? 'Opening…'
                        : w.team === 0
                          ? 'No portal team yet'
                          : `${w.team} on the portal team`}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                    {w.tier && <Badge>{TIER_LABEL[w.tier] ?? w.tier}</Badge>}
                    {/* Only a workplace with a portal team has an agreement to sign. */}
                    {w.team > 0 &&
                      (w.agreementSigned ? (
                        <Badge tone="success" dot>
                          Agreement signed
                        </Badge>
                      ) : (
                        <Badge tone="warn" dot>
                          No agreement
                        </Badge>
                      ))}
                  </span>
                </span>
                {current && <Check size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-accent sm:mt-0" aria-label="Open now" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The Switch dialog from the staff bar. */
export default function StaffWorkplacePicker({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-ink/30" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[min(14vh,120px)]" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Open a workplace as staff"
          className="mx-4 w-full max-w-[560px] overflow-hidden rounded-[14px] bg-surface shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 pb-1 pt-4">
            <h2 className="font-headline text-[18px] font-extrabold text-ink">Open a workplace</h2>
            <p className="mt-0.5 text-[14px] text-ink-muted">You see it as Green Streets staff.</p>
          </div>
          <StaffWorkplaceList autoFocus />
        </div>
      </div>
    </>
  )
}
