'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Search, Bell, HelpCircle } from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import CommandPalette from './CommandPalette'
import NotificationsDropdown, { hasUnreadNotifications } from './NotificationsDropdown'
import HelpDrawer from './HelpDrawer'

const ROUTE_META: Record<string, { label: string }> = {
  '/shift/employers/portal/dashboard': { label: 'Dashboard' },
  '/shift/employers/portal/setup': { label: 'Setup' },
  '/shift/employers/portal/advisor': { label: 'Commute Advisor' },
  '/shift/employers/portal/employees': { label: 'Employees' },
  '/shift/employers/portal/share-kit': { label: 'Share Kit' },
  '/shift/employers/portal/challenges': { label: 'Challenges' },
  '/shift/employers/portal/impact': { label: 'Impact' },
  '/shift/employers/portal/billing': { label: 'Rewards & billing' },
  '/shift/employers/portal/settings': { label: 'Settings' },
}

type Panel = 'search' | 'notifications' | 'help' | null

export default function Topbar() {
  const pathname = usePathname()
  const meta = ROUTE_META[pathname] ?? { label: 'Dashboard' }
  const { group, members, challenges } = usePortal()

  const [activePanel, setActivePanel] = useState<Panel>(null)

  const showUnread = group
    ? hasUnreadNotifications(group.id, members, challenges)
    : false

  const closePanel = useCallback(() => setActivePanel(null), [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setActivePanel((p) => (p === 'search' ? null : 'search'))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Close panels on route change
  useEffect(() => {
    setActivePanel(null)
  }, [pathname])

  return (
    <>
      <header
        className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line px-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.82)',
          backdropFilter: 'saturate(1.4) blur(8px)',
          WebkitBackdropFilter: 'saturate(1.4) blur(8px)',
        }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[14px]">
          <LayoutGrid size={16} strokeWidth={1.75} className="text-ink-faint" />
          <span className="text-ink-faint">/</span>
          <span className="font-semibold text-ink">{meta.label}</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search trigger */}
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'search' ? null : 'search'))}
            className="relative hidden h-[38px] w-[280px] items-center gap-2 rounded-full border-0 bg-surface-2 pl-9 pr-12 text-left text-[13px] text-ink-faint outline-none transition-shadow hover:ring-1 hover:ring-line sm:flex"
          >
            <Search
              size={16}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            Search...
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-[5px] border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">
              ⌘K
            </kbd>
          </button>

          {/* Notification bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === 'notifications' ? null : 'notifications'))}
              className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2"
            >
              <Bell size={18} strokeWidth={1.75} />
              {showUnread && (
                <span className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full bg-ep-danger ring-2 ring-white" />
              )}
            </button>
            {activePanel === 'notifications' && (
              <NotificationsDropdown onClose={closePanel} />
            )}
          </div>

          {/* Help */}
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'help' ? null : 'help'))}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2"
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* Command Palette overlay */}
      {activePanel === 'search' && <CommandPalette onClose={closePanel} />}

      {/* Help Drawer overlay */}
      {activePanel === 'help' && <HelpDrawer onClose={closePanel} />}
    </>
  )
}
