import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

// "The Shift assistant and your data", linked from the footer of the app's
// assistant (Keith 2026-10-27: Your data, Privacy and Terms on every
// assistant, the same across the app, the organizer tools and the employer
// portal). The organizer and employer versions are /organizers/assistant-data
// and /shift/employers/assistant-data. Keep it in step with the code: the
// model (api/shift/assistant/route.ts), what the tools read
// (lib/shift-assistant/tools.ts), pictures (Shift 01441), reminders (Shift
// 01465), and the privacy policy's Shift Assistant section. Anthropic's terms
// as in the employer note (lib/employer-assistant/data-note.ts), checked
// 2026-10-22.

export const metadata = {
  title: 'The Shift assistant and your data – Green Streets Initiative',
  description: 'What the assistant in the Shift app sees, who processes it, what Green Streets keeps, and how to delete it.',
}

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'What it is',
    body: [
      'The assistant is an optional part of the Shift app. You ask about getting around in your own words, and it answers with what Shift knows: trip comparisons, group rides and walks, fares, weather, service changes and your own activity.',
      'It saves a place, changes a setting or sets a trip reminder only after you tap the button on its card.',
    ],
  },
  {
    heading: 'What it sees',
    body: [
      'The conversation, your saved places, your recent trips (times, how you traveled, and “Home” or “Work”, not map points), your points, badges and rewards, and your phone’s location when you allow it, rounded to about 100 meters.',
      'A picture you attach. It is stored privately with that conversation and deleted with it. If you report a problem, the Green Streets team sees the picture with your report.',
      'A trip reminder you set keeps that trip’s start, destination and time. After the trip, Shift looks at your trips from around then for one that starts or ends near those places, to tell you it counted.',
      'To answer, it looks up places and directions with Google Maps, the forecast with the National Weather Service, service changes with the MBTA, and a Ride with GPS route when you share its link. These receive the places involved, not your name or email.',
    ],
  },
  {
    heading: 'Who processes it',
    body: [
      'The assistant runs on Anthropic’s Claude models (Claude Sonnet 5.5 today; if it declines a request on safety grounds, Anthropic re-runs it on an earlier Claude model), through Anthropic’s commercial API. Under Anthropic’s commercial terms, your data is not used to train their models, and inputs and outputs are deleted from Anthropic’s systems within 30 days, except where content is flagged by their safety systems (kept up to 2 years) or the law requires longer.',
      'The service providers the rest of Shift already uses handle the assistant too: Supabase stores conversations and pictures (United States, Oregon), and Vercel runs the website that answers.',
      'The app’s usage analytics record that the assistant was opened and which of its tools it used, never what you type or what it writes.',
    ],
  },
  {
    heading: 'What Green Streets keeps',
    body: [
      'Green Streets staff may read conversations to fix problems and improve the assistant. Conversations are deleted 12 months after your last message, and when you delete your account. You can delete a conversation, or all of them, with the trash button in the assistant; its pictures and reminders go with it.',
      'When you ask for something Shift doesn’t do yet, or share feedback, the assistant passes a short note to Green Streets. We keep these notes, apart from the conversation, to decide what to build next.',
    ],
  },
  {
    heading: 'Questions',
    body: ['Email info@gogreenstreets.org.'],
  },
]

export default function ShiftAssistantDataPage() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 py-8 lg:py-10">
          <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.01em] text-navy">
            The Shift assistant and your data
          </h1>
          <p className="mt-4 text-[15px] text-ink-soft">Updated October 27, 2026</p>

          <div className="mt-10 space-y-10">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="mb-4 font-serif text-[1.75rem] font-normal leading-[1.1] text-navy">{s.heading}</h2>
                <div className="space-y-4">
                  {s.body.map((p) => (
                    <p key={p.slice(0, 40)} className="text-[1.0625rem] leading-[1.7] text-navy">{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-12 border-t border-navy/10 pt-6 text-[15px] text-ink-soft">
            See also the{' '}
            <a href="/privacy" className="font-semibold text-forest underline-offset-4 hover:underline">Privacy Policy</a>
            {' '}and the{' '}
            <a href="/terms" className="font-semibold text-forest underline-offset-4 hover:underline">Terms of Service</a>.
          </p>
        </article>
      </main>
      <Footer variant="light" />
    </>
  )
}
