'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowUp, CalendarDays, Check, ChevronRight, MapPin, Megaphone, MessageSquareText, Plus, Users } from 'lucide-react'
import { ago, clock, scheduleText } from '@/lib/rides/public'
import { errorText, getRides } from '@/lib/organizers/api'
import { UPDATE_KIND_LABEL, dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import type { DashboardRide, NextDate } from '@/lib/organizers/types'
import { ASSISTANT_CHANGED_EVENT, openAssistant } from './AssistantPanel'
import { useConsole } from './ConsoleContext'
import { FeedbackDueCard, FeedbackLink } from './Feedback'
import { NoMeetupHint, RideDayRiders, useRideDay, useRideTime } from './RideDay'
import { Badge, Card, Empty, Notice, Spinner, Tabs, cx, tabPanel, type Tone } from './ui'

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
        : { tone: 'info', text: 'Off the calendar' })
  }
  if (r.my_role === 'leader') out.push({ tone: 'plain', text: 'Leader' })
  if (r.my_role === 'admin') out.push({ tone: 'plain', text: 'GSI admin view' })
  return out
}

function DateChip({ d, rideId, phoneHidden }: { d: NextDate; rideId: string; phoneHidden?: boolean }) {
  const off = d.status === 'canceled'
  return (
    <Link
      href={`/organizers/rides/${rideId}/roster?date=${d.id}`}
      className={cx(
        phoneHidden ? 'hidden sm:inline-flex' : 'inline-flex',
        'min-h-[40px] items-center gap-2 rounded-full border px-3 text-[14px] transition hover:border-(--ev-line-stronger)',
        off ? 'border-dashed border-(--ev-line-strong) bg-(--ev-panel-faint)' : 'border-(--ev-line-mid) bg-white',
      )}
    >
      <span className={cx('font-bold', off ? 'text-(--ev-ink-75) line-through' : 'text-(--ev-ink)')}>{dateLabel(d.date)}</span>
      <span className="text-(--ev-ink-75)">
        {off ? 'Cancelled' : `${clock(d.start_time)}${d.moved ? ' (changed)' : ''} · ${d.going} going${d.maybe > 0 ? `, ${d.maybe} maybe` : ''}`}
      </span>
      {!off && d.confirmed && <Check className="h-4 w-4 text-(--ev-accent)" strokeWidth={3} aria-label="It's on" />}
    </Link>
  )
}

