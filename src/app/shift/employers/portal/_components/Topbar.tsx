'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Search, Bell, HelpCircle } from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import CommandPalette from './CommandPalette'
import NotificationsDropdown, { hasUnreadNotifications, prefsForCurrentAdmin } from './NotificationsDropdown'
import HelpDrawer, { onPortalHelpRequest } from './HelpDrawer'
import AccountMenu from './AccountMenu'

const ROUTE_META: { prefix: string; label: string }[] = [
  { prefix: '/shift/employers/portal/dashboard', label: 'Home' },
  { prefix: '/shift/employers/portal/setup', label: 'Setup' },
  { prefix: '/shift/employers/portal/share-kit', label: 'Share kit' },
  { prefix: '/shift/employers/portal/employees', label: 'Employees' },
  { prefix: '/shift/employers/portal/challenges', label: 'Challenges' },
  { prefix: '/shift/employers/portal/impact', label: 'Impact' },
  { prefix: '/shift/employers/portal/advisor', label: 'Commute Advisor' },
  { prefix: '/shift/employers/portal/billing', label: 'Billing & rewards' },
  { prefix: '/shift/employers/portal/settings', label: 'Settings' },
]

export function pageTitleFor(pathname: string): string {
  return ROUTE_META.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + '/'))?.label ?? 'Home'
}

type Panel = 'search' | 'notifications' | 'help' | null

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname()
  const title = pageTitleFor(pathname)
  const { group, members, challenges, admins, sessionEmail } = usePortal()

  const [activePanel, setActivePanel] = useState<Panel>(null)
  const [helpTopic, setHelpTopic] = useState<string | null>(null)

  // A page can open Help on one topic (e.g. Billing's "How taxes on rewards work").
  useEffect(
    () =>
      onPortalHelpRequest((topic) => {
        setHelpTopic(topic || null)
        setActivePanel('help')
      }),
    [],
  )

  // Close panels on route change (state adjusted during render, not in an effect).
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setActivePanel(null)
  }

  const showUnread = group
    ? hasUnreadNotifications(
        group.id,
        members,
        challenges,
        prefsForCurrentAdmin(admins, sessionEmail),
      )
    : false

  const closePanel = useCallback(() => {
    setActivePanel(null)
    setHelpTopic(null)
  }, [])

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

  return (
    <>
      <header
        className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line px-4 sm:px-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.82)',
          backdropFilter: 'saturate(1.4) blur(8px)',
          WebkitBackdropFilter: 'saturate(1.4) blur(8px)',
        }}
      >
        {/* Left: menu (small screens) + crumb */}
        <div className="flex min-w-0 items-center gap-2 text-[14px]">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Menu"
            className="-ml-1 grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2 min-[980px]:hidden"
          >
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <nav aria-label="Where you are" className="flex min-w-0 items-center gap-2">
            {group ? (
              <Link
                href="/shift/employers/portal/dashboard"
                className="hidden max-w-[220px] truncate text-ink-muted no-underline hover:text-ink sm:block"
              >
                {group.name}
              </Link>
            ) : (
              <span className="hidden h-4 w-24 animate-pulse rounded bg-ink/[0.08] sm:block" />
            )}
            <span className="hidden text-ink-tertiary sm:block" aria-hidden>
              ·
            </span>
            <h1 className="truncate text-[14px] font-semibold text-ink">{title}</h1>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Search: a pill from sm up, an icon button below */}
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'search' ? null : 'search'))}
            className="relative hidden h-[38px] w-[220px] items-center gap-2 rounded-full border-0 bg-surface-2 pl-9 pr-12 text-left text-[13px] text-ink-tertiary outline-none transition-shadow hover:ring-1 hover:ring-line sm:flex lg:w-[280px]"
          >
            <Search
              size={16}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary"
            />
            Search…
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-[5px] border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-tertiary">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setActivePanel((p) => (p === 'search' ? null : 'search'))}
            aria-label="Search"
            className="grid h-[38px] w-[38px] place-items-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2 sm:hidden"
          >
            <Search size={18} strokeWidth={1.75} />
          </button>

          {/* Notification bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === 'notifications' ? null : 'notifications'))}
              aria-label={showUnread ? 'Notifications, new' : 'Notifications'}
              aria-expanded={activePanel === 'notifications'}
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
            aria-label="Help"
            aria-expanded={activePanel === 'help'}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2"
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </button>

          <AccountMenu />
        </div>
      </header>

      {/* Command Palette overlay */}
      {activePanel === 'search' && <CommandPalette onClose={closePanel} />}

      {/* Help Drawer overlay */}
      {activePanel === 'help' && <HelpDrawer onClose={closePanel} topic={helpTopic} />}
    </>
  )
}
