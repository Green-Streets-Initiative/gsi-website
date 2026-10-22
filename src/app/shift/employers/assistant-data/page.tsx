import type { Metadata } from 'next'
import { DATA_NOTE_SECTIONS, DATA_NOTE_TITLE, DATA_NOTE_UPDATED } from '@/lib/employer-assistant/data-note'

export const metadata: Metadata = {
  title: `${DATA_NOTE_TITLE} — Shift · Green Streets Initiative`,
  description: 'What the Shift employer portal’s setup assistant sees, who processes it, what Green Streets keeps, and how to turn it off.',
}

// Public, linkable note for a customer's security or IT review (Keith
// 2026-10-22), linked from the portal's Settings. Text lives in
// src/lib/employer-assistant/data-note.ts — edit there. Same paper sheet as
// the Employer Platform Agreement.
export default function AssistantDataPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-2xl bg-white p-8 shadow-lg sm:p-12">
        <p className="text-sm font-semibold text-emerald-700">Green Streets Initiative · Shift</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{DATA_NOTE_TITLE}</h1>
        <p className="mt-1 text-sm text-gray-600">Updated {DATA_NOTE_UPDATED}</p>

        {DATA_NOTE_SECTIONS.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">{s.heading}</h2>
            {s.body.map((para, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-gray-700">
                {para}
              </p>
            ))}
          </section>
        ))}

        <p className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-600">
          See also the{' '}
          <a href="/shift/employers/agreement" className="text-emerald-700 underline">
            Employer Platform Agreement
          </a>
          . Green Streets Initiative · info@gogreenstreets.org
        </p>
      </div>
    </main>
  )
}
