'use client'

import { usePathname } from 'next/navigation'
import { LayoutGrid, Search, Bell, HelpCircle } from 'lucide-react'

const ROUTE_META: Record<string, { label: string }> = {
  '/shift/employers/portal/dashboard': { label: 'Dashboard' },
  '/shift/employers/portal/setup': { label: 'Setup' },
  '/shift/employers/portal/advisor': { label: 'Commute Advisor' },
  '/shift/employers/portal/employees': { label: 'Employees' },
  '/shift/employers/portal/challenges': { label: 'Challenges' },
  '/shift/employers/portal/impact': { label: 'Impact' },
  '/shift/employers/portal/billing': { label: 'Rewards & billing' },
  '/shift/employers/portal/settings': { label: 'Settings' },
}

export default function Topbar() {
  const pathname = usePathname()
  const meta = ROUTE_META[pathname] ?? { label: 'Dashboard' }

  return (
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
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="text"
            placeholder="Search..."
            className="h-[38px] w-[280px] rounded-full border-0 bg-surface-2 pl-9 pr-12 text-[13px] text-ink placeholder:text-ink-faint outline-none transition-shadow focus:ring-2 focus:ring-accent focus:ring-offset-1"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-[5px] border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">
            ⌘K
          </kbd>
        </div>

        {/* Notification bell */}
        <button
          type="button"
          className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2"
        >
          <Bell size={18} strokeWidth={1.75} />
          <span className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full bg-ep-danger ring-2 ring-white" />
        </button>

        {/* Help */}
        <button
          type="button"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2"
        >
          <HelpCircle size={18} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  )
}
