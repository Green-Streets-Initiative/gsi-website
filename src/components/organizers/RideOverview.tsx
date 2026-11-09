'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarX, Check, Copy, PauseCircle, PlayCircle, Route as RouteIcon } from 'lucide-react'
import { ago, clock } from '@/lib/rides/public'
import { errorText, setDateCanceled } from '@/lib/organizers/api'
import { UPDATE_KIND_LABEL, dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import type { DetailDate } from '@/lib/organizers/types'
import { CancelDateDialog, ChangeDateDialog } from './DateDialogs'
import PostUpdate from './PostUpdate'
import { NoMeetupHint, RideDayRiders, useRideDay, useRideTime } from './RideDay'
import { ridePageUrl, useRide } from './RideFrame'
import { SkipDatesDialog } from './SkipDates'
import { StopRideDialog, resume } from './StopRide'
import { Badge, Button, Card, Empty, Notice, SectionTitle, Tabs, Toast, copyText, cx, tabPanel } from './ui'

function ShareCard({ code, fresh, rideId, walk = false }: { code: string; fresh: boolean; rideId: string; walk?: boolean }) {
  const url = ridePageUrl(code)
  const [copied, setCopied] = useState(false)
  return (
    <Card className={cx(fresh && 'border-(--ev-accent-line) ring-1 ring-(--ev-accent-line-30)')}>
      <SectionTitle hint="Anyone can answer Going there, with or without the app.">
        {fresh ? `Your ${walk ? 'walk' : 'ride'} is set up. Share its page` : `Share the ${walk ? 'walk' : 'ride'}`}
      </SectionTitle>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-[10px] border border-(--ev-line-mid) bg-(--ev-panel-faint) px-3 py-2.5 text-[14px] text-(--ev-ink)">{url}</code>
        <Button onClick={async () => { if (await copyText(url)) { setCopied(true); setTimeout(() => setCopied(false), 2200) } }}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      <p className="mt-3 text-[14px] text-(--ev-ink-75)">
        Captions, a flyer QR and calendar listings are ready in <Link href={`/organizers/rides/${rideId}/promote`} className="font-semibold text-(--ev-ink) underline">Promote</Link>.
      </p>
    </Card>
  )
}

/** What this date rides: its own route (Shift 01432), the usual one, or none. */
function RouteChip({ d, usualMiles, hasUsual }: { d: DetailDate; usualMiles: number | null; hasUsual: boolean }) {
  const miles = d.own_route ? d.route?.route_miles ?? null : usualMiles
  const text = d.own_route ? 'Its own route' : hasUsual ? 'Usual route' : 'No route yet'
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[13px] font-semibold',
      d.own_route ? 'border-(--ev-accent-line) bg-(--ev-panel) text-(--ev-ink)' : 'border-(--ev-line-mid) text-(--ev-ink-75)')}>
      <RouteIcon className="h-3.5 w-3.5" aria-hidden />{text}{miles != null && miles > 0 ? ` · ${miles.toFixed(1)} mi` : ''}
    </span>
  )
}