/** One ride as a row: what it is, its next dates, and the two things you do from here. */
function RideRow({ r }: { r: DashboardRide }) {
  const over = r.status === 'archived' || (!!r.ride_date && r.next_dates.length === 0)
  const canPost = !over && (!r.ride_date || r.next_dates.length > 0)
  const badges = rideStateBadges(r)
  return (
    <li className="list-none rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <Link href={`/organizers/rides/${r.id}`} className="font-display text-[19px] font-extrabold leading-tight text-(--ev-ink) hover:underline">
            {r.name}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-(--ev-ink-80)">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden />{scheduleText(r)}</span>
            {r.meetup_name && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{r.meetup_name}</span>}
            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />{plural(r.members, 'person', 'people')}</span>
          </p>
          {(badges.length > 0 || (r.my_role === 'admin' && r.organizer_person)) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((b) => <Badge key={b.text} tone={b.tone}>{b.text}</Badge>)}
              {r.my_role === 'admin' && r.organizer_person && <Badge tone="plain">Organizer: {r.organizer_person}</Badge>}
            </div>
          )}
        </div>
        <div className="flex gap-2 *:flex-1 *:justify-center sm:*:flex-none">
          {canPost && (
            <Link href={`/organizers/rides/${r.id}?post=1`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-3.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
              <Megaphone className="h-4 w-4" aria-hidden />Post an update
            </Link>
          )}
          <Link href={`/organizers/rides/${r.id}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-[10px] bg-(--ev-ink) px-3.5 text-[14px] font-semibold text-white hover:opacity-90">
            Open<ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {r.open_requests > 0 && (
        <div className="mt-3">
          <Notice tone="warn">
            <Link href={`/organizers/rides/${r.id}/roster`} className="font-semibold underline">
              {plural(r.open_requests, 'credit request')} to review
            </Link>{' '}from people who say they came.
          </Notice>
        </div>
      )}

      {!over && (
        r.next_dates.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {r.next_dates.map((d, i) => <DateChip key={d.id} d={d} rideId={r.id} phoneHidden={i > 1} />)}
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-(--ev-ink-75)">
            {r.break_until ? 'No dates until the break ends.' : 'No upcoming dates. Check When and the season dates in Edit ride.'}
          </p>
        )
      )}

      {r.latest_update && (
        <p className="mt-3 line-clamp-2 border-t border-(--ev-line) pt-3 text-[14px] text-(--ev-ink-80)">
          <span className="font-semibold text-(--ev-ink)">Latest: {UPDATE_KIND_LABEL[r.latest_update.kind] ?? r.latest_update.title}</span>
          {r.latest_update.note ? ` · “${r.latest_update.note}”` : ''}
          <span className="text-(--ev-ink-75)"> · {ago(r.latest_update.created_at)} · sent to {r.latest_update.recipients}</span>
        </p>
      )}
    </li>
  )
}

/** A number with its label under it; the label comes first for screen readers. */
function Readout({ n, label, word }: { n: ReactNode; label: string; word?: boolean }) {
  return (
    <div className="flex flex-col-reverse justify-end rounded-xl bg-white/[0.07] px-3 py-3 sm:px-4">
      <dt className="mt-1.5 text-[14px] font-semibold text-white/75">{label}</dt>
      <dd className={cx('flex min-h-[26px] items-center font-display font-extrabold leading-none text-white', word ? 'text-[19px]' : 'text-[26px]')}>{n}</dd>
    </div>
  )
}

/**
 * The next date across your rides, first (the employer portal's hero panel,
 * PortalHeroPanel): which ride, when and where, who said they're coming,
 * whether you've said it's on, and the two things you do before a ride.
 */
function NextUp({ r, d }: { r: DashboardRide; d: NextDate }) {
  const days = daysUntil(d.date)
  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : dateLabel(d.date)
  // Ride day (RideDay.tsx): here / on the way / going in place of the usual three.
  const rideTime = useRideTime(d.status === 'canceled' ? null : d.date, d.start_time)
  const day = useRideDay(d.id, rideTime)
  const dayOn = day && day !== 'no_meetup' ? day : null
  return (
    <section aria-labelledby="next-up" className="mb-6 overflow-hidden rounded-2xl bg-[#191A2E] text-white">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-center">
        <div className="min-w-0">
          <p id="next-up" className="text-[14px] font-bold text-[#BAF14D]">Next up · {when}</p>
          <Link href={`/organizers/rides/${r.id}`} className="mt-1 block font-display text-[clamp(24px,3vw,30px)] font-extrabold leading-tight hover:underline">
            {r.name}
          </Link>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-white/80">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden />{days <= 1 ? `${dateLabel(d.date)}, ` : ''}{clock(d.start_time)}{d.moved ? ' (changed for this date)' : ''}</span>
            {r.meetup_name && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{r.meetup_name}</span>}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-2">
          {dayOn ? dayOn.tiles.map((x) => (
            <Readout key={x.label} label={x.label} n={<span className={cx(x.lead && x.n > 0 && 'text-[#BAF14D]')}>{x.n}</span>} />
          )) : (
            <>
              <Readout n={d.going} label="Going" />
              <Readout n={d.maybe} label="Maybe" />
              <Readout word label="It’s on?" n={d.confirmed
                ? <span className="inline-flex items-center gap-1 text-[#BAF14D]"><Check className="h-5 w-5" strokeWidth={3} aria-hidden />Yes</span>
                : 'Not yet'} />
            </>
          )}
        </dl>
      </div>
      {dayOn && dayOn.riders.length > 0 && <div className="px-5 pb-3 sm:px-6"><RideDayRiders riders={dayOn.riders} dark /></div>}
      {day === 'no_meetup' && <div className="px-5 pb-4 sm:px-6"><NoMeetupHint dark /></div>}
      <div className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-4 sm:px-6">
        <Link href={`/organizers/rides/${r.id}?post=1`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] bg-[#BAF14D] px-4 text-[15px] font-bold text-[#191A2E] hover:opacity-90">
          <Megaphone className="h-4 w-4" aria-hidden />{d.confirmed ? 'Post an update' : `Say it’s on, or post an update`}
        </Link>
        <Link href={`/organizers/rides/${r.id}/roster?date=${d.id}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-white/30 px-4 text-[15px] font-semibold text-white hover:bg-white/10">
          <Users className="h-4 w-4" aria-hidden />Who&rsquo;s coming
        </Link>
        <Link href={`/organizers/rides/${r.id}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-[10px] px-3 text-[15px] font-semibold text-white/85 hover:bg-white/10">
          Open<ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

/** Whole days from today (Massachusetts) to a YYYY-MM-DD date. */
function daysUntil(date: string): number {
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${todayKey()}T12:00:00Z`)) / 86_400_000)
}

