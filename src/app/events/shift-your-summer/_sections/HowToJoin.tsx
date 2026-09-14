import { Section, SectionHeading } from './Section'

const STEPS: { title: string; body: string }[] = [
  { title: 'Get Shift', body: 'Free on iOS and Android. Join the challenge from the Community tab under Events.' },
  { title: 'Take active trips', body: 'Walk, bike, or ride transit. Shift counts the trip on its own, so there is nothing to log.' },
  {
    title: 'Win prizes',
    body: 'Every active trip is a prize entry. Earn extra entries by referring friends, completing Roams, and sharing a What Moves Us video.',
  },
]

export function HowToJoin() {
  return (
    <Section shape="wanderRight" tone="white" width="read">
      <SectionHeading title="How to join" />
      <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4 md:block">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-forest/50 font-serif text-[1.125rem] text-forest md:mb-4">
              {i + 1}
            </span>
            <div>
              <h3 className="font-serif text-[1.375rem] leading-tight text-navy">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}