function DateRow({ d, canManage, canEdit, rideId, usualMiles, hasUsual, onCancel, onChange, onRestore }: {
  d: DetailDate; canManage: boolean; canEdit: boolean; rideId: string; usualMiles: number | null; hasUsual: boolean
  onCancel: () => void; onChange: () => void; onRestore: () => void
}) {
  const off = d.status === 'canceled'
  const past = d.date < todayKey()
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--ev-line) py-3 last:border-0">
      <div className="min-w-[150px]">
        <p className={cx('text-[15px] font-bold', off ? 'text-(--ev-ink-75) line-through' : 'text-(--ev-ink)')}>{dateLabel(d.date)}</p>
        {d.title && <p className="text-[15px] font-semibold text-(--ev-ink-85)">{d.title}</p>}
        <p className="text-[14px] text-(--ev-ink-75)">
          {clock(d.start_time)}{d.time_moved ? ' (moved)' : ''}
          {d.place_moved && d.meetup_name ? ` · ${d.meetup_name} (moved)` : ''}
        </p>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {off ? <Badge tone="off">{d.canceled_by_stop ? 'Off for the break' : 'Cancelled'}</Badge> : (
          <>
            <span className="text-[14px] font-semibold text-(--ev-ink-85)">
              {past ? `${d.attended} came` : `${d.going} going`}
              {!past && d.maybe > 0 ? ` · ${d.maybe} maybe` : ''}
              {!past && d.cant > 0 ? ` · ${d.cant} can't` : ''}
            </span>
            {d.own_route && <RouteChip d={d} usualMiles={usualMiles} hasUsual={hasUsual} />}
            {!past && d.confirmed && <Badge tone="good">It&rsquo;s on</Badge>}
            {d.requests > 0 && <Badge tone="warn">{plural(d.requests, 'request')}</Badge>}
          </>
        )}
      </div>
      {/* Pulled left by the buttons' own padding so the labels line up with the
          date, with tighter padding so all four fit on one line at phone width. */}
      <div className="-ml-2 flex flex-wrap">
        {!off && (
          <Link href={`/organizers/rides/${rideId}/roster?date=${d.id}`} className="inline-flex min-h-[36px] items-center rounded-[10px] px-2 text-[14px] font-semibold text-(--ev-ink-85) hover:bg-(--ev-panel)">
            {past ? 'Who came' : "Who's coming"}
          </Link>
        )}
        {canEdit && !past && !off && (
          <Link href={`/organizers/rides/${rideId}/dates/${d.id}`} className="inline-flex min-h-[36px] items-center rounded-[10px] px-2 text-[14px] font-semibold text-(--ev-ink-85) hover:bg-(--ev-panel)">
            Plan
          </Link>
        )}
        {canManage && !past && !off && <Button size="sm" variant="ghost" className="px-2!" onClick={onChange}>Change</Button>}
        {canManage && !past && !off && <Button size="sm" variant="ghost" className="px-2!" onClick={onCancel}>Cancel</Button>}
        {canManage && !past && off && !d.canceled_by_stop && <Button size="sm" variant="ghost" className="px-2!" onClick={onRestore}>Bring back</Button>}
      </div>
    </li>
  )
}

