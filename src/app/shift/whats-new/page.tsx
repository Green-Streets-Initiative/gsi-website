import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PhotoCredit from '@/components/PhotoCredit'
import StoreBadges from '@/components/StoreBadges'
import { SHIFT_UPDATES, type ShiftUpdate, type ShiftUpdatePicture } from '@/lib/shift-updates'
import Carousel from './Carousel'

/*
 * gogreenstreets.org/shift/whats-new: every Shift update people can use
 * today, newest first, as picture-led cards people flip through (Keith
 * 2026-11-10: "I bet people would flip through it"). The heading names the
 * season and the month of the newest entry so readers know how fresh it is;
 * no per-feature dates ("I don't think anybody cares about the date features
 * were released on"). The GSI newsletter leads with programs and events and
 * points here for the app news. The list is src/lib/shift-updates.ts; add
 * each release's entry at its top. English only for now, like the newsletter.
 *
 * Serves every Shift persona (docs/programs/personas.md), the newsletter
 * reader first: someone who heard of Shift and wants to know what it does now.
 */

// The street-sign look (Overpass headlines, Trebuchet text, the forest-green
// sign), set here directly so the page builds on its own.
const GSI_FONT = "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif"
const CONTAINER = 'mx-auto w-full max-w-[1120px] px-6 lg:px-8'

// Freshness, from the newest entry: "this fall" and "Updated November 2026".
const NEWEST = new Date(`${SHIFT_UPDATES[0].date}T12:00:00-05:00`)
const MONTH = NEWEST.toLocaleString('en-US', { month: 'long', timeZone: 'America/New_York' })
const YEAR = NEWEST.getFullYear()
const SEASON = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'][
  NEWEST.getMonth()
]

const TITLE = `What's new in Shift this ${SEASON}`
const DESCRIPTION = `The newest things in Shift, the free app from Green Streets Initiative, and on gogreenstreets.org, ${SEASON} ${YEAR}: what each one does and where to try it.`

export const metadata: Metadata = {
  title: `What's new in Shift, ${SEASON} ${YEAR} | Green Streets Initiative`,
  description: DESCRIPTION,
  alternates: { canonical: 'https://www.gogreenstreets.org/shift/whats-new' },
  openGraph: {
    title: `What's new in Shift, ${SEASON} ${YEAR}`,
    description: DESCRIPTION,
    url: 'https://www.gogreenstreets.org/shift/whats-new',
    siteName: 'Green Streets Initiative',
    images: [{ url: '/og/shift-og.png', width: 1200, height: 630, alt: 'Shift by Green Streets Initiative' }],
    locale: 'en_US',
    type: 'website',
  },
}

const WHERE: Record<ShiftUpdate['where'], string> = {
  app: 'In the app',
  web: 'On the web',
  both: 'App and web',
}

function StreetLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-forest underline-offset-4 hover:underline">
      {children} <span aria-hidden>&rarr;</span>
    </Link>
  )
}

/** The picture panel every card opens with: the same size on every card, so flipping feels even. */
const PANEL = 'relative aspect-[4/3] w-full overflow-hidden lg:aspect-auto lg:h-[440px]'

/** A tall screen from the app or site, framed and run off one edge of the panel. */
function Screen({ p }: { p: Extract<ShiftUpdatePicture, { kind: 'app' }> }) {
  const bottom = p.focus === 'bottom'
  return (
    <div className={`${PANEL} flex justify-center bg-forest/15 ${bottom ? 'items-end pb-6' : 'items-start pt-6'}`}>
      <div className="w-[58%] max-w-[300px] shrink-0 rounded-[26px] bg-navy p-[6px] shadow-[0_24px_50px_-24px_rgba(25,26,46,0.6)]">
        <Image src={p.src} alt={p.alt} width={p.width} height={p.height} sizes="300px" className="block w-full rounded-[20px]" />
      </div>
    </div>
  )
}

