'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, LogOut, Settings, ShieldCheck } from 'lucide-react'
import { usePortal } from '../_lib/portal-context'

function initialsFor(name: string | null, email: string | null): string {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0]
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2)
  return letters.toUpperCase() || '?'
}

/**
 * Who is signed in, what they can do here, and the way out. Sign out used
 * to live only in Settings' "Danger zone" (Keith 2026-09-30).
 */
export default function AccountMenu() {
  const pathname = usePathname()
  const { sessionEmail, admins, role, isAdmin, isGsiAdmin, isOwner, signOut } = usePortal()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on route change (state adjusted during render, not in an effect).
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const me = admins.find((a) => a.email.toLowerCase() === (sessionEmail ?? ''))
  const name = me?.name ?? null
  const initials = initialsFor(name, sessionEmail)
  const roleWords =
    role === 'admin'
      ? isOwner
        ? 'Account owner · Can change settings'
        : 'Can change settings'
      : role === 'manager'
        ? 'Manager · Can run challenges and invites'
        : role === 'viewer'
          ? 'Can view'
          : null

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-[38px] items-center gap-1.5 rounded-full pl-1 pr-2 text-ink-muted transition-colors hover:bg-surface-2"
      >
        <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent-ink">
          {initials}
        </span>
        <ChevronDown size={14} strokeWidth={2} className="text-ink-tertiary" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-[260px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-line bg-surface shadow-lg"
        >
          <div className="border-b border-line px-4 py-3">
            {name && <div className="truncate text-[14px] font-semibold text-ink">{name}</div>}
            <div className={`truncate text-[13px] ${name ? 'text-ink-muted' : 'font-semibold text-ink'}`}>
              {sessionEmail ?? ''}
            </div>
            {(roleWords || isGsiAdmin) && (
              <div className="mt-1 text-[12.5px] text-ink-muted">
                {isGsiAdmin ? 'Green Streets staff' : roleWords}
              </div>
            )}
          </div>
          <div className="py-1.5">
            {isAdmin && (
              <Link
                href="/shift/employers/portal/settings#team"
                role="menuitem"
                className="flex items-center gap-2.5 px-4 py-2 text-[13.5px] text-ink no-underline hover:bg-surface-2"
              >
                <ShieldCheck size={16} strokeWidth={1.75} className="text-ink-muted" />
                Team
              </Link>
            )}
            <Link
              href="/shift/employers/portal/settings"
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2 text-[13.5px] text-ink no-underline hover:bg-surface-2"
            >
              <Settings size={16} strokeWidth={1.75} className="text-ink-muted" />
              Settings
            </Link>
          </div>
          <div className="border-t border-line py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13.5px] text-ink hover:bg-surface-2 disabled:opacity-50"
            >
              <LogOut size={16} strokeWidth={1.75} className="text-ink-muted" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