/** The assistant, front and center: say what you need in your own words. */
function AskBox({ rides, canCreate }: { rides: DashboardRide[]; canCreate: boolean }) {
  const [text, setText] = useState('')
  const next = rides.flatMap((r) => r.next_dates.filter((d) => d.status === 'scheduled').map((d) => ({ r, d })))
    .sort((a, b) => a.d.date.localeCompare(b.d.date))[0]
  // What needs doing, most pressing first (Keith 2026-11-06: suggestions come
  // from the organizer's own rides; weather is context the assistant brings
  // up when it matters, not a question to ask it).
  const empty = next && next.d.going + next.d.maybe === 0
  const requests = rides.find((r) => r.open_requests > 0)
  const chips = [
    empty ? `Help me get people to ${next.r.name} on ${dateLabel(next.d.date)}` : null,
    next && !empty ? `Who's coming on ${dateLabel(next.d.date)}, and who's new?` : null,
    requests ? `Go through the credit requests for ${requests.name}` : null,
    rides.length ? 'How many came this month, and how many were new?' : null,
    canCreate ? (rides.length ? 'Plan another ride with me' : 'Plan a new ride with me') : null,
  ].filter(Boolean).slice(0, 3) as string[]
  const go = (t: string) => { if (t.trim()) { openAssistant(t.trim()); setText('') } }
  return (
    <Card className="mb-6 border-(--ev-accent-line-30) bg-white !p-4 sm:!p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-extrabold leading-tight">
          <MessageSquareText className="h-5 w-5 text-(--ev-accent)" aria-hidden />What do you want to get done?
        </h2>
        <p className="text-[14px] text-(--ev-ink-75)">Nothing people see changes without your OK.</p>
      </div>
      <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); go(text) }}>
        <label htmlFor="ask" className="sr-only">Ask the assistant</label>
        <input id="ask" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off"
          placeholder="Plan a Saturday social ride from Davis, move tomorrow to 9:30…"
          className="min-h-[46px] min-w-0 flex-1 rounded-[10px] border border-(--ev-line-strong) bg-white px-3 text-[15px] text-(--ev-ink) placeholder:text-(--ev-ink-60) focus:border-(--ev-accent) focus:outline-none" />
        <button type="submit" aria-label="Ask" disabled={!text.trim()} className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[10px] bg-(--ev-accent-fill) text-(--ev-on-accent-fill) disabled:opacity-40">
          <ArrowUp className="h-5 w-5" aria-hidden />
        </button>
      </form>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <button key={c} type="button" onClick={() => go(c)}
              className={cx(i > 0 && 'hidden sm:block', 'min-h-[38px] rounded-full border border-(--ev-accent-line-40) bg-(--ev-accent-tint-8) px-3.5 text-left text-[14px] font-semibold text-(--ev-accent-90) hover:border-(--ev-accent)')}>
              {c}
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

type ListTab = 'coming' | 'past' | 'all'

