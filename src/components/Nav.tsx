'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { chromeStrings } from '@/lib/site-strings/chrome'

/**
 * Nav IA (Keith, 07-14): Towns is civic information relevant to anyone in
 * these communities — it stands top-level. App-specific surfaces group under
 * the "Shift app" dropdown so the top bar doesn't grow. Pattern going
 * forward: civic/community content can earn top-level slots; app product
 * pages live in the dropdown.
 *
 * Streamlined 2026-10-06 (Keith): nine links became five plus two dropdowns.
 * "Plan a trip" takes Nearby's slot (renamed and given its own page,
 * /trip, 2026-11-12; "What's near you" stays in the Shift app menu and the
 * footer). About, Programs, Get
 * involved and Contact — together fewer visits than Guides — fold into one
 * "About" dropdown. Both dropdowns stay in the HTML when closed (hidden, not
 * unmounted) so crawlers still see every link from the nav, not only from the
 * footer.
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

type NavKey = keyof typeof chromeStrings.en
type NavItem = [href: string, label: NavKey, wideOnly?: boolean]

const TOP_ITEMS: NavItem[] = [
  ['/challenges', 'nav.challenges'],
  ['/events', 'nav.events'],
  // Plan a trip (Keith 2026-11-12): its own page, From/To and every way
  // there. The neighborhood snapshot stays under the Shift app menu.
  ['/trip', 'nav.plan'],
  // Trail seekers are one of the strongest search audiences (personas.md);
  // /trails had no way in from the menu (site review 2026-11-04).
  // Top bar from xl up only: at lg it crowds the wordmark. Always in the menu.
  ['/trails', 'nav.trails', true],
  ['/guides', 'nav.guides'],
  ['/shift/towns', 'nav.towns'],
]

const ABOUT_ITEMS: NavItem[] = [
  ['/about', 'nav.about_gsi'],
  ['/programs', 'nav.programs'],
  ['/get-involved', 'nav.get_involved'],
  ['/contact', 'nav.contact'],
]

const SHIFT_APP_ITEMS: NavItem[] = [
  ['/shift', 'nav.about_shift'],
  ['/nearby', 'nav.near_you'],
  ['/shift/schools', 'nav.schools'],
  ['/shift/roams', 'nav.roams'],
  ['/commute-advisor', 'nav.advisor'],
  ['/shift/employers/login', 'nav.employer_login'],
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

type Menu = 'about' | 'app' | null

/** `locale`: a translated page passes its language; every other page stays English. */
export default function Nav({ variant = 'dark', street = false, locale = 'en' }: { variant?: Variant; street?: boolean; locale?: SiteLocale }) {
  const t = THEME[variant]
  const tr = translator(chromeStrings, locale)
  const href = (h: string) => withLang(h, locale)
  // Street-sign look: sentence-case group label instead of spaced caps.
  const groupCls = street ? 'mb-2 text-[13px] font-bold' : 'mb-2 text-[11px] font-bold uppercase tracking-widest'
  const linkCls = `whitespace-nowrap text-[0.8125rem] font-medium ${t.link} transition-opacity hover:opacity-80`
  const mobileLink = `text-sm font-medium ${t.link}`
  const [menuOpen, setMenuOpen] = useState(false)
  const [open, setOpen] = useState<Menu>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Close an open dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const dropdown = (id: Exclude<Menu, null>, label: string, items: NavItem[]) => {
    const isOpen = open === id
    return (
      <div className="relative">
        <button
          className={`${linkCls} flex items-center gap-1`}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-controls={`nav-menu-${id}`}
          onClick={() => setOpen(isOpen ? null : id)}
        >
          {label}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {/* Always rendered (hidden when closed): the links stay in the server
            HTML for crawlers, and screen readers get a real menu. */}
        <div
          id={`nav-menu-${id}`}
          role="menu"
          hidden={!isOpen}
          className={`absolute right-0 top-full mt-2 min-w-[190px] rounded-xl border ${t.border} py-2 shadow-xl backdrop-blur-xl`}
          style={{ background: t.panelBg }}
        >
          {items.map(([to, text]) => (
            <Link
              key={to}
              href={href(to)}
              role="menuitem"
              className={`block px-4 py-2 text-[0.8125rem] font-medium ${t.link} transition-colors ${t.panelHover}`}
              onClick={() => setOpen(null)}
            >
              {tr(text)}
            </Link>
          ))}
        </div>
      </div>
    )
  }

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
        <div ref={barRef} className="hidden items-center gap-4 xl:gap-5 lg:flex">
          {TOP_ITEMS.map(([to, label, wideOnly]) => (
            <Link key={to} href={href(to)} className={wideOnly ? `${linkCls} hidden xl:inline` : linkCls}>
              {tr(label)}
            </Link>
          ))}

          {dropdown('about', tr('nav.about'), ABOUT_ITEMS)}
          {dropdown('app', tr('nav.shift_app'), SHIFT_APP_ITEMS)}

          <Link
            href={href('/donate')}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors ${t.donate}`}
          >
            {tr('nav.donate')}
          </Link>
          <Link
            href={href('/shift')}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-opacity ${t.download}`}
          >
            {tr('nav.download')}
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="flex flex-col gap-1.5 lg:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={tr('nav.toggle')}
          aria-expanded={menuOpen}
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
            {TOP_ITEMS.map(([to, label]) => (
              <Link key={to} href={href(to)} className={mobileLink} onClick={() => setMenuOpen(false)}>
                {tr(label)}
              </Link>
            ))}

            {([[tr('nav.about'), ABOUT_ITEMS], [tr('nav.shift_app'), SHIFT_APP_ITEMS]] as Array<[string, NavItem[]]>).map(([label, items]) => (
              <div key={label} className={`mt-1 border-t ${t.border} pt-3`}>
                <p className={`${groupCls} ${t.groupLabel}`}>{label}</p>
                <div className="flex flex-col gap-3 pl-1">
                  {items.map(([to, text]) => (
                    <Link key={to} href={href(to)} className={mobileLink} onClick={() => setMenuOpen(false)}>
                      {tr(text)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <Link href={href('/donate')} className={`mt-2 inline-block rounded-full border px-4 py-2 text-center text-sm font-semibold ${t.donate}`} onClick={() => setMenuOpen(false)}>{tr('nav.donate')}</Link>
            <Link href={href('/shift')} className={`inline-block rounded-full px-4 py-2 text-center text-sm font-semibold ${t.download}`} onClick={() => setMenuOpen(false)}>{tr('nav.download')}</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
