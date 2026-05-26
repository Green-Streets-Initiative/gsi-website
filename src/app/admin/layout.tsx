'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MapPin, LinkSimple } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

const NAV_ITEMS: { href: string; label: string; icon: Icon }[] = [
  { href: '/admin/wayfinding', label: 'Wayfinding Events', icon: MapPin },
  { href: '/admin/demo-generator', label: 'Demo Generator', icon: LinkSimple },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-[#191A2E]">
      <aside className="w-64 flex-shrink-0 border-r border-white/[0.08] flex flex-col">
        <div className="px-6 py-5 border-b border-white/[0.08]">
          <Link href="/admin" className="text-white font-semibold text-lg font-[family-name:var(--font-bricolage)]">
            GSI Admin
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-white/[0.1] text-white font-medium'
                    : 'text-white/75 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <item.icon size={18} weight="regular" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-6 py-4 border-t border-white/[0.08]">
          <Link href="/" className="text-sm text-white/60 hover:text-white/80 transition-colors">
            Back to site
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[#0f1020]">
        {children}
      </main>
    </div>
  )
}
