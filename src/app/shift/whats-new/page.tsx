import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PhotoCredit from '@/components/PhotoCredit'
import StoreBadges from '@/components/StoreBadges'
import { SHIFT_UPDATES, type ShiftUpdate, type ShiftUpdatePicture } from '@/lib/shift-updates'

/*
 * gogreenstreets.org/shift/whats-new: every Shift update people can use
 * today, newest first, each with a picture and the way to try it (no dates:
 * Keith 2026-11-10, nobody cares when it shipped). The GSI newsletter leads
 * with programs and events and points here for the app news. The list is src/lib/shift-updates.ts; add
 * each release's entry at its top. English only for now, like the newsletter.
 *
 * Serves every Shift persona (docs/programs/personas.md), the newsletter
 * reader first: someone who heard of Shift and wants to know what it does now.
 */

// The street-sign look (Overpass headlines, Trebuchet text, the forest-green
// sign), set here directly so the page builds on its own.
const GSI_FONT = "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif"
const CONTAINER = 'mx-auto w-full max-w-[1120px] px-6 lg:px-8'
const H3 = 'font-headline text-[1.375rem] font-extrabold leading-[1.15] text-navy'

function StreetLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-forest underline-offset-4 hover:underline">
      {children} <span aria-hidden>&rarr;</span>
    </Link>
  )
}

const TITLE = 'What\'s new with Shift'
const DESCRIPTION =
  'The newest things in Shift, the free app from Green Streets Initiative, and on gogreenstreets.org: what each one does and where to try it.'

