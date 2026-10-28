'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Briefcase, Car, Clock, GraduationCap, House, Languages, Mail, Medal, Route, Sprout } from 'lucide-react'
import NextSteps from '@/components/together/NextSteps'
import { Avatar, Chip, ChipRow, FitMeter, WAY_ICON } from '@/components/together/bits'
import { Journey } from '@/components/together/TogetherShell'
import { Button, Card, Notice, Spinner, Textarea, cx } from '@/components/organizers/ui'
import {
  LANGUAGES, TIMES, WAYS, answerMatch, answerWent, arriveGap, clock, endMatch, experienceFit, isWay, myMatches, myRequests,
  overallFit, rateMatch, reportMatch, routeFit, timingDaysKnown, timingFit, track,
  type Match, type PartnerRequest, type Rating, type ReportReason,
} from '@/lib/together'

/**
 * gogreenstreets.org/together/matches: the app's matches screen
 * (partner-matches.tsx) for the web, with the same card: a fit rating, the
 * person's face, and timing, route and experience meters before the yes;
 * their email once both say yes; "Did you go together?" a day later, then
 * how it went; and "Something wrong?" to end the match or report a problem.
 * Everything comes from the app's own RPCs, so a web person sees exactly
 * what the app would show.
 */

const RATINGS: { id: Rating; label: string }[] = [{ id: 'great', label: 'Great' }, { id: 'ok', label: 'OK' }, { id: 'not_good', label: 'Not good' }]
const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'no_show', label: 'They didn’t show up' },
  { id: 'uncomfortable', label: 'I felt uncomfortable' },
  { id: 'unsafe', label: 'I felt unsafe' },
  { id: 'other', label: 'Something else' },
]
// Plain words, as in the match notice (01462; Keith 2026-10-27: "too euphemistic").
const DO: Record<string, string> = { bike: 'bike', walk: 'walk', transit: 'take the bus or train', micro: 'ride a scooter' }
function shortLine(m: Match): string {
  if (m.my_kind === 'carpool') return 'Could share your drive'
  const way = DO[m.other.shared_modes?.[0] ?? (m.my_kind === 'guide' ? m.other.modes[0] : '') ?? ''] ?? null
  if (m.my_kind === 'newcomer') return way ? `Can show you how to ${way}` : 'Makes a trip like yours'
  return way ? `Would like you to show them how to ${way}` : 'Would like to try your trip'
}
const MOSTLY: Record<string, string> = {
  walk: 'Mostly walks', bike: 'Mostly bikes', transit: 'Mostly takes the bus or train', micro: 'Mostly scooters and boards', drive: 'Mostly drives',
}
const ROLE: Record<string, string> = { driver: 'Can drive', rider: 'Would ride along', either: 'Can drive or ride along' }
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [requests, setRequests] = useState<PartnerRequest[]>([])
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const fetchAll = useCallback(() => Promise.all([myMatches(), myRequests().catch(() => [] as PartnerRequest[])]), [])
  const load = useCallback(async () => {
    try {
      const [m, r] = await fetchAll()
      setMatches(m)
      setRequests(r)
    } catch {
      setFailed(true)
    }
  }, [fetchAll])
  useEffect(() => {
    let live = true
    fetchAll()
      .then(([m, r]) => { if (live) { setMatches(m); setRequests(r) } })
      .catch(() => { if (live) setFailed(true) })
    track('together_matches_viewed')
    return () => { live = false }
  }, [fetchAll])

  async function run(m: Match, act: () => Promise<boolean>, event: `together_${string}`, props: Record<string, unknown> = {}, done?: string) {
    setBusy(m.id)
    setProblem(null)
    const ok = await act()
    setBusy(null)
    if (!ok) return setProblem('That didn’t go through. Please try again.')
    track(event, { kind: m.kind, my_kind: m.my_kind, ...props })
    if (done) setNotice(done)
    await load()
  }

  if (failed) {
    return (
      <Notice tone="off">
        We couldn&rsquo;t load your matches.{' '}
        <button type="button" className="font-semibold underline" onClick={() => { setFailed(false); void load() }}>Try again</button>
      </Notice>
    )
  }
  if (!matches) return <Spinner label="Opening your matches" />

  const open = requests.find((r) => r.status === 'open' || r.status === 'matched') ?? null
  const myArrive = requests.find((r) => r.kind === 'carpool')?.arrive_by ?? null
  const deciding = matches.some((m) => m.status === 'proposed')

  return (
    <div className="grid grid-cols-1 gap-6">
      <Journey at={matches.length ? 3 : 2} />
      <div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold">Your matches</h1>
        {!matches.length || deciding ? (
          <p className="mt-2 text-[16px] text-(--ev-ink-85)">If you both say yes, you each see the other&rsquo;s email to plan a first trip.</p>
        ) : null}
      </div>
      {notice ? <Notice tone="good" onClose={() => setNotice(null)}>{notice}</Notice> : null}
      {problem ? <Notice tone="off" onClose={() => setProblem(null)}>{problem}</Notice> : null}

      {matches.length === 0 ? (
        open ? (
          <>
            <Card>
              <h2 className="font-display text-[22px] font-extrabold">No matches yet</h2>
              <p className="mt-2 text-[16px] text-(--ev-ink-85)">We&rsquo;ll email you when we find someone who lives near you, works near your work and goes at the same times.</p>
            </Card>
            <NextSteps kind={open.kind} ways={open.modes.filter(isWay)} source="matches" />
          </>
        ) : (
          <Card>
            <h2 className="font-display text-[22px] font-extrabold">No matches yet</h2>
            <p className="mt-2 text-[16px] text-(--ev-ink-85)">Tell us where and when you go, and Shift looks for someone nearby who goes at the same times.</p>
            <Link href="/together" className="mt-4 inline-flex min-h-[44px] items-center rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill)">
              Sign up
            </Link>
          </Card>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-5">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              m={m}
              busy={busy === m.id}
              myArrive={myArrive}
              onAnswer={(yes) => void run(m, () => answerMatch(m.id, yes), 'together_match_answered', { yes })}
              onWent={() => void run(m, () => answerWent(m.id, true), 'together_went_answered', { went: true })}
              onRate={(r, c) => void run(m, () => rateMatch(m.id, r, c.trim() || null), 'together_match_rated', { rating: r, has_comment: !!c.trim() })}
              onEnd={() => void run(m, () => endMatch(m.id), 'together_match_ended', {}, 'Done. This match has ended.')}
              onReport={(r, d) => void run(
                m, () => reportMatch(m.id, r, d.trim() || null), 'together_match_reported', { reason: r },
                `Thanks for telling us. The Green Streets team will look into it, and you won’t be matched with ${m.other.first_name || 'them'} again.`,
              )}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function MatchCard({ m, busy, myArrive, onAnswer, onWent, onRate, onEnd, onReport }: {
  m: Match
  busy: boolean
  myArrive: string | null
  onAnswer: (yes: boolean) => void
  onWent: () => void
  onRate: (rating: Rating, comment: string) => void
  onEnd: () => void
  onReport: (reason: ReportReason, details: string) => void
}) {
  const [rating, setRating] = useState<Rating | null>(null)
  const [comment, setComment] = useState('')
  const [wrongOpen, setWrongOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [confirmEnd, setConfirmEnd] = useState(false)
  // Read once when the card mounts: "Did you go together?" waits a day after connecting.
  const [now] = useState(() => Date.now())

  const name = m.other.first_name || 'Someone'
  const connected = m.status === 'connected' || m.status === 'went_together'
  const fullName = connected && m.other.last_initial ? `${name} ${m.other.last_initial}.` : name
  const askWent = m.status === 'connected' && !!m.connected_at && now - new Date(m.connected_at).getTime() > 24 * 3600_000
  const carpool = m.my_kind === 'carpool'
  const eyebrow = m.status === 'went_together' ? 'You went together' : connected ? 'You both said yes' : shortLine(m)
  const overall = m.status === 'proposed' ? overallFit(m, myArrive) : null
  const since = m.other.member_since ? new Date(m.other.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null
  const timing = timingFit(m, myArrive)
  const gap = carpool ? arriveGap(myArrive, m.other.arrive_by) : null
  const detour = carpool && m.detour_minutes != null ? Math.max(1, Math.round(m.detour_minutes)) : null
  const far = m.home_miles != null && m.dest_miles != null ? Math.max(m.home_miles, m.dest_miles) : null
  const farText = far == null ? null : `Within ${Math.max(0.1, Math.round(far * 10) / 10)} mi`
  const coworkers = m.other.shared_groups.some((g) => g.type === 'workplace')
  const groups = connected && m.other.group_name && !m.other.shared_groups.some((g) => g.name === m.other.group_name)
    ? [{ name: m.other.group_name, type: 'workplace' as const }, ...m.other.shared_groups]
    : m.other.shared_groups
  const Primary = m.other.primary_mode ? WAY_ICON[m.other.primary_mode] : null
  // What they speak, the ones you share first (01476): context, not a rule.
  // Left off when you both speak only English, where it says nothing new.
  const shared = m.other.shared_languages ?? []
  const theirs = m.other.languages ?? []
  const onlyEnglish = theirs.length === 1 && theirs[0] === 'en' && shared.includes('en')
  const speaks = onlyEnglish ? '' : [...shared, ...theirs.filter((l) => !shared.includes(l))]
    .map((l) => LANGUAGES.find((x) => x.id === l)?.english ?? l).join(', ')
  const timingValue = gap != null
    ? (gap === 0 ? 'Same time' : `${gap} min apart`)
    : timing != null && timing > 1 && !timingDaysKnown(m) && m.other.shared_times.length
      ? TIMES.filter((x) => m.other.shared_times.includes(x.id)).map((x) => x.label).join(', ')
      : timing === 3 ? 'Same days' : timing === 2 ? 'Some days' : 'Different times'

  return (
    <Card as="li" className={cx('grid grid-cols-1 gap-5', connected && 'outline-2 outline-(--ev-accent)')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-bold text-(--ev-accent)">{eyebrow}</span>
        {overall ? (
          <span className={cx(
            'rounded-full px-3 py-1 text-[14px] font-bold',
            overall === 3 ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : overall === 2 ? 'bg-(--ev-accent-tint-15) text-(--ev-ink)' : 'bg-(--ev-panel) text-(--ev-ink-80)',
          )}>
            {overall === 3 ? 'Great match' : overall === 2 ? 'Good match' : 'Possible match'}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <Avatar name={name} url={m.other.avatar_url} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-bold leading-tight">{fullName}</h2>
            {m.other.status_name ? <span className="rounded-full bg-(--ev-panel) px-2.5 py-0.5 text-[13px] font-bold">{m.other.status_name}</span> : null}
          </div>
          {Primary && m.other.primary_mode ? (
            <p className="mt-1 flex items-center gap-1.5 text-[15px] text-(--ev-ink-85)">
              <Primary className="h-4 w-4" aria-hidden /> {MOSTLY[m.other.primary_mode]}
            </p>
          ) : null}
          {since ? <p className="text-[15px] text-(--ev-ink-80)">Member since {since}</p> : null}
          {speaks ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-(--ev-ink-85)">
              <Languages className="h-4 w-4" aria-hidden /> Speaks {speaks}
            </p>
          ) : null}
        </div>
      </div>

      {groups.length ? (
        <div className="flex flex-wrap gap-2">
          {groups.slice(0, 3).map((g) => {
            const GI = g.type === 'workplace' ? Briefcase : g.type === 'school' ? GraduationCap : House
            return (
              <span key={`${g.type}:${g.name}`} className="inline-flex items-center gap-1.5 rounded-full bg-(--ev-panel) px-3 py-1 text-[14px] font-semibold">
                <GI className="h-4 w-4 text-(--ev-accent)" aria-hidden /> {g.name}
              </span>
            )
          })}
        </div>
      ) : null}

      {m.status === 'proposed' || (carpool && connected) ? (
        <div className="grid grid-cols-1 gap-1 rounded-xl bg-(--ev-panel) px-4 py-3">
          {m.status === 'proposed' && timing != null ? (
            <FitMeter icon={<Clock className="h-[18px] w-[18px]" />} label="Timing" level={timing} value={timingValue} />
          ) : null}
          {m.status === 'proposed' && (detour != null || farText) ? (
            <FitMeter
              icon={<Route className="h-[18px] w-[18px]" />}
              label={detour != null ? 'Detour' : 'Route'}
              level={routeFit(m)}
              value={detour != null ? `+${detour} min for ${m.i_drive ? 'you' : 'them'}` : farText!}
            />
          ) : null}
          {m.my_kind === 'newcomer' && m.other.trips_60d != null ? (
            <FitMeter
              icon={<Medal className="h-[18px] w-[18px]" />}
              label="Experience"
              level={experienceFit(m)}
              value={`${m.other.trips_60d} ${plural(m.other.trips_60d, 'trip', 'trips')}`}
            />
          ) : null}
          {m.my_kind === 'guide' && m.other.modes.length ? (
            <ChipRow icon={<Sprout className="h-[18px] w-[18px]" />} label="Wants to try">
              {m.other.modes.map((w) => {
                const WI = WAY_ICON[w]
                return (
                  <span key={w} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[14px] font-semibold">
                    <WI className="h-4 w-4" aria-hidden /> {WAYS.find((x) => x.id === w)?.label ?? w}
                  </span>
                )
              })}
            </ChipRow>
          ) : null}
          {carpool ? (
            <ChipRow icon={<Car className="h-[18px] w-[18px]" />} label="Role">
              {m.other.carpool_role ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[14px] font-semibold">
                  <Car className="h-4 w-4" aria-hidden /> {ROLE[m.other.carpool_role]}
                </span>
              ) : null}
              {m.other.arrive_by ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[14px] font-semibold">
                  <Clock className="h-4 w-4" aria-hidden /> Gets to work by {clock(m.other.arrive_by)}
                </span>
              ) : null}
            </ChipRow>
          ) : null}
        </div>
      ) : null}

      {m.status === 'proposed' && !m.my_answer ? (
        <div className="grid grid-cols-1 gap-2">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" busy={busy} onClick={() => onAnswer(true)}>I&rsquo;d like to go together</Button>
            <Button disabled={busy} onClick={() => onAnswer(false)}>Not this one</Button>
          </div>
          <p className="text-[15px] text-(--ev-ink-80)">{name} only sees your email if you both say yes.</p>
        </div>
      ) : null}
      {m.status === 'proposed' && m.my_answer === 'yes' ? (
        <p className="text-[16px] font-semibold">You said yes. We&rsquo;ll email you if {name} says yes too.</p>
      ) : null}

      {connected && m.other.email ? (
        <div className="grid grid-cols-1 gap-3">
          <p className="text-[16px] font-semibold">
            {m.status === 'went_together'
              ? (carpool ? 'Next: agree on the days you’ll keep sharing the drive.' : 'Next: try the same trip on your own this week, while the route is fresh.')
              : (carpool ? `Email ${name} to settle who drives, where to meet and your first day.` : `Email ${name} to pick a day for your first trip together.`)}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`mailto:${m.other.email}?subject=${encodeURIComponent(carpool ? 'Sharing the drive' : 'Our first trip together')}`}
              onClick={() => track('together_email_tapped', { kind: m.kind })}
              className={cx(
                'inline-flex min-h-[44px] items-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold',
                m.status === 'went_together' ? 'border border-(--ev-line-strong) bg-white' : 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)',
              )}
            >
              <Mail className="h-4 w-4" aria-hidden /> Email {name}
            </a>
            {!carpool && m.status === 'connected' ? (
              <Link
                href="/nearby?plan=1"
                onClick={() => track('together_plan_opened', { source: 'match' })}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold"
              >
                <Route className="h-4 w-4" aria-hidden /> Plan the route
              </Link>
            ) : null}
          </div>
          <p className="select-all break-all text-[15px] text-(--ev-ink-85)">{m.other.email}</p>
          {m.status === 'connected' ? (
            <p className="text-[15px] text-(--ev-ink-80)">
              {carpool
                ? (coworkers ? 'If you haven’t met, say hello at work before your first drive.' : 'For the first pickup, meet somewhere public and tell a friend your plan.')
                : 'Meet somewhere public the first time, and tell a friend where you’re going.'}
            </p>
          ) : null}

          {askWent ? (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
              <p className="text-[16px] font-bold">Did you go together?</p>
              <div><Button busy={busy} onClick={onWent}>Yes, we went</Button></div>
            </div>
          ) : null}

          {m.status === 'went_together' && !m.my_rating ? (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
              <p className="text-[16px] font-bold">How did it go with {name}?</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`How did it go with ${name}?`}>
                {RATINGS.map((r) => <Chip key={r.id} role="radio" aria-checked={rating === r.id} on={rating === r.id} onClick={() => setRating(r.id)}>{r.label}</Chip>)}
              </div>
              <Textarea rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything you'd like to tell us? (optional)" aria-label="Anything you'd like to tell us?" />
              <p className="text-[15px] text-(--ev-ink-80)">Only the Green Streets team sees this. {name} doesn&rsquo;t.</p>
              <div><Button variant="primary" busy={busy} disabled={!rating} onClick={() => rating && onRate(rating, comment)}>Send</Button></div>
            </div>
          ) : m.status === 'went_together' ? (
            <p className="text-[15px] font-semibold">You went together. Thanks for letting us know.</p>
          ) : null}

          {!wrongOpen ? (
            <button type="button" onClick={() => setWrongOpen(true)} className="min-h-[44px] justify-self-start text-[15px] font-semibold text-(--ev-ink-80) underline">
              Something wrong?
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
              <p className="text-[16px] font-bold">Something wrong?</p>
              {m.status === 'connected' ? (
                confirmEnd ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[15px]">You and {name} won&rsquo;t see this match anymore.</span>
                    <Button size="sm" busy={busy} onClick={onEnd}>Yes, end it</Button>
                  </div>
                ) : (
                  <div><Button size="sm" onClick={() => setConfirmEnd(true)}>End this match</Button></div>
                )
              ) : null}
              <p className="text-[15px] font-bold">Or tell us what happened</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What happened?">
                {REASONS.map((r) => <Chip key={r.id} role="radio" aria-checked={reason === r.id} on={reason === r.id} onClick={() => setReason(r.id)}>{r.label}</Chip>)}
              </div>
              <Textarea rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened? (optional)" aria-label="What happened?" />
              <p className="text-[15px] text-(--ev-ink-80)">Your report goes to the Green Streets team, not to {name}. If you&rsquo;re in danger, call 911.</p>
              <div className="flex flex-wrap gap-3">
                <Button busy={busy} disabled={!reason} onClick={() => reason && onReport(reason, details)}>Send report</Button>
                <Button variant="ghost" onClick={() => setWrongOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  )
}
