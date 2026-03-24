import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export default function ShiftSchools() {
  return (
    <>
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 py-24 text-center">
          <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">Shift for schools</div>
          <h1 className="mb-4 font-display text-4xl font-extrabold tracking-tighter text-white">Coming soon</h1>
          <p className="mb-8 max-w-md text-base leading-relaxed text-white">
            We&apos;re building the school program page. Reach out to learn how Shift can support active commuting at your school.
          </p>
          <div className="flex gap-4">
            <Link href="/contact?inquiry=school" className="rounded-full bg-[#BAF14D] px-6 py-3 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85">
              Contact us
            </Link>
            <Link href="/shift" className="rounded-full border border-white/[0.12] px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/25">
              Back to Shift
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
