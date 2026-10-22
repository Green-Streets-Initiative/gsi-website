'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, MapPin, Megaphone, Plus, Users } from 'lucide-react'
import { ago, clock, scheduleText } from '@/lib/rides/public'
import { errorText, getRides } from '@/lib/organizers/api'
import { UPDATE_KIND_LABEL, dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import type { DashboardRide, NextDate } from '@/lib/organizers/types'
import { useConsole } from './ConsoleContext'
import { Badge, Button, Card, Empty, Notice, Spinner, cx, type Tone } from './ui'

export function rideStateBadges(r: Pick<DashboardRide, 'status' | 'visibility' | 'calendar_status' | 'break_until' | 'my_role'>) {
  const out: { tone: Tone; text: string }[] = []
  if (r.status === 'archived') out.push({ tone: 'plain', text: 'Ended' })
  else if (r.break_until) out.push({ tone: 'warn', text: `On a break until ${dateLabel(r.break_until)}` })
  if (r.visibility === 'invite') out.push({ tone: 'plain', text: 'Invite only' })
  else if (r.status !== 'archived') {
    out.push(r.calendar_status === 'approved'
      ? { tone: 'good', text: 'On the calendar' }
      : r.calendar_status === 'rejected'
        ? { tone: 'off', text: 'Not on the calendar' }
        : { tone: 'info', text: 'Calendar review pending' })
  }
  if (r.my_role === 'leader') out.push({ tone: 'plain', text: 'Co-organizer' })
  if (r.my_role === 'admin') out.push({ tone: 'plain', text: 'GSI admin view' })
  return out
}

function DateChip({ d, rideId }: { d: NextDate; rideId: string }) {
  const off = d.status === 'canceled'
  return (
    <Link
      href={`/organizers/rides/${rideId}/roster?date=${d.id}`}
      className={cx(
        'group flex min-w-[148px] flex-1 flex-col rounded-xl border px-3 py-2.5 transition hover:border-(--ev-line-stronger)',
        off ? 'border-dashed border-(--ev-line-strong) bg-(--ev-panel-faint)' : 'border-(--ev-line-mid) bg-white',
      )}
    >
      <span className={cx('text-[14px] font-bold', off ? 'text-(--ev-ink-75) line-through' : 'text-(--ev-ink)')}>{dateLabel(d.date)}</span>
      <span className="text-[14px] text-(--ev-ink-75)">{off ? 'Cancelled' : clock(d.start_time)}{!off && d.moved ? ' · changed' : ''}</span>
      {!off && (
        <span className="mt-1 text-[14px] font-semibold text-(--ev-ink-85)">
          {d.going} going{d.maybe > 0 ? ` · ${d.maybe} maybe` : ''}
        </span>
      )}
      {!off && d.confirmed && <span className="mt-1 w-fit"><Badge tone="good">It&rsquo;s on</Badge></span>}
    </Link>
  )
}

function RideCard({ r }: { r: DashboardRide }) {
  const canPost = r.status !== 'archived' && (!r.ride_date || r.next_dates.length > 0)
  return (
    <Card as="li" className="list-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/organizers/rides/${r.id}`} className="font-display text-[21px] font-extrabold leading-tight text-(--ev-ink) hover:underline">
            {r.name}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-(--ev-ink-80)">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden />{scheduleText(r)}</span>
            {r.meetup_name && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{r.meetup_name}</span>}
            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />{plural(r.members, 'person', 'people')} on the ride</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rideStateBadges(r).map((b) => <Badge key={b.text} tone={b.tone}>{b.text}</Badge>)}
            {r.my_role === 'admin' && r.organizer_person && <Badge tone="plain">Organizer: {r.organizer_person}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPost && (
            <Link href={`/organizers/rides/${r.id}?post=1`} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] bg-(--ev-accent-fill) px-3.5 text-[14px] font-semibold text-(--ev-on-accent-fill) hover:opacity-90">
              <Megaphone className="h-4 w-4" aria-hidden />Post an update
            </Link>
          )}
          <Link href={`/organizers/rides/${r.id}`} className="inline-flex min-h-[40px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-3.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
            Open
          </Link>
        </div>
      </div>

      {r.open_requests > 0 && (
        <div className="mt-4">
          <Notice tone="warn">
            <Link href={`/organizers/rides/${r.id}/roster`} className="font-semibold underline">
              {plural(r.open_requests, 'credit request')} to review
            </Link>{' '}from people who say they came.
          </Notice>
        </div>
      )}

      {r.status !== 'archived' && (
        r.next_dates.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {r.next_dates.map((d) => <DateChip key={d.id} d={d} rideId={r.id} />)}
          </div>
        ) : (
          <p className="mt-4 text-[14px] text-(--ev-ink-75)">
            {r.break_until ? 'No dates until the break ends.' : r.ride_date ? 'This one-off ride has happened.' : 'No upcoming dates yet. They appear within a day of saving.'}
          </p>
        )
      )}

      {r.latest_update && (
        <p className="mt-4 border-t border-(--ev-line) pt-3 text-[14px] text-(--ev-ink-80)">
          <span className="font-semibold text-(--ev-ink)">Latest: {UPDATE_KIND_LABEL[r.latest_update.kind] ?? r.latest_update.title}</span>
          {r.latest_update.note ? ` · “${r.latest_update.note}”` : ''}
          <span className="text-(--ev-ink-75)"> · {ago(r.latest_update.created_at)} · sent to {r.latest_update.recipients}</span>
        </p>
      )}
    </Card>
  )
}

