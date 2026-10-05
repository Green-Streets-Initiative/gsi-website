'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  House,
  ListChecks,
  UserPlus,
  Users,
  Trophy,
  ChartBar,
  Route,
  Wallet,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { usePortal, type PortalRole } from '../_lib/portal-context'
import { computeSetupSteps, nextSetupStep } from '../_lib/setup-steps'
import MobileNav from './MobileNav'

export type PortalNavItem = {
  key: string
  label: string
  icon: LucideIcon
  href: string
  /** Only while setup still has an unfinished step. */
  setupOnly?: boolean
  /** Only for admins (role known and 'admin'). */
  adminOnly?: boolean
  /** Admins or GSI staff. */
  adminOrGsi?: boolean
  showDot?: boolean
  showCount?: boolean
}

export type PortalNavEntry = PortalNavItem | { divider: true }

/**
 * The portal's one navigation list, in the order it is shown. The Sidebar
 * draws it and the CommandPalette searches it (Keith 2026-09-30: no group
 * headings, plain names, Setup only while there is setup left to do; Team
 * is a section of Settings, not its own page).
 */
export const PORTAL_NAV: PortalNavEntry[] = [
  { key: 'dashboard', label: 'Home', icon: House, href: '/shift/employers/portal/dashboard' },
  { key: 'setup', label: 'Setup', icon: ListChecks, href: '/shift/employers/portal/setup', setupOnly: true, showDot: true },
  { divider: true },
  { key: 'employees', label: 'Employees', icon: Users, href: '/shift/employers/portal/employees', showCount: true },
  // The code, link, QR, messages and flyers. Inviting by email lives on
  // Employees (Keith 2026-10-05: "Invite employees" here was this page).
  { key: 'share-kit', label: 'Share kit', icon: UserPlus, href: '/shift/employers/portal/share-kit' },
  { key: 'challenges', label: 'Challenges', icon: Trophy, href: '/shift/employers/portal/challenges' },
  { key: 'impact', label: 'Impact', icon: ChartBar, href: '/shift/employers/portal/impact' },
  { divider: true },
  { key: 'advisor', label: 'Commute Advisor', icon: Route, href: '/shift/employers/portal/advisor' },
  { divider: true },
  { key: 'billing', label: 'Billing & rewards', icon: Wallet, href: '/shift/employers/portal/billing', adminOrGsi: true },
  { key: 'settings', label: 'Settings', icon: Settings, href: '/shift/employers/portal/settings' },
]

export function isNavItem(entry: PortalNavEntry): entry is PortalNavItem {
  return !('divider' in entry)
}

/** The nav items this person should see right now (dividers kept in place). */
export function visibleNav(args: {
  role: PortalRole | null
  isGsiAdmin: boolean
  setupIncomplete: boolean
}): PortalNavEntry[] {
  const { role, isGsiAdmin, setupIncomplete } = args
  const isAdmin = role === 'admin'
  const entries = PORTAL_NAV.filter((e) => {
    if (!isNavItem(e)) return true
    if (e.setupOnly && !setupIncomplete) return false
    if (e.adminOnly && !isAdmin) return false
    if (e.adminOrGsi && !isAdmin && !isGsiAdmin) return false
    return true
  })
  // Drop dividers that ended up leading, trailing or doubled.
  return entries.filter((e, i) => {
    if (isNavItem(e)) return true
    const prev = entries[i - 1]
    const next = entries[i + 1]
    return !!prev && !!next && isNavItem(prev) && isNavItem(next)
  })
}

function ChevronMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 1 35 26" width={size} height={size * (26 / 35)} aria-hidden>
      <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
      <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
    </svg>
  )
}

function SidebarContent() {
  const pathname = usePathname()
  const { group, role, isGsiAdmin, memberCount, challenges, benefitsForm, loading } = usePortal()

  const setupIncomplete =
    !loading && !!group && !!nextSetupStep(computeSetupSteps({ group, benefitsForm, memberCount, challenges }))
  const entries = visibleNav({ role, isGsiAdmin, setupIncomplete })

  return (
    <>
      {/* Workplace: the company this portal belongs to */}
      <div className="px-4 pb-3 pt-5 pr-12 min-[980px]:pr-4">
        <div className="flex items-center gap-3">
          {group?.logo_url ? (
            <div
              className="flex h-10 shrink-0 items-center rounded-[9px] bg-white px-1.5"
              style={{ boxShadow: '0 0 0 1px rgba(25,26,46,0.06)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={group.logo_url} alt="" className="h-[30px] w-auto max-w-[120px] object-contain" />
            </div>
          ) : group ? (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-white text-[14px] font-extrabold"
              style={{ color: '#191A2E', fontFamily: "'Bricolage Grotesque', var(--font-display), sans-serif" }}
            >
              {group.name.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-[9px] bg-white/[0.14]" />
          )}
          <div className="min-w-0">
            {group ? (
              <div className="truncate text-[15px] font-bold leading-tight text-white">{group.name}</div>
            ) : (
              <div className="h-4 w-28 animate-pulse rounded bg-white/[0.14]" />
            )}
            <div className="mt-0.5 truncate text-[12px] text-white/75">Shift for Employers</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav
        aria-label="Portal"
        className="flex-1 overflow-y-auto px-2 pb-3 pt-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
      >
        {entries.map((entry, i) => {
          if (!isNavItem(entry)) {
            return <div key={`divider-${i}`} className="my-2 border-t border-white/[0.12]" aria-hidden />
          }
          const item = entry
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`mb-0.5 flex items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-[14px] no-underline transition-colors duration-[120ms] ${
                active
                  ? 'bg-white/[0.14] font-semibold text-white'
                  : 'font-medium text-white/80 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.showCount && memberCount > 0 && (
                <span className="rounded-full bg-white/[0.14] px-[7px] py-[1px] text-[11px] font-semibold text-white/80">
                  {memberCount}
                </span>
              )}
              {item.showDot && (
                <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: '#C97A2E' }} aria-hidden />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Brand lockup */}
      <div className="border-t border-white/[0.12] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]" style={{ backgroundColor: '#191A2E' }}>
            <ChevronMark size={16} />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[13px] font-extrabold text-white" style={{ fontFamily: "'Bricolage Grotesque', var(--font-display), sans-serif" }}>
              Shift
            </div>
            <div className="text-[11.5px] text-white/75" style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}>
              by Green Streets Initiative
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <aside
        className="sticky top-0 hidden h-screen w-64 flex-col overflow-hidden min-[980px]:flex"
        style={{ backgroundColor: '#1F4D3A' }}
      >
        <SidebarContent />
      </aside>
      <MobileNav open={open} onClose={onClose}>
        <SidebarContent />
      </MobileNav>
    </>
  )
}
