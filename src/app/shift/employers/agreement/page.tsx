import type { Metadata } from 'next'
import {
  AGREEMENT_TITLE,
  AGREEMENT_PREAMBLE,
  AGREEMENT_SECTIONS,
  AGREEMENT_VERSION,
} from '@/lib/employer-agreement'

export const metadata: Metadata = {
  title: 'Employer Platform Agreement — Shift · Green Streets Initiative',
  description:
    'The terms of the Shift Employer Platform subscription from Green Streets Initiative.',
}

// Public, linkable copy of the agreement (referenced from Stripe invoices
// and the portal's acceptance screen). Canonical text lives in
// src/lib/employer-agreement.ts — edit there, never here.
export default function EmployerAgreementPage() {
  // The site shell is dark navy — render the agreement as a white "paper"
  // sheet so the legal text is always dark-on-white regardless of theme.
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-2xl bg-white p-8 shadow-lg sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Green Streets Initiative · Shift
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{AGREEMENT_TITLE}</h1>
        <p className="mt-1 text-sm text-gray-600">Version {AGREEMENT_VERSION}</p>

        <p className="mt-6 text-[15px] leading-relaxed text-gray-700">
          {AGREEMENT_PREAMBLE}
        </p>

        {AGREEMENT_SECTIONS.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">{s.heading}</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-700">
              {s.body}
            </p>
          </section>
        ))}

        <p className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-600">
          Questions? info@gogreenstreets.org · Green Streets Initiative · EIN
          26-1484405
        </p>
      </div>
    </main>
  )
}
