'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * Nav IA (Keith, 07-14): Towns is civic information relevant to anyone in
 * these communities — it stands top-level. App-specific surfaces group under
 * the "Shift app" dropdown so the top bar doesn't grow. Pattern going
 * forward: civic/community content can earn top-level slots; app product
 * pages live in the dropdown.
 *
 * The first item is "Challenges", a stable section rather than the name of
 * whichever campaign is running. It used to hardcode "Shift Your Summer",
 * which kept pointing at that campaign for a month after it ended. A section
 * name cannot go stale; /challenges works out what is actually on.
 *
 * `variant="light"` is the cream-page treatment (home refresh): the wordmark
 * follows the brand rule for light backgrounds (forest "Green Streets" +
 * navy "Initiative"), links go navy, and the Download button goes solid
 * navy because lime is Shift-only outside the product block. Every other
 * page keeps the default dark bar.
 */

type Variant = 'dark' | 'light'

const SHIFT_APP_ITEMS: Array<[href: string, label: string]> = [
  ['/shift', 'About Shift'],
  ['/shift/schools', 'Shift for Schools'],
  ['/shift/roams', 'Roams'],
  ['/commute-advisor', 'Commute Advisor'],
  ['/shift/employers/login', 'Employer login'],
]

const THEME: Record<Variant, {
  bar: string
  barBg: string
  border: string
  brandA: string
  brandB: string
  link: string
  panelBg: string
  panelHover: string
  donate: string
  download: string
  burger: string
  groupLabel: string
}> = {
  dark: {
    bar: 'border-b border-white/[0.08]',
    barBg: 'rgba(25,26,46,0.96)',
    border: 'border-white/[0.07]',
    brandA: 'text-[#52B788]',
    brandB: 'text-white',
    link: 'text-white',
    panelBg: 'rgba(25,26,46,0.98)',
    panelHover: 'hover:bg-white/[0.06]',
    donate: 'border-white/[0.2] text-white hover:bg-white/[0.05]',
    download: 'bg-lime text-navy hover:opacity-85',
    burger: 'bg-white',
    groupLabel: 'text-white/70',
  },
  light: {
    bar: 'border-b border-navy/10',
    barBg: 'rgba(244,248,238,0.92)',
    border: 'border-navy/10',
    brandA: 'text-forest',
    brandB: 'text-navy',
    link: 'text-navy',
    panelBg: 'rgba(244,248,238,0.98)',
    panelHover: 'hover:bg-navy/[0.05]',
    donate: 'border-navy/25 text-navy hover:bg-navy/[0.05]',
    download: 'bg-navy text-white hover:opacity-90',
    burger: 'bg-navy',
    groupLabel: 'text-forest',
  },
}

export default function Nav({ variant = 'dark' }: { variant?: Variant }) {
  const t = THEME[variant]
  const linkCls = `whitespace-nowrap text-[0.8125rem] font-medium ${t.link} transition-opacity hover:opacity-80`
  const mobileLink = `text-sm font-medium ${t.link}`
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
    <nav className={`fixed left-0 right-0 top-0 z-50 backdrop-blur-xl ${t.bar}`} style={{ background: t.barBg }}>
      <div className="mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between px-6 lg:px-8">

        {/* Brand */}
        <Link href="/" className="flex items-center no-underline">
          <span className="text-[1.0625rem] tracking-[0.3px]" style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}>
            <span className={`font-bold ${t.brandA}`}>Green Streets</span>{' '}
            <span className={`font-normal ${t.brandB}`}>Initiative</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-4 xl:gap-5 lg:flex">
          <Link href="/challenges" className={linkCls}>
            Challenges
          </Link>
          <Link href="/programs" className={linkCls}>
            Programs
          </Link>
          <Link href="/shift/towns" className={linkCls}>
            Towns
          </Link>
          <Link href="/nearby" className={linkCls}>
            Nearby
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
                className={`absolute right-0 top-full mt-2 min-w-[190px] rounded-xl border ${t.border} py-2 shadow-xl backdrop-blur-xl`}
                style={{ background: t.panelBg }}
              >
                {SHIFT_APP_ITEMS.map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    className={`block px-4 py-2 text-[0.8125rem] font-medium ${t.link} transition-colors ${t.panelHover}`}
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
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors ${t.donate}`}
          >
            Donate
          </Link>
          <Link
            href="/shift"
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-opacity ${t.download}`}
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
          <span className={`block h-0.5 w-6 ${t.burger} transition-transform ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block h-0.5 w-6 ${t.burger} transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-6 ${t.burger} transition-transform ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={`border-t ${t.border} px-6 py-4 lg:hidden`}>
          <div className="flex flex-col gap-4">
            <Link href="/challenges" className={mobileLink} onClick={() => setMenuOpen(false)}>Challenges</Link>
            <Link href="/programs" className={mobileLink} onClick={() => setMenuOpen(false)}>Programs</Link>
            <Link href="/shift/towns" className={mobileLink} onClick={() => setMenuOpen(false)}>Towns</Link>
            <Link href="/nearby" className={mobileLink} onClick={() => setMenuOpen(false)}>Nearby</Link>
            <Link href="/guides" className={mobileLink} onClick={() => setMenuOpen(false)}>Guides</Link>
            <Link href="/events" className={mobileLink} onClick={() => setMenuOpen(false)}>Events</Link>
            <Link href="/about" className={mobileLink} onClick={() => setMenuOpen(false)}>About</Link>
            <Link href="/get-involved" className={mobileLink} onClick={() => setMenuOpen(false)}>Get involved</Link>
            <Link href="/contact" className={mobileLink} onClick={() => setMenuOpen(false)}>Contact</Link>

            <div className={`mt-1 border-t ${t.border} pt-3`}>
              <p className={`mb-2 text-[11px] font-bold uppercase tracking-widest ${t.groupLabel}`}>Shift app</p>
              <div className="flex flex-col gap-3 pl-1">
                {SHIFT_APP_ITEMS.map(([href, label]) => (
                  <Link key={href} href={href} className={mobileLink} onClick={() => setMenuOpen(false)}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/donate" className={`mt-2 inline-block rounded-full border px-4 py-2 text-center text-sm font-semibold ${t.donate}`} onClick={() => setMenuOpen(false)}>Donate</Link>
            <Link href="/shift" className={`inline-block rounded-full px-4 py-2 text-center text-sm font-semibold ${t.download}`} onClick={() => setMenuOpen(false)}>Download Shift</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