export const metadata: Metadata = {
  title: `${TITLE} | Green Streets Initiative`,
  description: DESCRIPTION,
  alternates: { canonical: 'https://www.gogreenstreets.org/shift/whats-new' },
  openGraph: {
    title: TITLE,
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

/** A phone screenshot from the app, cut at a phone-ish height so long screens don't run on. */
function AppShot({ p, priority }: { p: Extract<ShiftUpdatePicture, { kind: 'app' }>; priority?: boolean }) {
  return (
    <div className="mx-auto w-[228px] rounded-[32px] bg-navy p-[7px] shadow-[0_28px_60px_-30px_rgba(25,26,46,0.65)]">
      <div className="relative max-h-[420px] overflow-hidden rounded-[26px] bg-navy">
        <Image src={p.src} alt={p.alt} width={p.width} height={p.height} priority={priority} sizes="214px" className="block w-full" />
      </div>
    </div>
  )
}

function Photo({ p, priority, big }: { p: Extract<ShiftUpdatePicture, { kind: 'photo' }>; priority?: boolean; big?: boolean }) {
  return (
    <figure>
      <div className={`relative overflow-hidden rounded-[20px] ${big ? 'aspect-[3/2]' : 'aspect-[16/10]'}`}>
        <Image
          src={p.src}
          alt={p.alt}
          fill
          priority={priority}
          sizes={big ? '(min-width: 1024px) 560px, 100vw' : '(min-width: 1024px) 480px, 100vw'}
          className="object-cover"
        />
      </div>
      <figcaption className="mt-2 text-[13px] text-navy/75">
        <PhotoCredit text={p.credit} url={p.creditUrl} />
      </figcaption>
    </figure>
  )
}

/** The green street sign, holding the fact itself: what opened, when, how long. */
function Sign({ p }: { p: Extract<ShiftUpdatePicture, { kind: 'sign' }> }) {
  return (
    <div className="mx-auto w-full max-w-[360px]" role="img" aria-label={`${p.name}, ${p.detail}`}>
      <p className="mb-3 text-[15px] font-bold text-forest">{p.place}</p>
      <div className="rounded-[14px] border-[3px] border-white bg-forest px-6 py-5 text-white shadow-[0_0_0_2px_#2D6A4F,0_20px_44px_-26px_rgba(25,26,46,0.7)]">
        <p className="font-headline text-[1.75rem] font-extrabold leading-[1.05]">{p.name}</p>
        <p className="mt-2 text-[1.0625rem] text-white">{p.detail}</p>
      </div>
      <div className="mx-auto h-16 w-[10px] rounded-b-sm bg-[#8C939C]" aria-hidden />
    </div>
  )
}

function Languages({ p }: { p: Extract<ShiftUpdatePicture, { kind: 'languages' }> }) {
  return (
    <ul className="mx-auto flex w-full max-w-[420px] flex-col gap-3">
      {p.lines.map((l, i) => (
        <li
          key={l.lang}
          lang={l.lang}
          className={`rounded-[14px] px-5 py-3 font-headline text-[1.0625rem] font-extrabold leading-snug lg:py-4 lg:text-[1.25rem] ${
            i === 0 ? 'bg-white text-navy ring-1 ring-navy/10' : 'bg-forest text-white'
          }`}
        >
          {l.text}
        </li>
      ))}
    </ul>
  )
}

function Picture({ p, priority, big }: { p: ShiftUpdatePicture; priority?: boolean; big?: boolean }) {
  switch (p.kind) {
    case 'app':
      return <AppShot p={p} priority={priority} />
    case 'photo':
      return <Photo p={p} priority={priority} big={big} />
    case 'sign':
      return <Sign p={p} />
    case 'languages':
      return <Languages p={p} />
  }
}

function Words({ u, lead }: { u: ShiftUpdate; lead?: boolean }) {
  return (
    <div>
      <p className="inline-flex rounded-full bg-forest/10 px-3 py-1 text-[14px] font-bold text-forest">{WHERE[u.where]}</p>
      <h3
        className={
          lead
            ? 'mt-2 font-headline text-[clamp(1.625rem,2.6vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.01em] text-navy'
            : `mt-2 ${H3}`
        }
      >
        {u.title}
      </h3>
      <p className={`mt-3 max-w-[520px] leading-[1.6] text-navy ${lead ? 'text-[1.1875rem]' : 'text-[1.0625rem]'}`}>{u.body}</p>
      <div className="mt-2">
        <StreetLink href={u.link.href}>{u.link.label}</StreetLink>
      </div>
    </div>
  )
}

/**
 * One update. The newest gets the big split; after that, photos sit wide,
 * screens and signs sit narrow, and the picture changes sides down the page.
 */
function Entry({ u, index }: { u: ShiftUpdate; index: number }) {
  const lead = index === 0
  const wide = u.picture.kind === 'photo'
  const flip = index % 2 === 1
  const cols = lead
    ? 'lg:grid-cols-[3fr_2fr]'
    : wide
      ? flip ? 'lg:grid-cols-[5fr_6fr]' : 'lg:grid-cols-[6fr_5fr]'
      : flip ? 'lg:grid-cols-[1fr_280px]' : 'lg:grid-cols-[280px_1fr]'
  // On phones a photo comes first; for screens and drawings the words lead.
  const tall = u.picture.kind !== 'photo'
  const pictureFirst = !flip
  return (
    <article id={u.id} className={`scroll-mt-28 grid items-center gap-6 lg:gap-12 ${cols}`}>
      <div className={`${pictureFirst ? 'lg:order-1' : 'lg:order-2'} ${tall ? 'order-2' : 'order-1'}`}>
        <Picture p={u.picture} priority={index < 2} big={lead} />
      </div>
      <div className={`${pictureFirst ? 'lg:order-2' : 'lg:order-1'} ${tall ? 'order-1' : 'order-2'}`}>
        <Words u={u} lead={lead} />
      </div>
    </article>
  )
}

/** Every update in one short list, so the page can be scanned before it's scrolled. */
function Contents() {
  return (
    <ol className="flex flex-col">
      {SHIFT_UPDATES.map((u) => (
        <li key={u.id} className="border-b border-navy/10 last:border-b-0">
          <a href={`#${u.id}`} className="flex min-h-[44px] items-center py-2 text-[15px] leading-snug text-navy hover:text-forest">
            <span>{u.short}</span>
          </a>
        </li>
      ))}
    </ol>
  )
}

export default function WhatsNewPage() {
  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <Nav variant="light" street />

      <section className="bg-cream pt-[60px]">
        <div className={`${CONTAINER} pb-8 pt-6 md:pt-10 lg:pb-10`}>
          <div className="rounded-[20px] bg-forest px-5 pb-8 pt-7 text-white sm:px-10 sm:pb-11 sm:pt-9 md:rounded-[24px]">
            <h1 className="font-headline text-[clamp(2rem,5.2vw,3.75rem)] font-extrabold leading-[1.02] tracking-[-0.01em] text-white">
              {TITLE}
            </h1>
            <p className="mt-5 max-w-[600px] text-[1.0625rem] leading-[1.55] text-white md:text-[1.1875rem]">
              Find better ways to get around. Get rewarded when you try them. Here&apos;s what you can do with
              Shift now, newest first.
            </p>
          </div>
          <details className="mt-4 rounded-[16px] bg-white px-5 py-1 ring-1 ring-navy/10 lg:hidden">
            <summary className="flex min-h-[48px] cursor-pointer items-center font-bold text-navy">
              All {SHIFT_UPDATES.length} updates
            </summary>
            <div className="pb-3">
              <Contents />
            </div>
          </details>
        </div>
      </section>

      <div className={`${CONTAINER} grid gap-10 pb-16 pt-2 lg:grid-cols-[200px_1fr] lg:gap-12`}>
        {/* Wide screens: the list stays beside the updates as you scroll. */}
        <nav aria-label="All updates" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="mb-1 font-bold text-navy">All {SHIFT_UPDATES.length} updates</p>
            <Contents />
          </div>
        </nav>
        <div className="flex min-w-0 flex-col divide-y divide-navy/10 [&>*:not(:first-child)]:pt-10 [&>*:not(:last-child)]:pb-10 lg:[&>*:not(:first-child)]:pt-12 lg:[&>*:not(:last-child)]:pb-12">
          {SHIFT_UPDATES.map((u, index) => (
            <Entry key={u.id} u={u} index={index} />
          ))}
        </div>
      </div>

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
