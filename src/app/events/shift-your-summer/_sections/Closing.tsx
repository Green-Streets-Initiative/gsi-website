import Link from 'next/link'
import type { PageState } from '../_lib/load'
import { JoinCta } from './Hero'
import { Section } from './Section'
import { RULES_PUBLISHED } from './store'

export function Closing({ state }: { state: PageState }) {
  const heading =
    state === 'ended' ? (
      <>
        Ready for <em className="text-green-deep">the next one?</em>
      </>
    ) : (
      <>
        Ready to <em className="text-green-deep">compete?</em>
      </>
    )
  const body =
    state === 'active'
      ? 'Get Shift, join the challenge, and start earning your spot on the board.'
      : state === 'ended'
        ? 'Keep shifting trips with Shift. Every one saves you money, and you will be first to hear when the next challenge opens.'
        : 'Get Shift now and you are ready the moment the challenge goes live.'

  const links: { href: string; label: string }[] = [
    { href: '/events/shift-your-summer/partners', label: 'Sponsor a challenge' },
    ...(RULES_PUBLISHED ? [{ href: '/events/shift-your-summer/rules', label: 'Official rules' }] : []),
  ]

  return (
    <Section shape="terminal" closing>
      <h2 className="font-serif text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-[1.02] text-navy">{heading}</h2>
      <p className="mt-5 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">{body}</p>
      <JoinCta state={state} className="mt-8" />
      <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-navy/15 pt-8 text-[15px]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
