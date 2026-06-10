'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  LayoutDashboard,
  ListChecks,
  Route,
  Users,
  Share2,
  Trophy,
  BarChart3,
  Wallet,
  Settings,
} from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import Avatar from '@/components/employer/Avatar'

type ResultItem = {
  id: string
  type: 'page' | 'employee'
  label: string
  sub?: string
  href: string
  icon?: typeof LayoutDashboard
}

const PAGES: ResultItem[] = [
  { id: 'p-dashboard', type: 'page', label: 'Dashboard', href: '/shift/employers/portal/dashboard', icon: LayoutDashboard },
  { id: 'p-setup', type: 'page', label: 'Setup', href: '/shift/employers/portal/setup', icon: ListChecks },
  { id: 'p-advisor', type: 'page', label: 'Commute Advisor', href: '/shift/employers/portal/advisor', icon: Route },
  { id: 'p-employees', type: 'page', label: 'Employees', href: '/shift/employers/portal/employees', icon: Users },
  { id: 'p-share-kit', type: 'page', label: 'Share Kit', href: '/shift/employers/portal/share-kit', icon: Share2 },
  { id: 'p-challenges', type: 'page', label: 'Challenges', href: '/shift/employers/portal/challenges', icon: Trophy },
  { id: 'p-impact', type: 'page', label: 'Impact', href: '/shift/employers/portal/impact', icon: BarChart3 },
  { id: 'p-billing', type: 'page', label: 'Rewards & billing', href: '/shift/employers/portal/billing', icon: Wallet },
  { id: 'p-settings', type: 'page', label: 'Settings', href: '/shift/employers/portal/settings', icon: Settings },
]

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { members } = usePortal()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    const q = query.toLowerCase().trim()
    const pages = q
      ? PAGES.filter((p) => p.label.toLowerCase().includes(q))
      : PAGES

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
              href: '/shift/employers/portal/employees',
            }))
        : []

    return [...pages, ...employees]
  }, [query, members])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

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
        router.push(results[activeIdx].href)
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [results, activeIdx, router, onClose])

  const pageResults = results.filter((r) => r.type === 'page')
  const employeeResults = results.filter((r) => r.type === 'employee')

  let flatIdx = -1

  return (
    <>
      <div className="fixed inset-0 z-50 bg-ink/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[min(20vh,160px)]" onClick={onClose}>
        <div
          className="w-full max-w-[520px] overflow-hidden rounded-[14px] bg-surface shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Search size={18} strokeWidth={1.75} className="shrink-0 text-ink-faint" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, employees..."
              className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
            />
            <kbd className="rounded-[5px] border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto py-2">
            {results.length === 0 && (
              <div className="px-4 py-8 text-center text-[13.5px] text-ink-faint">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {pageResults.length > 0 && (
              <div>
                <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  Pages
                </div>
                {pageResults.map((r) => {
                  flatIdx++
                  const idx = flatIdx
                  const Icon = r.icon!
                  return (
                    <button
                      key={r.id}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        idx === activeIdx ? 'bg-accent-soft' : 'hover:bg-surface-2'
                      }`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => {
                        router.push(r.href)
                        onClose()
                      }}
                    >
                      <Icon size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
                      <span className="text-[14px] font-medium text-ink">{r.label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {employeeResults.length > 0 && (
              <div>
                <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  Employees
                </div>
                {employeeResults.map((r) => {
                  flatIdx++
                  const idx = flatIdx
                  return (
                    <button
                      key={r.id}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        idx === activeIdx ? 'bg-accent-soft' : 'hover:bg-surface-2'
                      }`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => {
                        router.push(r.href)
                        onClose()
                      }}
                    >
                      <Avatar name={r.label} size={26} />
                      <div>
                        <div className="text-[14px] font-medium text-ink">{r.label}</div>
                        {r.sub && <div className="text-[12px] text-ink-faint">{r.sub}</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
