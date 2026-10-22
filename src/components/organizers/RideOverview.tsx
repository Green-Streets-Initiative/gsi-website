'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Check, Copy, PauseCircle, PlayCircle } from 'lucide-react'
import { ago, clock } from '@/lib/rides/public'
import { errorText, setDateCanceled } from '@/lib/organizers/api'
import { UPDATE_KIND_LABEL, dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import type { DetailDate } from '@/lib/organizers/types'
import { CancelDateDialog, ChangeDateDialog } from './DateDialogs'
import PostUpdate from './PostUpdate'
import { ridePageUrl, useRide } from './RideFrame'
import { StopRideDialog, resume } from './StopRide'
import { Badge, Button, Card, Empty, Notice, SectionTitle, copyText, cx } from './ui'

function ShareCard({ code, fresh }: { code: string; fresh: boolean }) {
  const url = ridePageUrl(code)
  const [copied, setCopied] = useState(false)
  return (
    <Card className={cx(fresh && 'border-(--ev-accent-line) ring-1 ring-(--ev-accent-line-30)')}>
      <SectionTitle hint="Put it in your Instagram bio, group chat or flyer. Anyone can say they're going, with or without the app.">
        {fresh ? 'Your ride is set up. Share its page' : 'Share the ride'}
      </SectionTitle>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-[10px] border border-(--ev-line-mid) bg-(--ev-panel-faint) px-3 py-2.5 text-[14px] text-(--ev-ink)">{url}</code>
        <Button onClick={async () => { if (await copyText(url)) { setCopied(true); setTimeout(() => setCopied(false), 2200) } }}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      <p className="mt-2 text-[13px] text-(--ev-ink-75)">In the Shift app, people can also join with the code <b className="tracking-wider text-(--ev-ink)">{code}</b>.</p>
    </Card>
  )
}

function DateRow({ d, canManage, rideId, onCancel, onChange, onRestore }: {
  d: DetailDate; canManage: boolean; rideId: string
  onCancel: () => void; onChange: () => void; onRestore: () => void
}) {
  const off = d.status === 'canceled'
  const past = d.date < todayKey()
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--ev-line) py-3 last:border-0">
      <div className="min-w-[150px]">
        <p className={cx('text-[15px] font-bold', off ? 'text-(--ev-ink-75) line-through' : 'text-(--ev-ink)')}>{dateLabel(d.date)}</p>
        <p className="text-[13px] text-(--ev-ink-75)">
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
            {!past && d.confirmed && <Badge tone="good">It&rsquo;s on</Badge>}
            {d.requests > 0 && <Badge tone="warn">{plural(d.requests, 'request')}</Badge>}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link href={`/organizers/rides/${rideId}/roster?date=${d.id}`} className="inline-flex min-h-[36px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-3 text-[13px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
          {past ? 'Who came' : "Who's coming"}
        </Link>
        {canManage && !past && !off && <Button size="sm" variant="ghost" onClick={onChange}>Change</Button>}
        {canManage && !past && !off && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        {canManage && !past && off && !d.canceled_by_stop && <Button size="sm" variant="ghost" onClick={onRestore}>Bring back</Button>}
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
    params.get('saved') ? { tone: 'good', text: 'Saved. The ride page and the app show your changes.' } : null,
  )
  const [cancelling, setCancelling] = useState<DetailDate | null>(null)
  const [changing, setChanging] = useState<DetailDate | null>(null)
  const [stopping, setStopping] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [busy, setBusy] = useState(false)

  const upcoming = useMemo(() => detail.occurrences.filter((d) => d.date >= today), [detail.occurrences, today])
  const past = useMemo(() => detail.occurrences.filter((d) => d.date < today).reverse(), [detail.occurrences, today])
  const ended = r.status === 'archived'
  const onBreak = !!r.break_until && r.break_until > today

  const done = (text: string) => {
    setMsg({ tone: 'good', text })
    setCancelling(null)
    setChanging(null)
    setStopping(false)
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
    try { done(await resume(r.id)) } catch (e) { setMsg({ tone: 'off', text: errorText(e) }) } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-5">
      {msg && <Notice tone={msg.tone} onClose={() => { setMsg(null); if (params.get('saved') || params.get('created')) router.replace(`/organizers/rides/${r.id}`) }}>{msg.text}</Notice>}
      {r.route_risk === 'high' && r.visibility === 'public' && (
        <Notice tone="warn">Part of this route has a crash history, so GSI reviews it before it goes on the public calendar. Your ride page works now.</Notice>
      )}

      {(params.get('created') || detail.updates.length === 0) && !ended && <ShareCard code={r.invite_code} fresh={!!params.get('created')} />}

      {!ended && (
        <Card>
          <SectionTitle hint="One message, and everyone on the ride hears it: in the app, by email for people who answered on the ride page, and on the page itself.">
            Post an update
          </SectionTitle>
          <PostUpdate seriesId={r.id} dates={detail.occurrences} onPosted={() => void reload()} autoFocus={!!params.get('post')} />
        </Card>
      )}

      <Card>
        <SectionTitle
          hint={detail.can_manage ? 'Change or cancel a single date here; the rest of the ride stays as it is.' : undefined}
          action={detail.can_manage && !ended ? (
            onBreak
              ? <Button size="sm" onClick={() => void doResume()} busy={busy}><PlayCircle className="h-4 w-4" aria-hidden />End the break now</Button>
              : <Button size="sm" variant="ghost" onClick={() => setStopping(true)}><PauseCircle className="h-4 w-4" aria-hidden />Pause or end</Button>
          ) : ended && detail.can_manage ? (
            <Button size="sm" onClick={() => void doResume()} busy={busy}><PlayCircle className="h-4 w-4" aria-hidden />Start it again</Button>
          ) : undefined}
        >
          Dates
        </SectionTitle>
        {onBreak && <div className="mb-3"><Notice tone="warn">On a break until {dateLabel(r.break_until!)}.{r.stopped_note ? ` “${r.stopped_note}”` : ''}</Notice></div>}
        {upcoming.length === 0 ? (
          <Empty title={ended ? 'This ride has ended' : 'No upcoming dates'}>
            {ended ? 'Its history and turnout are still here.' : r.ride_date ? 'This one-off ride has happened. Set up a new ride for the next one.' : "Dates appear here within a day of saving. If it's been longer, check the season dates in Edit ride."}
          </Empty>
        ) : (
          <ul>
            {upcoming.map((d) => (
              <DateRow key={d.id} d={d} canManage={detail.can_manage} rideId={r.id}
                onCancel={() => setCancelling(d)} onChange={() => setChanging(d)} onRestore={() => void restore(d)} />
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <div className="mt-3">
            <Button size="sm" variant="ghost" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
              {showPast ? 'Hide' : 'Show'} the last {plural(past.length, 'date')}
            </Button>
            {showPast && <ul className="mt-2">{past.map((d) => <DateRow key={d.id} d={d} canManage={false} rideId={r.id} onCancel={() => {}} onChange={() => {}} onRestore={() => {}} />)}</ul>}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Updates</SectionTitle>
        {detail.updates.length === 0 ? (
          <p className="text-[14px] text-(--ev-ink-75)">Nothing posted yet. Updates show here, on the ride page and in the app.</p>
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
                    <p className="text-[13px] text-(--ev-ink-75)">{ago(u.created_at)}{u.by ? ` · ${u.by}` : ''}</p>
                  </div>
                  {u.body && <p className="mt-1 text-[14px] text-(--ev-ink-80)">{u.body}</p>}
                  {u.note && <p className="mt-1.5 border-l-2 border-(--ev-accent-line) pl-3 text-[14px] text-(--ev-ink-85)">{u.note}</p>}
                  <p className="mt-1.5 text-[13px] text-(--ev-ink-75)">
                    Sent to {plural(u.recipients, 'person', 'people')}
                    {u.push_sent || u.email_sent ? ` (${[u.push_sent ? `${u.push_sent} app` : '', u.email_sent ? `${u.email_sent} email` : ''].filter(Boolean).join(', ')})` : ''}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {!params.get('created') && detail.updates.length > 0 && !ended && <ShareCard code={r.invite_code} fresh={false} />}

      {cancelling && <CancelDateDialog key={cancelling.id} date={cancelling} onClose={() => setCancelling(null)} onDone={done} />}
      {changing && <ChangeDateDialog key={changing.id} date={changing} ride={r} onClose={() => setChanging(null)} onDone={done} />}
      {detail.can_manage && <StopRideDialog ride={r} open={stopping} onClose={() => setStopping(false)} onDone={done} />}
    </div>
  )
}
