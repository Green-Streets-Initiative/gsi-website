'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListChecks,
  Route,
  Users,
  Trophy,
  BarChart3,
  Wallet,
  Settings,
  ChevronRight,
} from 'lucide-react'
import { usePortal } from '../_lib/portal-context'

type NavItem = {
  key: string
  label: string
  icon: typeof LayoutDashboard
  href: string
  showDot?: boolean
  showCount?: boolean
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/shift/employers/portal/dashboard' },
      { key: 'setup', label: 'Setup', icon: ListChecks, href: '/shift/employers/portal/setup', showDot: true },
    ],
  },
  {
    label: 'Configure',
    items: [
      { key: 'advisor', label: 'Commute Advisor', icon: Route, href: '/shift/employers/portal/advisor' },
    ],
  },
  {
    label: 'Engage',
    items: [
      { key: 'employees', label: 'Employees', icon: Users, href: '/shift/employers/portal/employees', showCount: true },
      { key: 'challenges', label: 'Challenges', icon: Trophy, href: '/shift/employers/portal/challenges' },
      { key: 'impact', label: 'Impact', icon: BarChart3, href: '/shift/employers/portal/impact' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'billing', label: 'Rewards & billing', icon: Wallet, href: '/shift/employers/portal/billing' },
      { key: 'settings', label: 'Settings', icon: Settings, href: '/shift/employers/portal/settings' },
    ],
  },
]

function ChevronMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 36 28" width={size} height={size * (28 / 36)}>
      <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
      <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
    </svg>
  )
}

function isSetupComplete(group: { logo_url: string | null; tier: string } | null, memberCount: number, hasChallenge: boolean, hasBenefits: boolean): boolean {
  if (!group) return false
  const steps = [
    !!group.logo_url,
    memberCount > 0,
    hasChallenge,
    hasBenefits,
    true, // profile is always "done" if they have a group
  ]
  return steps.every(Boolean)
}

export default function Sidebar() {
  const pathname = usePathname()
  const { group, memberCount, challenge, benefitsForm } = usePortal()

  const hasBenefits = !!(benefitsForm?.destination_address)
  const setupComplete = isSetupComplete(group, memberCount, !!challenge, hasBenefits)

  return (
    <aside className="hidden min-[980px]:flex flex-col h-screen sticky top-0 w-64 overflow-hidden"
      style={{ backgroundColor: '#1F4D3A' }}>

      {/* Brand lockup */}
      <div className="px-[22px] pt-[22px] pb-[18px]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[9px]"
            style={{ backgroundColor: '#191A2E' }}>
            <ChevronMark size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[16px] font-extrabold text-white"
                style={{ fontFamily: "'Bricolage Grotesque', var(--font-display), sans-serif" }}>
                Shift
              </span>
              <span className="text-[14px] text-white/60"
                style={{ fontFamily: "'Source Sans 3', var(--font-sans), sans-serif" }}>
                for Employers
              </span>
            </div>
            <div className="text-[12px]"
              style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}>
              <span className="font-bold" style={{ color: '#8FD3AE' }}>Green Streets</span>{' '}
              <span className="text-white">Initiative</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-1.5 pb-3 space-y-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
        {NAV.map((section) => (
          <div key={section.label}>
            <div className="px-2.5 pb-1.5 pt-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/[0.38]">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`flex items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-[14px] no-underline transition-colors duration-[120ms] ${
                      active
                        ? 'bg-white/[0.14] font-semibold text-white'
                        : 'font-medium text-white/[0.74] hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.showCount && memberCount > 0 && (
                      <span className="rounded-full bg-white/[0.14] px-[7px] py-[1px] text-[11px] font-semibold text-white/80">
                        {memberCount}
                      </span>
                    )}
                    {item.showDot && !setupComplete && (
                      <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: '#C97A2E' }} />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Workspace switcher (footer) */}
      <div className="border-t border-white/[0.12] px-3 py-3">
        <Link
          href="/shift/employers/portal/settings"
          className="flex items-center gap-2.5 rounded-[9px] px-2 py-2 no-underline transition-colors hover:bg-white/[0.08]"
        >
          {/* Logo on white plate */}
          {group?.logo_url ? (
            <div className="flex h-[28px] items-center rounded-[6px] bg-white px-1.5"
              style={{ boxShadow: '0 0 0 1px rgba(25,26,46,0.06)' }}>
              <img src={group.logo_url} alt="" className="h-[22px] w-auto object-contain" />
            </div>
          ) : (
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] bg-white text-[11px] font-extrabold"
              style={{ color: '#191A2E', fontFamily: "'Bricolage Grotesque', var(--font-display), sans-serif" }}>
              {(group?.name ?? '').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-white/90">
              {group?.name ?? '...'}
            </div>
            <div className="truncate text-[11.5px] text-white/[0.45]">
              {group?.admin_name ?? group?.admin_email ?? ''} · Admin
            </div>
          </div>
          <ChevronRight size={14} className="shrink-0 text-white/30" />
        </Link>
      </div>
    </aside>
  )
}
