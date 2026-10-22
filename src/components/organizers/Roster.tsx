'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { clock } from '@/lib/rides/public'
import { errorText, getCreditRequests, getRoster, settleCredit } from '@/lib/organizers/api'
import { dateLabel, plural, todayKey } from '@/lib/organizers/ride-words'
import type { CreditRequest, RosterRow } from '@/lib/organizers/types'
import { useRide } from './RideFrame'
import { Badge, Button, Card, Empty, Field, Notice, SectionTitle, Select, Spinner, cx } from './ui'

const GROUPS: { key: 'going' | 'maybe' | 'none' | 'not_going'; label: string }[] = [
  { key: 'going', label: 'Going' },
  { key: 'maybe', label: 'Maybe' },
  { key: 'none', label: 'On the ride, no answer yet' },
  { key: 'not_going', label: "Can't go" },
]

function Person({ p, past }: { p: RosterRow; past: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-[14px] font-bold text-(--ev-ink-85)" aria-hidden>
        {p.display_name.slice(0, 1).toUpperCase()}
      </span>
      <span className="text-[15px] font-semibold text-(--ev-ink)">{p.display_name}{p.is_you ? ' (you)' : ''}</span>
      <span className="flex flex-wrap gap-1">
        {p.role === 'organizer' && <Badge>Organizer</Badge>}
        {p.role === 'leader' && <Badge>Co-organizer</Badge>}
        {p.is_guest && <Badge tone="info">Ride page</Badge>}
        {p.kids_count > 0 && <Badge>+{plural(p.kids_count, 'kid')}</Badge>}
        {p.first_time && p.role === 'rider' && <Badge tone="good">First time</Badge>}
        {past && p.attended && <Badge tone="good"><Check className="h-3 w-3" aria-hidden />Came</Badge>}
        {past && p.pending_state === 'claimed' && <Badge tone="warn">Asked for credit</Badge>}
      </span>
    </li>
  )
}

