import type { Metadata } from 'next'
import Link from 'next/link'
import { ReviewerProvider } from '@/components/shortlist/ReviewerGate'

export const metadata: Metadata = {
  title: 'Shortlist workspace — Shift for Schools',
  robots: { index: false, follow: false },
}

// The volunteer's workspace for Project 1 of the guide. Same gate as the
// guide (middleware matches /volunteer/guide/*), same visual language.
export default function ShortlistLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F4F8EE] text-[#374151] text-[15.5px] leading-[1.55]">
      <header className="px-6 pt-6 pb-5" style={{ background: '#191A2E' }}>
        <div className="max-w-[960px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-[family-name:var(--font-bricolage)] font-extrabold text-[20px] tracking-tight text-white">
              Shift<span className="text-[#BAF14D] tracking-[-0.12em]">&#8250;&#8250;</span>
              <span className="ml-2.5 text-[13px] font-medium text-white/75 tracking-normal">
                for Schools
              </span>
            </div>
            <Link
              href="/volunteer/guide/shortlist"
              className="font-[family-name:var(--font-bricolage)] text-[22px] font-extrabold tracking-tight text-white no-underline hover:text-[#BAF14D]"
            >
              Shortlist workspace
            </Link>
          </div>
          <nav className="flex items-center gap-2 text-[13px]">
            <Link
              href="/volunteer/guide/shortlist"
              className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white/90 no-underline hover:bg-white/20"
            >
              All schools
            </Link>
            <Link
              href="/volunteer/guide#project-1"
              className="rounded-full bg-[#BAF14D] px-3 py-1.5 font-semibold text-[#191A2E] no-underline hover:bg-[#c9f56b]"
            >
              ← Guide
            </Link>
          </nav>
        </div>
      </header>
      <div className="h-[3px] bg-[#52B788]" />
      <ReviewerProvider>
        <div className="max-w-[960px] mx-auto px-6 pb-24">{children}</div>
      </ReviewerProvider>
      <footer className="border-t border-[#E4E2D9] px-6 py-6 pb-14 text-center text-[13px] text-[#6B7280]">
        Shift for Schools · Green Streets Initiative ·{' '}
        <a href="mailto:info@gogreenstreets.org" className="text-[#2966E5]">
          info@gogreenstreets.org
        </a>
      </footer>
    </main>
  )
}
