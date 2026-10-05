import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Page not found' }

// The site-wide "not found" page. Next's default is an unstyled "404 | This
// page could not be found", which is what a stale challenge link used to show
// (portal review UX-P11). Same white sheet as the rules pages.
export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-10">
        <p className="text-sm font-semibold text-emerald-700">Green Streets Initiative</p>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-700">
          The link may be out of date, or the page may have moved. If someone shared it with you, ask them
          for a fresh link.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-emerald-700 px-5 text-[15px] font-semibold text-white hover:bg-emerald-800"
          >
            Go to the home page
          </Link>
          <Link
            href="/shift"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 px-5 text-[15px] font-semibold text-gray-900 hover:bg-gray-50"
          >
            About the Shift app
          </Link>
        </div>
      </div>
    </main>
  )
}