export default function Dashboard() {
  const { me } = useConsole()
  const [rides, setRides] = useState<DashboardRide[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showEnded, setShowEnded] = useState(false)
  const [claimNote, setClaimNote] = useState(me?.invites_claimed ?? 0)

  const load = useCallback(async () => {
    try {
      const list = await getRides()
      setRides(list)
      setErr(null)
    } catch (e) {
      setErr(errorText(e, "We couldn't load your rides."))
    }
  }, [])
  useEffect(() => {
    let live = true
    getRides()
      .then((list) => { if (live) setRides(list) })
      .catch((e) => { if (live) setErr(errorText(e, "We couldn't load your rides.")) })
    return () => { live = false }
  }, [])

  const groups = useMemo(() => {
    const all = rides ?? []
    const today = todayKey()
    // A one-off ride whose day has gone is history, with ended rides.
    const over = (r: DashboardRide) => r.status === 'archived' || (!!r.ride_date && r.ride_date < today && r.next_dates.length === 0)
    return {
      mine: all.filter((r) => r.my_role !== 'admin' && !over(r)),
      others: all.filter((r) => r.my_role === 'admin' && !over(r)),
      ended: all.filter(over),
    }
  }, [rides])

  const newRide = me?.can_create ? (
    <Link href="/organizers/rides/new" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill) hover:opacity-90">
      <Plus className="h-4 w-4" aria-hidden />New ride
    </Link>
  ) : null

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-(--ev-ink-75)">{me?.first_name ? `Hi, ${me.first_name}` : 'Welcome back'}</p>
          <h1 className="font-display text-[clamp(28px,3.6vw,38px)] font-extrabold leading-tight">Your rides</h1>
        </div>
        {newRide}
      </div>

      {claimNote > 0 && (
        <div className="mb-5">
          <Notice tone="good" onClose={() => setClaimNote(0)}>
            You&rsquo;re now a co-organizer of {plural(claimNote, 'ride')}. It&rsquo;s below, and in the Shift app too.
          </Notice>
        </div>
      )}

      {err && (
        <div className="mb-5"><Notice tone="off">{err} <button type="button" className="font-semibold underline" onClick={() => void load()}>Try again</button></Notice></div>
      )}

      {!rides && !err && <Spinner label="Loading your rides" />}

      {rides && groups.mine.length === 0 && groups.others.length === 0 && (
        <Empty
          title={groups.ended.length > 0 ? 'Nothing coming up' : me?.can_create ? 'Set up your first ride' : 'No rides yet'}
          action={newRide}
        >
          {groups.ended.length > 0 && me?.can_create
            ? 'Set up the next one: a one-off or a regular ride, with its own page to share.'
            : me?.can_create
            ? 'A one-off ride or a regular one, with a meeting point and a route. You get a ride page to share, and everyone who answers lands on your list.'
            : 'When an organizer adds you as a co-organizer, their ride shows up here.'}
        </Empty>
      )}

      {groups.mine.length > 0 && (
        <ul className="space-y-4">{groups.mine.map((r) => <RideCard key={r.id} r={r} />)}</ul>
      )}

      {groups.others.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-[20px] font-extrabold">Every group ride on Shift</h2>
          <p className="mb-4 text-[14px] text-(--ev-ink-75)">You see these as a GSI admin.</p>
          <ul className="space-y-4">{groups.others.map((r) => <RideCard key={r.id} r={r} />)}</ul>
        </section>
      )}

      {groups.ended.length > 0 && (
        <section className="mt-10">
          <Button variant="ghost" onClick={() => setShowEnded((v) => !v)} aria-expanded={showEnded}>
            {showEnded ? 'Hide' : 'Show'} {plural(groups.ended.length, 'past ride')}
          </Button>
          {showEnded && <ul className="mt-3 space-y-4">{groups.ended.map((r) => <RideCard key={r.id} r={r} />)}</ul>}
        </section>
      )}
    </div>
  )
}