export default function RideOverview() {
  const { detail, reload } = useRide()
  const params = useSearchParams()
  const router = useRouter()
  const r = detail.ride
  const today = todayKey()
  const [msg, setMsg] = useState<{ tone: 'good' | 'off'; text: string } | null>(
    params.get('saved') === 'date' ? { tone: 'good', text: 'Saved. The ride page shows that date\u2019s plan.' }
      : params.get('saved') ? { tone: 'good', text: 'Saved. The ride page and the app show your changes.' } : null,
  )
  const [cancelling, setCancelling] = useState<DetailDate | null>(null)
  const [changing, setChanging] = useState<DetailDate | null>(null)
  const [stopping, setStopping] = useState(false)
  const [tab, setTab] = useState<'dates' | 'updates' | 'past'>(() => (r.status === 'archived' ? 'past' : 'dates'))
  const [busy, setBusy] = useState(false)
  const [posting, setPosting] = useState(!!params.get('post'))
  const [skipping, setSkipping] = useState(false)
  // Just back from a break: offer the "it's back" note, ready to send.
  const [backOffer, setBackOffer] = useState(false)

  const upcoming = useMemo(() => detail.occurrences.filter((d) => d.date >= today), [detail.occurrences, today])
  const past = useMemo(() => detail.occurrences.filter((d) => d.date < today).reverse(), [detail.occurrences, today])
  const ended = r.status === 'archived'
  const nextDate = upcoming.find((d) => d.status === 'scheduled') ?? null
  const onBreak = !!r.break_until && r.break_until > today
  const hasUsual = (r.route_waypoints?.length ?? 0) >= 2 || !!r.route_google_maps_url

  const closeMsg = useCallback(() => {
    setMsg(null)
    if (params.get('saved') || params.get('created')) router.replace(`/organizers/rides/${r.id}`, { scroll: false })
  }, [params, router, r.id])

  // Arriving from the editor: start at the top.
  useEffect(() => { if (params.get('saved') || params.get('created')) window.scrollTo(0, 0) }, [params])

  const done = (text: string) => {
    setMsg({ tone: 'good', text })
    setCancelling(null)
    setChanging(null)
    setStopping(false)
    setSkipping(false)
    void reload()
  }

  async function restore(d: DetailDate) {
    try {
      await setDateCanceled(d.id, false)
      done(`${dateLabel(d.date)} is back on the schedule.`)
    } catch (e) {
      setMsg({ tone: 'off', text: errorText(e) })
    }
  }

  async function doResume() {
    setBusy(true)
    try {
      done(await resume(r.id))
      // Nobody else on the ride: nobody to tell.
      if (detail.members > 0) setBackOffer(true)
    } catch (e) { setMsg({ tone: 'off', text: errorText(e) }) } finally { setBusy(false) }
  }

  // The weather for the next date, by the same rule as the evening check-in
  // push (lib/rides/forecast.ts), once it's within the weather service's week.
  const [nextForecast, setNextForecast] = useState<string | null>(null)
  useEffect(() => {
    setNextForecast(null)
    const d = nextDate
    const lat = d?.meetup_lat ?? r.meetup_lat
    const lng = d?.meetup_lng ?? r.meetup_lng
    if (!d || lat == null || lng == null) return
    const days = (new Date(`${d.date}T12:00:00Z`).getTime() - Date.now()) / 864e5
    if (days < -1 || days > 6.5) return
    let live = true
    const q = new URLSearchParams({ lat: String(lat), lng: String(lng), date: d.date, start: d.start_time })
    fetch(`/api/rides/forecast?${q}`).then((res) => res.json()).then((j: { line?: string | null }) => { if (live && j.line) setNextForecast(j.line) }).catch(() => {})
    return () => { live = false }
  }, [nextDate?.id, nextDate?.date, nextDate?.start_time, r.meetup_lat, r.meetup_lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ride day: from 30 minutes before the start to 15 after, the card's
  // numbers become here / on the way / going (RideDay.tsx, the app's
  // RideDayCounts).
  const rideTime = useRideTime(nextDate?.date ?? null, nextDate?.start_time ?? null) && !ended
  const day = useRideDay(nextDate?.id ?? null, rideTime)
  const dayOn = day && day !== 'no_meetup' ? day : null

  // The next date has its own card above; the list holds the rest.
  const heroShown = !!nextDate && !ended
  const later = heroShown ? upcoming.filter((d) => d.id !== nextDate!.id) : upcoming
  // An ended ride opens on its history (the tab's starting value).
  const shownTab = tab === 'past' && !past.length ? 'dates' : tab

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {msg && <Toast tone={msg.tone} onClose={closeMsg}>{msg.text}</Toast>}

      {(params.get('created') || detail.updates.length === 0) && !ended && <ShareCard code={r.invite_code} fresh={!!params.get('created')} rideId={r.id} walk={r.activity === 'walk'} />}

      {nextDate && !ended && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold text-(--ev-ink-75)">{rideTime ? 'Today' : r.activity === 'walk' ? 'Next walk' : 'Next ride'}</p>
              <p className="font-display text-[26px] font-extrabold leading-tight">{rideTime ? clock(nextDate.start_time) : `${dateLabel(nextDate.date)} · ${clock(nextDate.start_time)}`}</p>
              {nextDate.time_moved && <p className="text-[14px] font-semibold text-(--ev-ink-75)">Time changed for this date</p>}
              {nextDate.title && <p className="mt-0.5 text-[17px] font-bold text-(--ev-ink)">{nextDate.title}</p>}
              <p className="mt-0.5 text-[15px] text-(--ev-ink-80)">{nextDate.meetup_name ?? r.meetup_name}{nextDate.place_moved ? ' (changed for this date)' : ''}</p>
              <span className="mt-2 inline-block"><RouteChip d={nextDate} usualMiles={r.route_miles} hasUsual={hasUsual} /></span>
              {nextForecast && <p className="mt-0.5 text-[15px] text-(--ev-ink-80)">Forecast: {nextForecast}</p>}
              {nextDate.confirmed && <span className="mt-2 inline-block"><Badge tone="good">It&rsquo;s on</Badge></span>}
            </div>
            <dl className="flex gap-6">
              {(dayOn ? dayOn.tiles.map((x) => [x.label, x.n, x.lead] as const)
                : ([['Going', nextDate.going, false], ['Maybe', nextDate.maybe, false], ["Can't go", nextDate.cant, false]] as const)).map(([k, v, lead]) => (
                <div key={k}>
                  <dt className="text-[14px] font-semibold text-(--ev-ink-75)">{k}</dt>
                  <dd className={cx('font-display text-[32px] font-extrabold leading-none', lead && v > 0 && 'text-(--ev-accent-90)')}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {dayOn && dayOn.riders.length > 0 && <div className="mt-4"><RideDayRiders riders={dayOn.riders} /></div>}
          {day === 'no_meetup' && <div className="mt-3"><NoMeetupHint /></div>}
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.can_edit && (
              <Link href={`/organizers/rides/${r.id}/dates/${nextDate.id}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                <RouteIcon className="h-4 w-4" aria-hidden />{r.activity === 'walk' ? 'Plan this walk' : 'Plan this ride'}
              </Link>
            )}
            <Button variant="primary" onClick={() => setPosting(true)}>Post an update</Button>
            <Link href={`/organizers/rides/${r.id}/roster?date=${nextDate.id}`} className="inline-flex min-h-[44px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
              See who&rsquo;s coming
            </Link>
            {detail.can_manage && (
              <>
                <Button variant="ghost" onClick={() => setChanging(nextDate)}>Change</Button>
                <Button variant="ghost" onClick={() => setCancelling(nextDate)}>Cancel this date</Button>
              </>
            )}
          </div>
        </Card>
      )}

      {backOffer && !ended && (
        <Card className="border-(--ev-accent-line) ring-1 ring-(--ev-accent-line-30)">
          <SectionTitle hint="Edit it if you like. It goes to everyone on the ride, by app or email."
            action={<Button size="sm" variant="ghost" onClick={() => setBackOffer(false)}>Not now</Button>}>
            Tell everyone it&rsquo;s back?
          </SectionTitle>
          {/* Keyed on the next date so the note names it once the dates reload. */}
          <PostUpdate key={nextDate?.id ?? 'none'} seriesId={r.id} dates={detail.occurrences} initialKind="note"
            initialNote={nextDate ? `We're back! Next ride: ${dateLabel(nextDate.date)} at ${clock(nextDate.start_time)}${nextDate.meetup_name ?? r.meetup_name ? `, ${nextDate.meetup_name ?? r.meetup_name}` : ''}. See you there.` : "We're back! Watch for the next date."}
            onPosted={() => { setBackOffer(false); void reload() }} />
        </Card>
      )}

      {/* The update box only when there's someone to tell: with no open date,
          a ride nobody else is on has no one to post to. */}
      {!ended && !backOffer && (posting || (!nextDate && detail.members > 0)) && (
        <Card id="post-update">
          <SectionTitle hint="One message to everyone on the ride, by app or email.">Post an update</SectionTitle>
          <PostUpdate seriesId={r.id} dates={detail.occurrences} onPosted={() => void reload()} autoFocus={posting} />
        </Card>
      )}

      {/* Dates, updates and history behind tabs, so the first screen shows all three are here. */}
      <Card className="!pt-2 sm:!pt-3">
        <Tabs tabs={[
          { id: 'dates' as const, label: heroShown ? 'Later dates' : 'Dates', count: later.length },
          { id: 'updates' as const, label: 'Updates', count: detail.updates.length },
          ...(past.length ? [{ id: 'past' as const, label: 'Past dates', count: past.length }] : []),
        ]} value={shownTab} onChange={setTab} label="Dates and updates" prefix="ride" className="-mx-5 px-3 sm:-mx-6 sm:px-4" />
        <div {...tabPanel('ride', shownTab)} className="pt-4">
          {shownTab === 'dates' && (
            <>
              {detail.can_manage && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] text-(--ev-ink-75)">{ended ? 'This ride has ended.' : 'Plan, change or cancel one date; the rest stays as it is.'}</p>
                  {!ended ? (
                    <div className="flex flex-wrap gap-1.5">
                      {/* Skip dates beyond the ones listed: writes the ride itself, so its organizer only. */}
                      {detail.my_role === 'organizer' && !r.ride_date && (
                        <Button size="sm" variant="ghost" onClick={() => setSkipping(true)}><CalendarX className="h-4 w-4" aria-hidden />Skip dates further out</Button>
                      )}
                      {onBreak
                        ? <Button size="sm" onClick={() => void doResume()} busy={busy}><PlayCircle className="h-4 w-4" aria-hidden />End the break now</Button>
                        : <Button size="sm" variant="ghost" onClick={() => setStopping(true)}><PauseCircle className="h-4 w-4" aria-hidden />Pause or end</Button>}
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => void doResume()} busy={busy}><PlayCircle className="h-4 w-4" aria-hidden />Start it again</Button>
                  )}
                </div>
              )}
              {onBreak && <div className="mb-3"><Notice tone="warn">On a break until {dateLabel(r.break_until!)}.{r.stopped_note ? ` “${r.stopped_note}”` : ''}</Notice></div>}
              {heroShown && later.length === 0 ? (
                <p className="text-[15px] text-(--ev-ink-85)">No later dates yet.</p>
              ) : later.length === 0 ? (
                <Empty title={ended ? 'This ride has ended' : 'No upcoming dates'}>
                  {ended ? 'Its history and turnout are under Past dates.' : r.ride_date ? 'This one-off ride has happened. Set up a new ride for the next one.' : 'No upcoming dates. Check When and the season dates in Edit ride.'}
                </Empty>
              ) : (
                <ul>
                  {later.map((d) => (
                    <DateRow key={d.id} d={d} canManage={detail.can_manage} canEdit={detail.can_edit} rideId={r.id} usualMiles={r.route_miles} hasUsual={hasUsual}
                      onCancel={() => setCancelling(d)} onChange={() => setChanging(d)} onRestore={() => void restore(d)} />
                  ))}
                </ul>
              )}
            </>
          )}

          {shownTab === 'past' && (
            <ul>{past.map((d) => <DateRow key={d.id} d={d} canManage={false} canEdit={false} rideId={r.id} usualMiles={r.route_miles} hasUsual={hasUsual} onCancel={() => {}} onChange={() => {}} onRestore={() => {}} />)}</ul>
          )}

          {shownTab === 'updates' && (detail.updates.length === 0 ? (
            <p className="text-[15px] text-(--ev-ink-80)">Nothing posted yet. Updates show here, on the ride page and in the app.</p>
          ) : (
            <ul className="space-y-3">
              {detail.updates.map((u) => {
                const d = detail.occurrences.find((o) => o.id === u.occurrence_id)
                return (
                  <li key={u.id} className="rounded-xl border border-(--ev-line) px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[15px] font-semibold text-(--ev-ink)">
                        {UPDATE_KIND_LABEL[u.kind] ?? u.title}{d ? ` · ${dateLabel(d.date)}` : ''}
                      </p>
                      <p className="text-[14px] text-(--ev-ink-75)">{ago(u.created_at)}{u.by ? ` · ${u.by}` : ''}</p>
                    </div>
                    {u.body && <p className="mt-1 text-[14px] text-(--ev-ink-80)">{u.body}</p>}
                    {u.note && <p className="mt-1.5 border-l-2 border-(--ev-accent-line) pl-3 text-[14px] text-(--ev-ink-85)">{u.note}</p>}
                    <p className="mt-1.5 text-[14px] text-(--ev-ink-75)">
                      Sent to {plural(u.recipients, 'person', 'people')}
                      {u.push_sent || u.email_sent ? ` (${[u.push_sent ? `${u.push_sent} app` : '', u.email_sent ? `${u.email_sent} email` : ''].filter(Boolean).join(', ')})` : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          ))}
        </div>
      </Card>

      {cancelling && <CancelDateDialog key={cancelling.id} date={cancelling} onClose={() => setCancelling(null)} onDone={done} />}
      {changing && <ChangeDateDialog key={changing.id} date={changing} ride={r} onClose={() => setChanging(null)} onDone={done} />}
      {detail.can_manage && <StopRideDialog ride={r} open={stopping} onClose={() => setStopping(false)} onDone={done} />}
      {skipping && <SkipDatesDialog ride={r} dates={detail.occurrences} open={skipping} onClose={() => setSkipping(false)} onDone={done} />}
    </div>
  )
}