function Photo({ p, priority }: { p: Extract<ShiftUpdatePicture, { kind: 'photo' }>; priority?: boolean }) {
  return (
    <div className={PANEL}>
      <Image
        src={p.src}
        alt={p.alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 520px, 90vw"
        className="object-cover"
      />
    </div>
  )
}

/** The green street sign, holding the fact itself: what opened and how long it is. */
function Sign({ p }: { p: Extract<ShiftUpdatePicture, { kind: 'sign' }> }) {
  return (
    <div className={`${PANEL} flex items-center justify-center bg-forest/15 px-8`}>
      <div className="w-full max-w-[340px]" role="img" aria-label={`${p.place}: ${p.name}, ${p.detail}`}>
        <p className="mb-3 text-[15px] font-bold text-forest">{p.place}</p>
        <div className="rounded-[14px] border-[3px] border-white bg-forest px-6 py-5 text-white shadow-[0_0_0_2px_#2D6A4F,0_20px_44px_-26px_rgba(25,26,46,0.7)]">
          <p className="font-headline text-[1.75rem] font-extrabold leading-[1.05]">{p.name}</p>
          <p className="mt-2 text-[1.0625rem] text-white">{p.detail}</p>
        </div>
        <div className="mx-auto h-14 w-[10px] rounded-b-sm bg-[#8C939C]" aria-hidden />
      </div>
    </div>
  )
}

function Languages({ p }: { p: Extract<ShiftUpdatePicture, { kind: 'languages' }> }) {
  return (
    <div className={`${PANEL} flex items-center justify-center bg-forest/15 px-4 lg:px-6`}>
      <ul className="flex w-full max-w-[400px] flex-col gap-1.5 lg:gap-3">
        {p.lines.map((l, i) => (
          <li
            key={l.lang}
            lang={l.lang}
            className={`rounded-[10px] px-3 py-1.5 font-headline text-[0.9375rem] font-extrabold leading-tight lg:rounded-[12px] lg:px-5 lg:py-3 lg:text-[1.1875rem] ${
              i === 0 ? 'bg-white text-navy ring-1 ring-navy/10' : 'bg-forest text-white'
            }`}
          >
            {l.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Picture({ p, priority }: { p: ShiftUpdatePicture; priority?: boolean }) {
  switch (p.kind) {
    case 'app':
      return <Screen p={p} />
    case 'photo':
      return <Photo p={p} priority={priority} />
    case 'sign':
      return <Sign p={p} />
    case 'languages':
      return <Languages p={p} />
  }
}

/** One update: the picture first, then where it lives, the headline, one sentence and the way to try it. */
function Card({ u, index }: { u: ShiftUpdate; index: number }) {
  const p = u.picture
  return (
    <article
      id={u.id}
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${SHIFT_UPDATES.length}`}
      className="w-[calc(100vw-4.5rem)] max-w-[420px] shrink-0 snap-start scroll-mt-24 overflow-hidden rounded-[22px] bg-white ring-1 ring-navy/10 lg:grid lg:w-[min(920px,78vw)] lg:max-w-none lg:grid-cols-[1fr_1fr]"
    >
      <Picture p={p} priority={index === 0} />
      <div className="flex flex-col px-5 pb-5 pt-4 lg:px-9 lg:py-8">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex rounded-full bg-forest/10 px-3 py-1 text-[14px] font-bold text-forest">{WHERE[u.where]}</p>
          <p className="text-[14px] font-bold text-navy/75">
            {index + 1} of {SHIFT_UPDATES.length}
          </p>
        </div>
        <h2 className="mt-3 font-headline text-[1.375rem] font-extrabold leading-[1.15] text-navy lg:text-[1.75rem] lg:leading-[1.12]">
          {u.title}
        </h2>
        <p className="mt-3 text-[1.0625rem] leading-[1.55] text-navy lg:text-[1.125rem]">{u.body}</p>
        <div className="mt-auto pt-3">
          <StreetLink href={u.link.href}>{u.link.label}</StreetLink>
        </div>
        {p.kind === 'photo' && (
          <p className="mt-1 text-[13px] text-navy/75">
            <PhotoCredit text={p.credit} url={p.creditUrl} />
          </p>
        )}
      </div>
    </article>
  )
}

export default function WhatsNewPage() {
  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <Nav variant="light" street />

      <section className="bg-cream pt-[60px]">
        <div className={`${CONTAINER} pb-6 pt-6 md:pt-8`}>
          <div className="rounded-[20px] bg-forest px-5 pb-7 pt-7 text-white sm:px-10 sm:pb-8 sm:pt-8 md:rounded-[24px]">
            <h1 className="font-headline text-[clamp(2rem,5.2vw,3.125rem)] font-extrabold leading-[1.02] tracking-[-0.01em] text-white">
              {TITLE}
            </h1>
            <p className="mt-3 text-[1.0625rem] font-bold text-white">
              Updated {MONTH} {YEAR}
            </p>
            <p className="mt-3 max-w-[600px] text-[1.0625rem] leading-[1.55] text-white md:text-[1.1875rem]">
              Find better ways to get around. Get rewarded when you try them. Here are the {SHIFT_UPDATES.length} newest
              things in Shift and on our site, newest first.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Updates" className="pb-14">
        <Carousel slides={SHIFT_UPDATES.map((u) => ({ id: u.id, title: u.title }))}>
          {SHIFT_UPDATES.map((u, index) => (
            <Card key={u.id} u={u} index={index} />
          ))}
        </Carousel>
      </section>

      <section className="bg-forest">
        <div className={`${CONTAINER} flex flex-col gap-6 py-12 text-white lg:flex-row lg:items-center lg:justify-between`}>
          <div>
            <h2 className="font-headline text-[clamp(1.75rem,3.4vw,2.5rem)] font-extrabold leading-[1.08]">Try them in Shift</h2>
            <p className="mt-3 max-w-[520px] text-[1.0625rem] leading-[1.6] text-white">
              Free on iPhone and Android.{' '}
              <Link href="/shift" className="font-bold underline underline-offset-4">
                More about the app
              </Link>
            </p>
          </div>
          <StoreBadges placement="whats_new" />
        </div>
      </section>

      <Footer variant="light" />
    </div>
  )
}
