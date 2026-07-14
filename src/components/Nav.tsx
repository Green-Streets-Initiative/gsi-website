'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * Nav IA (Keith, 07-14): Towns is civic information relevant to anyone in
 * these communities — it stands top-level. App-specific surfaces group under
 * the "Shift app" dropdown so the top bar doesn't grow. Pattern going
 * forward: civic/community content can earn top-level slots; app product
 * pages live in the dropdown.
 */

const linkCls =
  'whitespace-nowrap text-[0.8125rem] font-medium text-white transition-opacity hover:opacity-80'

const SHIFT_APP_ITEMS: Array<[href: string, label: string]> = [
  ['/shift?utm_content=nav_shift_app', 'About Shift'],
  ['/shift/roams?utm_content=nav_shift_app', 'Roams'],
  ['/commute-advisor?utm_content=nav_shift_app', 'Commute Advisor'],
  ['/shift/employers/login', 'Employer login'],
]

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [appOpen, setAppOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!appOpen) return
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setAppOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAppOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [appOpen])

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.08] backdrop-blur-xl" style={{ background: 'rgba(25,26,46,0.96)' }}>
      <div className="mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between px-6 lg:px-8">

        {/* Brand */}
        <Link href="/" className="flex items-center no-underline">
          <span className="text-[1.0625rem] tracking-[0.3px]" style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}>
            <span className="font-bold text-[#52B788]">Green Streets</span>{' '}
            <span className="font-normal text-white">Initiative</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-4 xl:gap-5 lg:flex">
          <Link href="/events/shift-your-summer" className="whitespace-nowrap text-[0.8125rem] font-medium text-lime transition-opacity hover:opacity-80">
            Shift Your Summer
          </Link>
          <Link href="/programs" className={linkCls}>
            Programs
          </Link>
          <Link href="/shift/towns?utm_content=nav_towns" className={linkCls}>
            Towns
          </Link>
          <Link href="/guides" className={linkCls}>
            Guides
          </Link>
          <Link href="/events" className={linkCls}>
            Events
          </Link>
          <Link href="/get-involved" className={linkCls}>
            Get involved
          </Link>
          <Link href="/contact" className={linkCls}>
            Contact
          </Link>

          {/* Shift app dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              className={`${linkCls} flex items-center gap-1`}
              aria-expanded={appOpen}
              aria-haspopup="menu"
              onClick={() => setAppOpen((o) => !o)}
            >
              Shift app
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={`transition-transform ${appOpen ? 'rotate-180' : ''}`}>
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {appOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 min-w-[190px] rounded-xl border border-white/[0.1] py-2 shadow-xl backdrop-blur-xl"
                style={{ background: 'rgba(25,26,46,0.98)' }}
              >
                {SHIFT_APP_ITEMS.map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    className="block px-4 py-2 text-[0.8125rem] font-medium text-white transition-colors hover:bg-white/[0.06]"
                    onClick={() => setAppOpen(false)}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/donate"
            className="whitespace-nowrap rounded-full border border-white/[0.2] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-white/[0.05]"
          >
            Donate
          </Link>
          <Link
            href="/shift"
            className="whitespace-nowrap rounded-full bg-lime px-3.5 py-1.5 text-[0.8125rem] font-semibold text-navy transition-opacity hover:opacity-85"
          >
            Download Shift
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="flex flex-col gap-1.5 lg:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 w-6 bg-white transition-transform ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block h-0.5 w-6 bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-6 bg-white transition-transform ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-white/[0.07] px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/events/shift-your-summer" className="text-sm font-medium text-lime" onClick={() => setMenuOpen(false)}>Shift Your Summer</Link>
            <Link href="/programs" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Programs</Link>
            <Link href="/shift/towns?utm_content=nav_towns" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Towns</Link>
            <Link href="/guides" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Guides</Link>
            <Link href="/events" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Events</Link>
            <Link href="/about" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>About</Link>
            <Link href="/get-involved" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Get involved</Link>
            <Link href="/contact" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Contact</Link>

            <div className="mt-1 border-t border-white/[0.07] pt-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/70">Shift app</p>
              <div className="flex flex-col gap-3 pl-1">
                {SHIFT_APP_ITEMS.map(([href, label]) => (
                  <Link key={href} href={href} className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/donate" className="mt-2 inline-block rounded-full border border-white/[0.2] px-4 py-2 text-center text-sm font-semibold text-white" onClick={() => setMenuOpen(false)}>Donate</Link>
            <Link href="/shift" className="inline-block rounded-full bg-lime px-4 py-2 text-center text-sm font-semibold text-navy" onClick={() => setMenuOpen(false)}>Download Shift</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