export default function Dashboard() {
  const { me, assistant } = useConsole()
  const [rides, setRides] = useState<DashboardRide[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<ListTab>('coming')
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
    const changed = () => { void load() }
    window.addEventListener(ASSISTANT_CHANGED_EVENT, changed)
    return () => { live = false; window.removeEventListener(ASSISTANT_CHANGED_EVENT, changed) }
  }, [load])

  const groups = useMemo(() => {
    const all = rides ?? []
    const today = todayKey()
    // A one-off ride whose day has gone is history, with ended rides.
    const over = (r: DashboardRide) => r.status === 'archived' || (!!r.ride_date && r.ride_date < today && r.next_dates.length === 0)
    const mine = all.filter((r) => r.my_role !== 'admin' && !over(r))
    // Soonest first, so the list reads in the order you'll ride them.
    const soonest = (r: DashboardRide) => r.next_dates.find((d) => d.status === 'scheduled')?.date ?? '9999'
    mine.sort((a, b) => soonest(a).localeCompare(soonest(b)))
    const next = mine.flatMap((r) => r.next_dates.filter((d) => d.status === 'scheduled').map((d) => ({ r, d })))
      .sort((a, b) => a.d.date.localeCompare(b.d.date) || a.d.start_time.localeCompare(b.d.start_time))[0] ?? null
    return {
      mine,
      next,
      others: all.filter((r) => r.my_role === 'admin' && !over(r)),
      ended: all.filter((r) => r.my_role !== 'admin' && over(r)),
    }
  }, [rides])

  const newRide = me?.can_create ? (
    <Link href="/organizers/rides/new" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill) hover:opacity-90">
      <Plus className="h-4 w-4" aria-hidden />New ride
    </Link>
  ) : null

  const tabs: { id: ListTab; label: string; count?: number }[] = [
    { id: 'coming', label: 'Coming up', count: groups.mine.length },
    ...(groups.ended.length ? [{ id: 'past' as const, label: 'Past', count: groups.ended.length }] : []),
    ...(groups.others.length ? [{ id: 'all' as const, label: 'Every ride on Shift', count: groups.others.length }] : []),
  ]
  const shown = tabs.some((t) => t.id === tab) ? tab : 'coming'
  const list = shown === 'past' ? groups.ended : shown === 'all' ? groups.others : groups.mine
  const nothingAtAll = rides && groups.mine.length + groups.others.length + groups.ended.length === 0

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-(--ev-ink-75)">{me?.first_name ? `Hi, ${me.first_name}` : 'Welcome'}</p>
          <h1 className="font-display text-[clamp(28px,3.6vw,38px)] font-extrabold leading-tight">Your rides</h1>
        </div>
        {newRide}
      </div>

      {claimNote > 0 && (
        <div className="mb-5">
          <Notice tone="good" onClose={() => setClaimNote(0)}>
            You&rsquo;re now a leader on {plural(claimNote, 'ride')}. It&rsquo;s below, and in the Shift app too.
          </Notice>
        </div>
      )}

      {err && (
        <div className="mb-5"><Notice tone="off">{err} <button type="button" className="font-semibold underline" onClick={() => void load()}>Try again</button></Notice></div>
      )}

      {!rides && !err && <Spinner label="Loading your rides" />}

      {groups.next && <NextUp r={groups.next.r} d={groups.next.d} />}

      {assistant && rides && <AskBox rides={groups.mine} canCreate={!!me?.can_create} />}

      {nothingAtAll && (
        <Empty title={me?.can_create ? 'Set up your first ride' : 'No rides yet'} action={newRide}>
          {me?.can_create
            ? 'A one-off ride or a regular one, with a meeting point and a route. You get a ride page to share, and everyone who answers lands on your list.'
            : 'When an organizer adds you as a leader, their ride shows up here.'}
        </Empty>
      )}

      {rides && !nothingAtAll && (
        <section aria-label="Rides">
          <Tabs tabs={tabs} value={shown} onChange={setTab} label="Which rides" prefix="rides" />
          <div {...tabPanel('rides', shown)} className="pt-4">
            {shown === 'all' && <p className="mb-3 text-[14px] text-(--ev-ink-75)">Every group ride on Shift. You see these as a GSI admin.</p>}
            {list.length > 0 ? (
              <ul className="space-y-3">{list.map((r) => <RideRow key={r.id} r={r} />)}</ul>
            ) : (
              <Empty title="Nothing coming up" action={newRide}>
                {me?.can_create ? 'Set up the next one: a one-off or a regular ride, with its own page to share.' : 'When an organizer adds you as a leader, their ride shows up here.'}
              </Empty>
            )}
          </div>
        </section>
      )}

      {rides && <div className="mt-8"><FeedbackDueCard /></div>}
      {rides && <FeedbackLink />}
    </div>
  )
}