export default function Roster() {
  const { detail, reload } = useRide()
  const params = useSearchParams()
  const router = useRouter()
  const today = todayKey()
  const dates = detail.occurrences
  const defaultId = useMemo(() => {
    const asked = params.get('date')
    if (asked && dates.some((d) => d.id === asked)) return asked
    const withRequests = dates.find((d) => d.requests > 0)
    return (withRequests ?? dates.find((d) => d.date >= today && d.status === 'scheduled') ?? dates[dates.length - 1])?.id ?? ''
  }, [params, dates, today])
  const [dateId, setDateId] = useState(defaultId)
  const [rows, setRows] = useState<RosterRow[] | null>(null)
  const [requests, setRequests] = useState<CreditRequest[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [settling, setSettling] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const date = dates.find((d) => d.id === dateId) ?? null
  const past = !!date && date.date < today
  const canReview = detail.my_role === 'organizer' || detail.my_role === 'admin'

  const load = useCallback(async () => {
    if (!dateId) return
    setErr(null)
    setRows(null)
    try {
      const [r, q] = await Promise.all([
        getRoster(dateId),
        canReview ? getCreditRequests(dateId).catch(() => []) : Promise.resolve([] as CreditRequest[]),
      ])
      setRows(r)
      setRequests(q)
    } catch (e) {
      setErr(errorText(e, "We couldn't load who's coming."))
    }
  }, [dateId, canReview])
  useEffect(() => { void load() }, [load])

  const pick = (id: string) => {
    setDateId(id)
    setMsg(null)
    router.replace(`/organizers/rides/${detail.ride.id}/roster?date=${id}`, { scroll: false })
  }

  async function settle(memberId: string, approve: boolean) {
    setSettling(memberId)
    try {
      const r = await settleCredit(dateId, memberId, approve)
      setMsg(r.ok ? (approve ? 'Approved. They get credit for the ride.' : 'Declined.') : 'That request was already settled.')
      await load()
      void reload()
    } catch (e) {
      setMsg(errorText(e))
    } finally {
      setSettling(null)
    }
  }

  const grouped = useMemo(() => {
    const g: Record<string, RosterRow[]> = { going: [], maybe: [], none: [], not_going: [] }
    for (const p of rows ?? []) {
      if (!p.rsvp_status && p.role !== 'rider') continue // the people running it
      g[p.rsvp_status ?? 'none'].push(p)
    }
    return g
  }, [rows])
  const came = (rows ?? []).filter((p) => p.attended)
  const guests = (rows ?? []).filter((p) => p.is_guest).length

  if (dates.length === 0) {
    return <Empty title="No dates yet">Dates appear here within a day of saving the ride.</Empty>
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Field label="Date" htmlFor="roster-date">
            <Select id="roster-date" value={dateId} onChange={(e) => pick(e.target.value)} className="min-w-[240px]">
              {dates.map((d) => (
                <option key={d.id} value={d.id}>
                  {dateLabel(d.date)} · {clock(d.start_time)}{d.status === 'canceled' ? ' · cancelled' : ''}{d.requests ? ` · ${plural(d.requests, 'request')}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          {date && (
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {(past ? [['Came', came.length]] : [['Going', date.going], ['Maybe', date.maybe], ["Can't go", date.cant]]).map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-[14px] font-semibold text-(--ev-ink-75)">{k}</dt>
                  <dd className="font-display text-[26px] font-extrabold leading-none text-(--ev-ink)">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {date?.status === 'canceled' && <div className="mt-4"><Notice tone="off">This date is cancelled.</Notice></div>}
      </Card>

      {canReview && requests.length > 0 && (
        <Card>
          <SectionTitle hint="Shift counts people automatically from their own trips. These people say they came but their trip didn't match.">
            Credit requests
          </SectionTitle>
          {msg && <div className="mb-3"><Notice tone="good" onClose={() => setMsg(null)}>{msg}</Notice></div>}
          <ul className="divide-y divide-(--ev-line)">
            {requests.map((q) => (
              <li key={q.member_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-[15px] font-semibold text-(--ev-ink)">{q.display_name}</p>
                  <p className="text-[14px] text-(--ev-ink-75)">
                    {q.here_at_start ? 'Checked in at the start. ' : ''}
                    {q.rides_attended > 0 ? `Came ${plural(q.rides_attended, 'time')} before.` : 'Would be their first time.'}
                    {q.declined ? ' You declined this.' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={() => void settle(q.member_id, true)} busy={settling === q.member_id}>
                    <Check className="h-4 w-4" aria-hidden />{q.declined ? 'Approve after all' : 'Approve'}
                  </Button>
                  {!q.declined && (
                    <Button size="sm" onClick={() => void settle(q.member_id, false)} disabled={settling === q.member_id}>
                      <X className="h-4 w-4" aria-hidden />Decline
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {msg && !(canReview && requests.length > 0) && <Notice tone="good" onClose={() => setMsg(null)}>{msg}</Notice>}

      <Card>
        <SectionTitle hint={`First names and last initials only. Shift messages everyone for you, so you never need their email or number.${guests ? ` ${plural(guests, 'person', 'people')} answered on the ride page without the app.` : ''}`}>
          {past ? 'Who was on the list' : "Who's coming"}
        </SectionTitle>
        {err && <Notice tone="off">{err} <button type="button" className="font-semibold underline" onClick={() => void load()}>Try again</button></Notice>}
        {!rows && !err && <Spinner label="Loading the list" />}
        {rows && rows.length === 0 && <p className="text-[14px] text-(--ev-ink-75)">Nobody is on this ride yet. Share the ride page to get the first answers.</p>}
        {rows && rows.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {GROUPS.map((g) => grouped[g.key].length > 0 && (
              <section key={g.key} className={cx(g.key === 'none' || g.key === 'not_going' ? 'md:col-span-1' : '')}>
                <h3 className="text-[15px] font-bold text-(--ev-ink-85)">{g.label} · {grouped[g.key].length}</h3>
                <ul className="mt-1 divide-y divide-(--ev-line)">
                  {grouped[g.key].map((p) => <Person key={p.member_id} p={p} past={past} />)}
                </ul>
              </section>
            ))}
          </div>
        )}
        {past && (
          <p className="mt-5 border-t border-(--ev-line) pt-3 text-[14px] leading-snug text-(--ev-ink-75)">
            &ldquo;Came&rdquo; comes from people&rsquo;s own trips in the Shift app, plus the requests you approve. For people who answered on
            the ride page, the list shows who planned to come.
          </p>
        )}
      </Card>
    </div>
  )
}
