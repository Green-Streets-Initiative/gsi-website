'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { Check, Link2, MapPinned, Smartphone, type LucideIcon } from 'lucide-react'
import { Badge, Card } from '@/components/organizers/ui'
import { lessonOffer, track, waysText, type LessonOffer, type PartnerKind, type PartnerWay } from '@/lib/together'

/**
 * What to do while Shift looks for a match, so "we'll email you" is never the
 * end of the page (the app's PartnerFallback, for the web): the free road
 * lesson for people trying a bike near the school, plan the route, invite
 * someone, and the app.
 */

const PLAN_SUB: Record<PartnerWay, string> = {
  bike: 'See the calmest bike route for your trip.',
  walk: 'See the walking route and how long it takes.',
  transit: 'See which bus or train to take, and when.',
  micro: 'See the calmest route for your trip.',
}

export default function NextSteps({ kind, ways, source }: { kind: PartnerKind; ways: PartnerWay[]; source: 'saved' | 'matches' }) {
  const way: PartnerWay = ways[0] ?? 'bike'
  const [copied, setCopied] = useState(false)
  const invite = async () => {
    const url = 'https://www.gogreenstreets.org/together'
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt('Copy this link', url)
    }
    track('together_invite_copied', { kind, source })
  }
  return (
    <section aria-labelledby="together-meanwhile" className="grid grid-cols-1 gap-3">
      <h2 id="together-meanwhile" className="font-display text-[22px] font-extrabold">While you wait</h2>
      {kind === 'newcomer' && ways.includes('bike') ? <LessonCard /> : null}
      <div className={kind === 'carpool' ? 'grid grid-cols-1 gap-3 sm:max-w-[320px]' : 'grid grid-cols-1 gap-3 sm:grid-cols-3'}>
        {kind !== 'carpool' ? (
          <Tile Icon={MapPinned} title="Plan your route" sub={PLAN_SUB[way]} href="/nearby?plan=1" onClick={() => track('together_plan_opened', { source })} />
        ) : null}
        {/* Why invite: a friend who already makes the trip can be your match, or someone who'd like to try can be the guide's.
            Not for a carpool: anyone who already drives your way, you'd simply ask (Keith 2026-10-27). */}
        {kind !== 'carpool' ? (
          <Tile
            Icon={copied ? Check : Link2}
            title={kind === 'guide' ? `Know someone who\u2019d like to start ${waysText(ways, 'ing')}?` : `Know someone who already ${waysText(ways, 'does')} to work?`}
            sub={copied
              ? 'Link copied. Send it to them.'
              : kind === 'guide'
                ? 'Send them this page. If they live near you, Shift can match you so you can show them how.'
                : 'Send them this page. If they live near you, Shift can match you so they can show you how.'}
            onClick={() => void invite()}
          />
        ) : null}
        <Tile
          Icon={Smartphone}
          title="Get the Shift app"
          sub={kind === 'carpool' ? 'Plan trips and count every one.' : 'Plan the first trip with your match, and count every trip.'}
          href="https://shift.gogreenstreets.org/get"
          onClick={() => track('together_get_app', { source })}
        />
      </div>
    </section>
  )
}

function Tile({ Icon, title, sub, href, onClick }: { Icon: LucideIcon; title: string; sub: string; href?: string; onClick?: () => void }) {
  const body: ReactNode = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-accent)" aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <span className="grid gap-1">
        <span className="text-[17px] font-bold leading-snug">{title}</span>
        <span className="text-[15px] leading-snug text-(--ev-ink-80)">{sub}</span>
      </span>
    </>
  )
  const cls = 'flex min-h-[44px] items-start gap-3 rounded-2xl border border-(--ev-line-strong) bg-white p-4 text-left transition hover:bg-(--ev-panel) sm:flex-col sm:gap-2'
  if (href) {
    return href.startsWith('/')
      ? <Link href={href} onClick={onClick} className={cls}>{body}</Link>
      : <a href={href} onClick={onClick} className={cls}>{body}</a>
  }
  return <button type="button" onClick={onClick} className={cls}>{body}</button>
}

/**
 * The free 1:1 road lesson, for newcomers by bike near the school (Shift 01454).
 * They ask on /bike-lessons, which sends when they're free to the instructors
 * (Keith 2026-10-28): the instructors' addresses are never shown (Shift 01475).
 */
const LESSON_FORM = '/bike-lessons#street-lesson'
const LESSON_LINK = 'inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill) hover:opacity-90'

export function LessonCard() {
  const [offer, setOffer] = useState<LessonOffer | null>(null)
  useEffect(() => { void lessonOffer().then(setOffer) }, [])
  if (!offer || (offer.state !== 'offer' && offer.state !== 'has_code')) return null

  if (offer.state === 'has_code') {
    return (
      <Card>
        <h3 className="font-display text-[22px] font-extrabold">{offer.requested ? 'Your lesson request is in' : 'Your free lesson code'}</h3>
        <p className="mt-3 inline-block rounded-xl border-2 border-(--ev-accent) px-4 py-2 font-display text-[26px] font-extrabold tracking-[0.12em]">{offer.code}</p>
        {offer.requested ? (
          <p className="mt-3 text-[16px] leading-relaxed text-(--ev-ink-85)">
            An instructor from the {offer.school} will email you to pick a time. Keep the code. The instructor will ask for it.
          </p>
        ) : (
          <>
            <p className="mt-3 text-[16px] leading-relaxed text-(--ev-ink-85)">
              Tell the {offer.school} when you’re usually free, and an instructor will email you to pick a time. Green Streets pays for the lesson.
            </p>
            <Link href={LESSON_FORM} onClick={() => track('together_lesson_request_link', { state: 'has_code' })} className={`${LESSON_LINK} mt-3`}>
              Send my request
            </Link>
          </>
        )}
      </Card>
    )
  }
  return (
    <Card className="flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[22px] font-extrabold">Book a free 1:1 lesson</h3>
          {offer.left != null && <Badge tone="good">{offer.left} left</Badge>}
        </div>
        <p className="mt-1 text-[16px] text-(--ev-ink-85)">Ride in traffic with an instructor from the {offer.school}. Green Streets pays.</p>
      </div>
      <Link href={LESSON_FORM} onClick={() => track('together_lesson_request_link', { state: 'offer' })} className={LESSON_LINK}>
        Ask for your free lesson
      </Link>
    </Card>
  )
}
