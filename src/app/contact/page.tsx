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
      <Nav variant="light" />
      <main className="min-h-screen bg-cream pt-[60px]">
      <div className="mx-auto max-w-[640px] px-6 pb-20 pt-12 md:pt-16 lg:px-8 lg:pb-24">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
            Get in touch
          </h1>
          <p className="mt-4 text-[1.0625rem] leading-[1.65] text-ink-soft">
            Whether you&apos;re an employer, a school, a local business, or just curious about
            Shift — we&apos;d love to hear from you. We&apos;ll get back to you within 2 business days.
          </p>
        </div>

        {/* Form */}
        <Suspense fallback={<div className="rounded-[14px] border border-navy/10 bg-white p-10 text-center text-ink-soft">Loading…</div>}>
          <ContactForm />
        </Suspense>

        {/* Below-form info */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="text-center sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Email us directly</p>
            <a href="mailto:info@gogreenstreets.org" className="mt-1 block text-sm font-semibold text-navy underline-offset-4 hover:underline">
              info@gogreenstreets.org
            </a>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">Based in</p>
            <p className="mt-1 text-sm text-ink-soft">Cambridge, MA</p>
          </div>
        </div>
      </div>
    </main>
      <Footer variant="light" />
    </>
  )
}
