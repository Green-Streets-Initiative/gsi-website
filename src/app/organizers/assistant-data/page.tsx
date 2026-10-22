import type { Metadata } from 'next'
import Link from 'next/link'

// "The ride assistant and your data", linked from the assistant's footer.
// Public (the console shell lets this one page through signed out). Keep it
// in step with the code: the model (api/organizers/assistant/route.ts), what
// the tools read (lib/organizer-assistant/tools.ts) and the retention purge
// (Shift 01376). Anthropic's terms as in the employer note
// (lib/employer-assistant/data-note.ts), checked 2026-10-22.

export const metadata: Metadata = {
  title: 'The ride assistant and your data | Shift by Green Streets',
  robots: { index: false, follow: true },
}

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'What it is',
    body: [
      'The ride assistant is an optional part of Shift’s organizer tools. An organizer asks for something in their own words (plan a ride, post an update, move a date, see who’s coming) and the assistant does the work with them.',
      'It acts with that organizer’s own permissions: it can do only what they could do on the screens themselves. Anything people on a ride or the public would see (a new ride, a change, an update, a cancelled or moved date, a break or an end, an invite, a credit decision) waits for the organizer to approve it on a card the tool writes. Ending a ride also needs its name typed to confirm.',
    ],
  },
  {
    heading: 'What it sees',
    body: [
      'The conversation itself, and what the organizer tools already show that organizer: their rides, dates and updates, who is coming by first name and last initial, turnout totals, and the co-organizer invites they sent.',
      'It never sees the email address or phone number of anyone who answered on a ride page. Organizers never see those either; Shift sends messages for them.',
      'To help pick a meeting point it looks places up with Google Maps, and for the weather it asks the National Weather Service for the forecast at the meeting point.',
    ],
  },
  {
    heading: 'Who processes it',
    body: [
      'The assistant runs on Anthropic’s Claude models (Claude Opus 5.5 today; if it declines a request on safety grounds, Anthropic re-runs it on an earlier Claude model), through Anthropic’s commercial API. Under Anthropic’s commercial terms, your data is not used to train their models, and inputs and outputs are deleted from Anthropic’s systems within 30 days, except where content is flagged by their safety systems (kept up to 2 years) or the law requires longer.',
      'The service providers the rest of Shift already uses handle the assistant too: Supabase stores the conversations (United States, Oregon); Vercel runs the website; Resend sends the emails that follow an approved action (updates to people who answered on the ride page, co-organizer invites).',
      'The website’s usage analytics (PostHog) are kept out of the assistant: they record neither what anyone types nor what the assistant writes.',
    ],
  },
  {
    heading: 'What Green Streets keeps',
    body: [
      'Conversations are private to the organizer who had them: co-organizers cannot read them. Green Streets staff may review conversations to improve the assistant. Each organizer can delete their own conversations at any time, from History in the assistant. Conversations are deleted automatically 12 months after their last message, with any thumbs up or down given to a reply.',
      'When someone asks for something the tools do not do yet, or shares feedback, the assistant passes a short note to Green Streets. Green Streets keeps these notes, apart from the conversation, to decide what to build next.',
    ],
  },
  {
    heading: 'Questions',
    body: ['Email info@gogreenstreets.org.'],
  },
]

export default function AssistantDataPage() {
  return (
    <article className="mx-auto max-w-[720px]">
      <Link href="/organizers" className="text-[14px] font-semibold text-(--ev-ink-80) hover:text-(--ev-ink)">Organizer tools</Link>
      <h1 className="mt-2 font-display text-[clamp(28px,3.6vw,38px)] font-extrabold leading-tight">The ride assistant and your data</h1>
      <p className="mt-1 text-[14px] text-(--ev-ink-75)">Updated October 22, 2026</p>
      {SECTIONS.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="font-display text-[21px] font-extrabold">{s.heading}</h2>
          {s.body.map((p) => <p key={p.slice(0, 40)} className="mt-3 text-[16px] leading-relaxed text-(--ev-ink-85)">{p}</p>)}
        </section>
      ))}
    </article>
  )
}
