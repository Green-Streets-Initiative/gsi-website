import { Suspense } from 'react'
import ContactForm from '@/components/ContactForm'

// The employers page's own inquiry form. Same /api/contact path as the
// contact page (contact_inquiries + CRM sync + email), preset to the
// employer inquiry type, and it fires the employer_inquiry analytics event
// on success so inbound can be counted and bid on.
export default function EmployerInquiry({ nextDate }: { nextDate: string | null }) {
  return (
    <section id="inquiry" className="scroll-mt-20 bg-cream px-6 pb-20 pt-8 lg:px-8 lg:pb-24 lg:pt-10">
      <div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <div>
          <h2 className="mb-4 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
            Get a free trial code, or book a demo
          </h2>
          <p className="mb-6 text-[1.0625rem] leading-[1.65] text-ink-soft">
            Tell us your company and roughly how many people work at your Massachusetts office, and pick what you would like. We reply within two business days: a private team code for the next Walk/Ride Day
            {nextDate ? <> (<span className="font-semibold text-navy">{nextDate}</span>)</> : null} with a note you can forward to staff, or a time for a 20-minute walkthrough, or both.
          </p>
          <ul className="flex flex-col gap-3 text-[0.9375rem] leading-[1.6] text-ink-soft">
            {[
              'No cost and nothing to sign for the trial or the demo.',
              'You see your team’s totals the week after, never anyone’s trips or routes.',
              'If it works for your team, plans start at $500 a year.',
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-forest" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Suspense fallback={<div className="min-h-[420px] rounded-[14px] border border-navy/10 bg-white" aria-hidden />}>
            <ContactForm defaultInquiryType="Employer partnership" source="employers" />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
