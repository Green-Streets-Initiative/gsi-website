'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.08] backdrop-blur-xl" style={{ background: 'rgba(25,26,46,0.96)' }}>
      <div className="mx-auto flex h-[60px] w-full max-w-[1120px] items-center justify-between px-8">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <svg width="22" height="17" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
            <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
          </svg>
          <span className="font-display text-[1.0625rem] font-semibold tracking-tight text-white">
            <span className="text-lime">Green Streets</span>{' '}Initiative
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/shift" className="text-sm font-medium text-white/60 transition-colors hover:text-white">
            Shift app
          </Link>
          <Link href="/programs" className="text-sm font-medium text-white/60 transition-colors hover:text-white">
            Programs
          </Link>
          <Link href="/commute-calculator" className="text-sm font-medium text-white/60 transition-colors hover:text-white">
            Calculator
          </Link>
          <Link href="/about" className="text-sm font-medium text-white/60 transition-colors hover:text-white">
            About
          </Link>
          <Link href="/contact" className="text-sm font-medium text-white/60 transition-colors hover:text-white">
            Contact
          </Link>
          <Link
            href="#waitlist"
            className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-navy transition-opacity hover:opacity-85"
          >
            Join waitlist
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="flex flex-col gap-1.5 md:hidden"
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
        <div className="border-t border-white/[0.07] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/shift" className="text-sm font-medium text-white/70" onClick={() => setMenuOpen(false)}>Shift app</Link>
            <Link href="/programs" className="text-sm font-medium text-white/70" onClick={() => setMenuOpen(false)}>Programs</Link>
            <Link href="/commute-calculator" className="text-sm font-medium text-white/70" onClick={() => setMenuOpen(false)}>Calculator</Link>
            <Link href="/about" className="text-sm font-medium text-white/70" onClick={() => setMenuOpen(false)}>About</Link>
            <Link href="/contact" className="text-sm font-medium text-white/70" onClick={() => setMenuOpen(false)}>Contact</Link>
            <Link href="#waitlist" className="mt-2 inline-block rounded-full bg-lime px-4 py-2 text-sm font-semibold text-navy" onClick={() => setMenuOpen(false)}>Join waitlist</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
