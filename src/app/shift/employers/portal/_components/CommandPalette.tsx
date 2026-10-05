'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trophy, UserPlus, Wallet, Printer, LogOut, ShieldCheck, type LucideIcon } from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import { computeSetupSteps, nextSetupStep } from '../_lib/setup-steps'
import { visibleNav, isNavItem } from './Sidebar'
import Avatar from '@/components/employer/Avatar'

type ResultItem = {
  id: string
  type: 'page' | 'action' | 'employee'
  label: string
  sub?: string
  icon?: LucideIcon
  /** Where a page, action or employee result goes. */
  href?: string
  /** What an action does instead of navigating. */
  run?: () => void | Promise<void>
}

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { members, role, isAdmin, isGsiAdmin, group, benefitsForm, memberCount, challenges, loading, signOut } =
    usePortal()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const setupIncomplete =
    !loading && !!group && !!nextSetupStep(computeSetupSteps({ group, benefitsForm, memberCount, challenges }))

  const results = useMemo(() => {
    const q = query.toLowerCase().trim()

    const pages: ResultItem[] = [
      ...visibleNav({ role, isGsiAdmin, setupIncomplete })
        .filter(isNavItem)
        .map((p) => ({ id: `p-${p.key}`, type: 'page' as const, label: p.label, href: p.href, icon: p.icon })),
      // Team is a section of Settings, not a sidebar item; still findable here.
      {
        id: 'p-team',
        type: 'page' as const,
        label: 'Team',
        sub: 'In Settings',
        href: '/shift/employers/portal/settings#team',
        icon: ShieldCheck,
      },
    ]

    const actions: ResultItem[] = [
      { id: 'a-challenge', type: 'action', label: 'Create a challenge', icon: Trophy, href: '/shift/employers/portal/challenges?new=1' },
      { id: 'a-invite', type: 'action', label: 'Invite employees', icon: UserPlus, href: '/shift/employers/portal/employees?invite=1' },
      ...(isAdmin || isGsiAdmin
        ? [{ id: 'a-topup', type: 'action' as const, label: 'Top up rewards balance', icon: Wallet, href: '/shift/employers/portal/billing' }]
        : []),
      { id: 'a-print', type: 'action', label: 'Print impact report', icon: Printer, href: '/shift/employers/portal/impact' },
      { id: 'a-signout', type: 'action', label: 'Sign out', icon: LogOut, run: () => signOut() },
    ]

    const matches = (label: string) => !q || label.toLowerCase().includes(q)

    const employees: ResultItem[] =
      q.length >= 2
        ? members
            .filter((m) => m.display_name?.toLowerCase().includes(q))
            .slice(0, 8)
            .map((m) => ({
              id: `e-${m.user_id}`,
              type: 'employee' as const,
              label: m.display_name || 'Unnamed',
              sub: `Joined ${new Date(m.joined_at).toLocaleDateString()}`,
              href: `/shift/employers/portal/employees?member=${encodeURIComponent(m.user_id)}`,
            }))
        : []

    return [...pages.filter((p) => matches(p.label)), ...actions.filter((a) => matches(a.label)), ...employees]
  }, [query, members, role, isAdmin, isGsiAdmin, setupIncomplete, signOut])

  // Reset the highlight when the list changes (adjusted during render, not in an effect).
  const [seenQuery, setSeenQuery] = useState(query)
  if (seenQuery !== query) {
    setSeenQuery(query)
    setActiveIdx(0)
  }

  const choose = useCallback(
    (r: ResultItem) => {
      onClose()
      if (r.run) {
        void r.run()
        return
      }
      if (r.href) router.push(r.href)
    },
    [onClose, router],
  )

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => (i < results.length - 1 ? i + 1 : 0))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => (i > 0 ? i - 1 : results.length - 1))
      }
      if (e.key === 'Enter' && results[activeIdx]) {
        e.preventDefault()
        choose(results[activeIdx])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [results, activeIdx, choose, onClose])

  const groups: { key: ResultItem['type']; heading: string }[] = [
    { key: 'page', heading: 'Pages' },
    { key: 'action', heading: 'Actions' },
    { key: 'employee', heading: 'Employees' },
  ]

  let flatIdx = -1

  return (
    <>
      <div className="fixed inset-0 z-50 bg-ink/30" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[min(20vh,160px)]" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="mx-4 w-full max-w-[520px] overflow-hidden rounded-[14px] bg-surface shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Search size={18} strokeWidth={1.75} className="shrink-0 text-ink-icon" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, actions, employees…"
              aria-label="Search pages, actions and employees"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-tertiary"
            />
            <kbd className="hidden rounded-[5px] border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-tertiary sm:block">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto py-2">
            {results.length === 0 && (
              <div className="px-4 py-8 text-center text-[13.5px] text-ink-muted">
                Nothing matches &ldquo;{query}&rdquo;
              </div>
            )}

            {groups.map((g) => {
              const rows = results.filter((r) => r.type === g.key)
              if (rows.length === 0) return null
              return (
                <div key={g.key}>
                  <div className="px-4 pb-1 pt-2 text-[12px] font-semibold text-ink-tertiary">{g.heading}</div>
                  {rows.map((r) => {
                    flatIdx++
                    const idx = flatIdx
                    const Icon = r.icon
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          idx === activeIdx ? 'bg-accent-soft' : 'hover:bg-surface-2'
                        }`}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => choose(r)}
                      >
                        {r.type === 'employee' ? (
                          <Avatar name={r.label} size={26} />
                        ) : Icon ? (
                          <Icon size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
                        ) : null}
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium text-ink">{r.label}</div>
                          {r.sub && <div className="text-[12px] text-ink-tertiary">{r.sub}</div>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
