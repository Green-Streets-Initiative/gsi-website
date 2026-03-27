'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.08] backdrop-blur-xl" style={{ background: 'rgba(25,26,46,0.96)' }}>
      <div className="mx-auto flex h-[60px] w-full max-w-[1120px] items-center justify-between px-8">

        {/* Brand */}
        <Link href="/" className="flex items-center no-underline">
          <span className="text-[1.0625rem] tracking-[0.3px]" style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}>
            <span className="font-bold text-[#52B788]">Green Streets</span>{' '}
            <span className="font-normal text-white">Initiative</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/shift" className="text-sm font-medium text-white transition-opacity hover:opacity-80">
            Shift
          </Link>
          <Link href="/events/shift-your-summer" className="text-sm font-medium text-lime transition-opacity hover:opacity-80">
            Shift Your Summer
          </Link>
          <Link href="/programs" className="text-sm font-medium text-white transition-opacity hover:opacity-80">
            Programs
          </Link>
          <Link href="/commute-calculator" className="text-sm font-medium text-white transition-opacity hover:opacity-80">
            Calculator
          </Link>
          <Link href="/about" className="text-sm font-medium text-white transition-opacity hover:opacity-80">
            About
          </Link>
          <Link href="/get-involved" className="text-sm font-medium text-white transition-opacity hover:opacity-80">
            Get involved
          </Link>
          <Link href="/contact" className="text-sm font-medium text-white transition-opacity hover:opacity-80">
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
            <Link href="/shift" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Shift</Link>
            <Link href="/events/shift-your-summer" className="text-sm font-medium text-lime" onClick={() => setMenuOpen(false)}>Shift Your Summer</Link>
            <Link href="/programs" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Programs</Link>
            <Link href="/commute-calculator" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Calculator</Link>
            <Link href="/about" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>About</Link>
            <Link href="/get-involved" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Get involved</Link>
            <Link href="/contact" className="text-sm font-medium text-white" onClick={() => setMenuOpen(false)}>Contact</Link>
            <Link href="#waitlist" className="mt-2 inline-block rounded-full bg-lime px-4 py-2 text-sm font-semibold text-navy" onClick={() => setMenuOpen(false)}>Join waitlist</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
