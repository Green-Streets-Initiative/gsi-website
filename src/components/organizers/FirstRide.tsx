'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import { errorText, getFirstRideStart } from '@/lib/organizers/api'
import { keepPrefill, prefillFrom, whenText, type CalendarListing, type FirstRideStart } from '@/lib/organizers/first-ride'
import { useConsole } from './ConsoleContext'
import { Button, Card, Notice, Spinner } from './ui'

/**
 * Where a personal console link lands (Shift 01588): pick one of your rides
 * from the GSI calendar and the ride form opens filled in. With nothing on
 * the calendar it goes straight to a blank form; with rides already on Shift,
 * to the rides list.
 */
export default function FirstRide() {
  const router = useRouter()
  const { me } = useConsole()
  const [start, setStart] = useState<FirstRideStart | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    getFirstRideStart()
      .then((s) => {
        if (!live) return
        if (s.has_rides || !me?.can_create) router.replace('/organizers')
        else if (s.listings.length === 0) router.replace('/organizers/rides/new?first=1')
        else setStart(s)
      })
      .catch((e) => { if (live) setErr(errorText(e, "We couldn't load your calendar listings.")) })
    return () => { live = false }
  }, [me?.can_create, router])

  if (err) {
    return (
      <Card className="mx-auto max-w-lg">
        <Notice tone="off">{err}</Notice>
        <Button variant="primary" className="mt-4" onClick={() => router.push('/organizers/rides/new?first=1')}>Set up a ride from scratch</Button>
      </Card>
    )
  }
  if (!start) return <Spinner label="Finding your rides on the calendar" />

  const host = start.organizer?.name
  // The account's own first name first. The link's name is whatever Keith
  // typed in Organizer Links, which for a shared inbox is the group's name
  // ("Welcome, Boston"), so it's used only when it isn't the group.
  const linkName = (start.link_name ?? '').trim()
  const linkIsGroup = !!host && !!linkName && (host.toLowerCase().includes(linkName.toLowerCase()) || linkName.toLowerCase().includes(host.toLowerCase()))
  const first = me?.first_name || (linkName && !linkIsGroup ? linkName.split(/\s+/)[0] : '')
  // A walking group's listings are walks: say walk, not ride.
  const walks = start.listings.filter((l) => l.activity === 'walk').length
  const thing = walks === 0 ? 'ride' : walks === start.listings.length ? 'walk' : 'ride or walk'
  const use = (l: CalendarListing) => {
    keepPrefill(prefillFrom(l, start.organizer))
    router.push('/organizers/rides/new?from=calendar')
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <p className="text-[15px] font-semibold text-(--ev-accent)">{first ? `Welcome, ${first}` : 'Welcome'}</p>
      <h1 className="mt-1 font-display text-[clamp(28px,3.6vw,38px)] font-extrabold leading-tight">Make your first {thing}</h1>
      <p className="mt-2 text-[16px] leading-snug text-(--ev-ink-85)">
        {start.listings.length === 1
          ? `Here\u2019s your ${thing} on the GSI calendar. Use it and we\u2019ll fill in the details for you to check.`
          : `Pick one of your ${thing === 'ride or walk' ? 'rides or walks' : `${thing}s`} on the GSI calendar and we\u2019ll fill in the details for you to check.`}
      </p>

      {host && <p className="mt-6 text-[14px] font-semibold text-(--ev-ink-75)">Listed under {host}</p>}
      <ul className={host ? 'mt-2 space-y-3' : 'mt-6 space-y-3'}>
        {start.listings.map((l) => (
          <li key={l.title}>
            <button
              type="button"
              onClick={() => use(l)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-(--ev-line-mid) bg-white px-4 py-4 text-left shadow-(--ev-shadow) transition hover:border-(--ev-accent) sm:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[19px] font-extrabold leading-tight text-(--ev-ink)">{l.title}</span>
                <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-(--ev-ink-80)">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 shrink-0" aria-hidden />{whenText(l)}</span>
                  {l.location_name && <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{l.location_name}</span></span>}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-semibold text-(--ev-accent-90)">
                <span className="hidden sm:inline">{l.activity === 'walk' ? 'Use this walk' : 'Use this ride'}</span>
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[15px] text-(--ev-ink-80)">
        Something else?{' '}
        <button type="button" onClick={() => router.push('/organizers/rides/new?first=1')} className="font-semibold text-(--ev-ink) underline">
          Start from scratch
        </button>
      </p>

      <p className="mt-8 border-t border-(--ev-line) pt-4 text-[14px] leading-snug text-(--ev-ink-75)">
        Saving gives your {thing} a page to share, and nobody needs the app to say they&rsquo;re coming.
      </p>
    </div>
  )
}
