import type { ReactNode } from 'react'
import Link from 'next/link'
import { ShareNetwork } from '@phosphor-icons/react/dist/ssr'
import PageHero from '@/components/org/PageHero'
import StoreButtons from '@/components/StoreButtons'
import CountdownTimer from '@/components/CountdownTimer'
import { formatDateRange, type Competition, type PageState } from '../_lib/load'
import { ANDROID_URL, IOS_URL } from './store'

/** Store buttons plus the two secondary links that travel with them. */
export function JoinCta({ state, className = '' }: { state: PageState; className?: string }) {
  const live = state === 'active' || state === 'upcoming'
  return (
    <div className={className}>
      <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} placement="event_page" tone="light" className="[&>a]:max-[420px]:basis-full" />
      {live && (
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-ink-soft">
          <Link href="/events/shift-your-summer/share" className="inline-flex items-center gap-1.5 font-semibold text-forest underline-offset-4 hover:underline">
            <ShareNetwork size={16} aria-hidden /> Share with your team
          </Link>
          <Link href="/shift/employers" className="font-semibold text-forest underline-offset-4 hover:underline">
            Running a workplace team? &rarr;
          </Link>
        </p>
      )}
    </div>
  )
}

export function EventHero({
  competition,
  state,
  lede,
  fakeNow,
}: {
  competition: Competition
  state: Exclude<PageState, 'coming-soon'>
  lede: ReactNode
  fakeNow?: string | null
}) {
  // The title is the campaign's name, so the eyebrow carries the one thing the
  // name does not say: when it runs, and whether it is over.
  const eyebrow = formatDateRange(competition.starts_at, competition.ends_at) + (state === 'ended' ? ' · Complete' : '')
  return (
    <PageHero eyebrow={eyebrow} title={competition.name} lede={lede}>
      {state === 'upcoming' && (
        <div className="mt-7">
          <CountdownTimer targetDate={competition.starts_at} fakeNow={fakeNow ?? undefined} />
        </div>
      )}
      <JoinCta state={state} className="mt-8" />
    </PageHero>
  )
}

export function ComingSoonHero() {
  return (
    <PageHero
      eyebrow="Flagship challenge"
      title={
        <>
          The next challenge <em className="text-green-deep">is coming.</em>
        </>
      }
      lede="Shift Your Summer brings people across Massachusetts together to walk, bike, and ride transit for everyday trips, with real prizes from local businesses. Get the app now and you are on the board from day one."
    >
      <JoinCta state="coming-soon" className="mt-8" />
    </PageHero>
  )
}
