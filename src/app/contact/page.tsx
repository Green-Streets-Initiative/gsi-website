import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ContactForm from '@/components/ContactForm'

export const metadata = {
  title: 'Contact – Green Streets Initiative',
  description: 'Get in touch with Green Streets Initiative. Whether you\'re an employer, school, local business, or just curious about Shift — we\'d love to hear from you.',
}

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-navy pt-[60px]">
      <div className="mx-auto max-w-[640px] px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Get in touch
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Whether you&apos;re an employer, a school, a local business, or just curious about
            Shift — we&apos;d love to hear from you. We&apos;ll get back to you within 2 business days.
          </p>
        </div>

        {/* Form */}
        <Suspense fallback={<div className="rounded-2xl bg-card p-10 text-center text-white/40">Loading…</div>}>
          <ContactForm />
        </Suspense>

        {/* Below-form info */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Email us directly</p>
            <a href="mailto:info@gogreenstreets.org" className="mt-1 block text-sm text-white/70 hover:text-white">
              info@gogreenstreets.org
            </a>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Based in</p>
            <p className="mt-1 text-sm text-white/70">Cambridge, MA</p>
          </div>
        </div>
      </div>
    </main>
      <Footer />
    </>
  )
}
