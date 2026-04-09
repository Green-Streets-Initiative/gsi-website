import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import Link from 'next/link'

export const metadata = {
  title: 'Link Expired — Green Streets Initiative',
}

export default function ExpiredPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        <section className="flex min-h-[60vh] items-center justify-center px-8 py-24">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-6 text-5xl">🔗</div>
            <h1 className="font-display mb-4 text-2xl font-bold tracking-tight text-white">
              This link has expired
            </h1>
            <p className="mb-8 text-sm leading-relaxed text-white/60">
              The funder dashboard link you used is no longer valid. Links expire
              after a set period or may have been revoked by the campaign
              administrator.
            </p>
            <p className="mb-8 text-sm text-white/60">
              Please contact Green Streets Initiative to request a new link.
            </p>
            <Link
              href="mailto:info@gogreenstreets.org"
              className="inline-block rounded-lg bg-lime px-6 py-3 text-sm font-semibold text-navy transition hover:bg-lime/90"
            >
              Contact GSI
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
