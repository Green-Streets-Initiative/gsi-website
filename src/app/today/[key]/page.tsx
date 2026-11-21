import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { timingSafeEqual } from 'node:crypto'
import {
  AirplaneTilt, ArrowClockwise, Bicycle, Buildings, CalendarCheck, ChatCircleText, ChatsCircle, Compass, Flag, Gift, Handshake, MapPin, Star, UserPlus, UsersThree,
} from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OrganizerFunnel, { type Waiting } from './OrganizerFunnel'

/**
 * GSI Today for Keith's phone (Shift 01863; Keith 2026-11-19: "Can we find a
 * way to make that a bit more accessible to me when I'm on my phone?").
 * Opens from every win alert and the 7 am email with no sign-in: the link is
 * the key (gsi_today_access), and any other address is "not found". Never
 * indexed.
 *
 * Wins are what the gsi-today function told or recorded (gsi_today_alerts);
 * the numbers are gsi_today_snapshot(), live, plus yesterday's parking-page
 * and Around You numbers the function saved from PostHog (gsi_today_days).
 * The wording follows the morning email (supabase/functions/gsi-today/compose.ts
 * in the Shift repo).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'GSI Today',
  robots: { index: false, follow: false },
  appleWebApp: { title: 'GSI Today', capable: true, statusBarStyle: 'default' },
}

const TZ = 'America/New_York'
const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold leading-tight text-ink'
const CARD = 'rounded-[22px] bg-white px-5 py-5'

type Win = { key: string; kind: string; headline: string; detail: string | null; occurred_at: string }
type Snap = Record<string, number | string | undefined>

// Every kind the gsi-today function records gets a label and a picture.
const GROUPS: Record<string, [string, Icon]> = {
  joined: ['New member', UserPlus],
  invite: ['Invite', UsersThree],
  shift_together: ['Shift Together', Handshake],
  went_together: ['Shift Together', Handshake],
  employer_reply: ['Employer', Buildings],
  social_post: ['Social', ChatCircleText],
  event_saved: ['Event', CalendarCheck],
  ride_going: ['Ride', Bicycle],
  reward: ['Reward', Gift],
  lesson_asked: ['Bike lesson', Bicycle],
  lesson_booked: ['Bike lesson', Bicycle],
  lesson_given: ['Bike lesson', Bicycle],
  lesson_felt: ['Bike lesson', Bicycle],
  lesson_words: ['Bike lesson', Bicycle],
  lesson_rode: ['Bike lesson', Bicycle],
  logan_asked: ['Logan', AirplaneTilt],
  logan_matched: ['Logan', AirplaneTilt],
  logan_booked: ['Logan', AirplaneTilt],
  org_opened: ['Organizer', Flag],
  org_first_ride: ['Organizer', Flag],
  org_three_going: ['Organizer', Flag],
  org_feedback: ['Organizer', Flag],
  parking_trip_planned: ['Parking page', MapPin],
  parking_get_shift: ['Parking page', MapPin],
  around_you_used: ['Around You', Compass],
  // Shift 2026-11-21: who asked an assistant, in their words (gsi-today/assistant.ts).
  assistant_app: ['Assistant', ChatsCircle],
  assistant_organizer: ['Organizer assistant', ChatsCircle],
  assistant_employer: ['Employer assistant', ChatsCircle],
}

function sameKey(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts })
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const n = (x: unknown) => Number(x ?? 0).toLocaleString('en-US')
const people = (x: unknown) => `${n(x)} ${Number(x) === 1 ? 'person' : 'people'}`

function dayLabel(key: string, today: string, yesterday: string): string {
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  return fmt({ weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00Z`))
}

function Stats({ items }: { items: { value: unknown; label: string }[] }) {
  return (
    <div className={`grid gap-3 ${items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
      {items.map((s) => (
        <div key={s.label}>
          {/* HEAD carries text-ink; drop it so the number is forest, like the email. */}
          <div className={`${HEAD.replace(' text-ink', '')} text-[1.875rem] text-forest`}>{n(s.value)}</div>
          <div className="mt-1 text-[0.9375rem] leading-snug text-ink-muted">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function Section({ id, label, title, children }: { id: string; label?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`${CARD} scroll-mt-16`}>
      {label && <div className="text-[0.875rem] font-bold text-forest">{label}</div>}
      <h2 className={`${HEAD} mb-4 text-[1.375rem]`}>{title}</h2>
      {children}
    </section>
  )
}

function WinList({ wins }: { wins: Win[] }) {
  return (
    <ul className="divide-y divide-[#E3E8DA]">
      {wins.map((w) => {
        const [label, Pic] = GROUPS[w.kind] ?? ['Win', Star]
        return (
          <li key={w.key} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6F0DF] text-forest">
              <Pic size={22} weight="bold" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="text-[0.875rem] text-ink-tertiary">
                <span className="font-bold text-forest">{label}</span>
                {' · '}
                {fmt({ hour: 'numeric', minute: '2-digit' }).format(new Date(w.occurred_at))}
              </div>
              <div className="text-[1rem] font-bold leading-snug text-ink">{w.headline}</div>
              {w.detail && <div className="mt-[2px] text-[0.9375rem] leading-snug text-ink-muted">{w.detail}</div>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default async function GsiTodayPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!/^[0-9a-f]{20,64}$/.test(key)) notFound()
  const sb = createServerSupabaseClient()
  const { data: access } = await sb.from('gsi_today_access').select('key').eq('id', 1).maybeSingle()
  if (!access?.key || !sameKey(access.key, key)) notFound()

  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const [snapRes, winsRes, dayRes] = await Promise.all([
    sb.rpc('gsi_today_snapshot'),
    sb.from('gsi_today_alerts')
      .select('key, kind, headline, detail, occurred_at')
      .neq('kind', 'morning_email')
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(120),
    sb.from('gsi_today_days').select('day, posthog').order('day', { ascending: false }).limit(1).maybeSingle(),
  ])
  const s: Snap = { ...((snapRes.data ?? {}) as Snap) }
  if (dayRes.data && String(dayRes.data.day) === String(s.day)) Object.assign(s, dayRes.data.posthog as Snap)
  const wins = (winsRes.data ?? []) as Win[]

  const now = new Date()
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getTime() - 86400_000))
  const byDay = new Map<string, Win[]>()
  for (const w of wins) {
    const k = dayKey(new Date(w.occurred_at))
    byDay.set(k, [...(byDay.get(k) ?? []), w])
  }
  const recentDays = [today, yesterday]
  const earlier = [...byDay.keys()].filter((k) => !recentDays.includes(k))

  // What riders did yesterday beyond trips; only what happened is listed.
  const did: string[] = []
  const add = (x: unknown, one: string, many: string) => {
    if (Number(x) > 0) did.push(`${n(x)} ${Number(x) === 1 ? one : many}`)
  }
  add(s.lessons_asked_yesterday, 'free bike lesson request', 'free bike lesson requests')
  add(s.lessons_booked_yesterday, 'free bike lesson booked with an instructor', 'free bike lessons booked with an instructor')
  add(s.logan_flights_yesterday, 'flight added to Logan together', 'flights added to Logan together')
  add(s.logan_matched_yesterday, 'Logan match', 'Logan matches')
  // Organizer links opened and first rides saved are each a win of their own, so not repeated here.
  if (Number(s.ay_opened) > 0) {
    did.push(`${people(s.ay_opened)} opened Around You` + (Number(s.ay_used) > 0 ? ` and ${n(s.ay_used)} used it to find a way to go` : ''))
  }
  add(s.invites_joined_yesterday, 'friend joined from an invite', 'friends joined from invites')
  add(s.rewards_yesterday, 'reward used or prize claimed', 'rewards used or prizes claimed')
  add(s.ride_signups_yesterday, 'ride sign-up', 'ride sign-ups')
  add(s.events_saved_yesterday, 'event saved', 'events saved')
  if (Number(s.badges_yesterday) > 0) {
    did.push(`${n(s.badges_yesterday)} ${Number(s.badges_yesterday) === 1 ? 'badge' : 'badges'} earned by ${people(s.badge_people_yesterday)}`)
  }

  const leads: string[] = []
  if (Number(s.lessons_unplaced_7d) > 0) {
    leads.push(`${people(s.lessons_unplaced_7d)} asked for a free bike lesson this week, and every instructor who reaches them said no or didn't answer.`)
  }
  if (Number(s.st_newcomers_not_in_app) > 0) {
    const x = Number(s.st_newcomers_not_in_app)
    leads.push(`${people(x)} who signed up at an event for someone to go along with them ${x === 1 ? "hasn't" : "haven't"} joined Shift yet. They're matched once they join and add the trip.`)
  }
  if (Number(s.st_newcomers_no_trip) > 0) {
    const x = Number(s.st_newcomers_no_trip)
    leads.push(`${people(x)} joined Shift after asking for someone to go along with them but ${x === 1 ? "hasn't" : "haven't"} added the trip yet. They're matched once they do.`)
  }
  if (Number(s.st_newcomers_ready) > 0 && Number(s.st_guides_since_launch) > 0) {
    const x = Number(s.st_newcomers_ready)
    leads.push(`${people(x)} in the app ${x === 1 ? 'is' : 'are'} waiting for a volunteer near their trip.`)
  }
  if (s.employer_replies_7d !== undefined && Number(s.employer_replies_7d) === 0) leads.push('No employer has written back in the last 7 days.')

  const showLessons = Number(s.lessons_asked) > 0
  // Logan shows once someone has added a flight; a block of zeros reads as a verdict on a new launch.
  const showLogan = Number(s.logan_flights) > 0
  // Organizer tools show once an organizer has opened their link (Shift 01864).
  const showOrg = Number(s.org_opened) > 0
  const showParking = s.parking_visitors !== undefined
  const sections: [string, string][] = [
    [`wins-${today}`, 'Today'],
    ['yesterday', 'Numbers'],
    ...(showLessons ? [['lessons', 'Bike lessons'] as [string, string]] : []),
    ...(showLogan ? [['logan', 'Logan'] as [string, string]] : []),
    ...(showOrg ? [['organizers', 'Organizers'] as [string, string]] : []),
    ...(showParking ? [['parking', 'Parking pages'] as [string, string]] : []),
    ...(leads.length ? [['look-into', 'To look into'] as [string, string]] : []),
    ...(earlier.length ? [['earlier', 'Earlier'] as [string, string]] : []),
  ]
  const codes = ((s.signup_codes_7d as unknown as { code: string; n: number }[] | undefined) ?? [])
    .filter((c) => c.code).slice(0, 3).map((c) => `${c.code} (${n(c.n)})`).join(', ')
  const yDay = s.day ? fmt({ weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${s.day}T12:00:00Z`)) : 'Yesterday'

  return (
    <main className="min-h-screen bg-cream px-4 pb-16 pt-6 [font-family:Trebuchet_MS,sans-serif]">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
        <header className="px-1">
          <div className="text-[0.9375rem] font-bold text-forest">
            {fmt({ weekday: 'long', month: 'short', day: 'numeric' }).format(now)}
          </div>
          <h1 className={`${HEAD} text-[2rem]`}>GSI Today</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[0.9375rem] text-ink-tertiary">Updated {fmt({ hour: 'numeric', minute: '2-digit' }).format(now)}</span>
            {/* A plain link: pull-to-refresh doesn't work once the page is on the Home Screen. */}
            <a href={`/today/${key}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-[0.9375rem] font-bold text-forest">
              <ArrowClockwise size={18} weight="bold" aria-hidden />
              Refresh
            </a>
          </div>
        </header>

        <nav aria-label="Sections" className="sticky top-0 z-10 -mx-4 overflow-x-auto bg-cream px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            {sections.map(([id, name]) => (
              <a key={id} href={`#${id}`} className="inline-flex min-h-[40px] items-center rounded-full border border-[#D5DDCB] bg-white px-4 text-[0.9375rem] font-bold text-ink">
                {name}
              </a>
            ))}
          </div>
        </nav>

        {recentDays.map((d) => (
          <Section key={d} id={`wins-${d}`} title={`${dayLabel(d, today, yesterday)}'s wins`}>
            {byDay.get(d)?.length
              ? <WinList wins={byDay.get(d)!} />
              : <p className="text-[1rem] text-ink-muted">Nothing yet. Each one shows up here within 10 minutes.</p>}
          </Section>
        ))}

        <Section id="yesterday" label={yDay} title="Yesterday's numbers">
          <Stats items={[
            { value: s.riders_yesterday, label: 'people recorded trips' },
            { value: s.trips_yesterday, label: 'trips' },
            { value: s.signups_yesterday, label: 'joined Shift' },
          ]} />
          <div className="mt-4 space-y-3 text-[1rem] leading-relaxed text-ink">
            {did.length > 0 && <p>Also yesterday: {did.join(', ')}.</p>}
            <p>
              {people(s.signups_7d)} joined Shift in the last 7 days; a usual week has {n(s.signups_7d_typical)}.
              {codes && ` Sign-up codes used: ${codes}.`}
            </p>
            <p>
              Since Shift Together started on Nov 9: {people(s.st_guides_since_launch)} signed up to go along with someone new
              {Number(s.st_went_together) > 0
                ? `, and ${n(s.st_went_together)} ${Number(s.st_went_together) === 1 ? 'pair has' : 'pairs have'} made a trip together.`
                : '.'}
            </p>
            {Number(s.employer_replies_7d) > 0 && (
              <p>{n(s.employer_replies_7d)} {Number(s.employer_replies_7d) === 1 ? 'employer wrote' : 'employers wrote'} back in the last 7 days.</p>
            )}
          </div>
        </Section>

        {showLessons && (
          <Section id="lessons" label="This season" title="Free bike lessons">
            <Stats items={[
              { value: s.lessons_asked, label: 'asked' },
              { value: s.lessons_booked, label: 'booked with an instructor' },
              { value: s.lessons_given, label: 'had their lesson' },
              { value: s.lessons_rode_alone ?? 0, label: 'biked on their own since' },
            ]} />
            <p className="mt-4 text-[1rem] leading-relaxed text-ink">
              {[
                Number(s.lessons_waiting) > 0 ? `${n(s.lessons_waiting)} ${Number(s.lessons_waiting) === 1 ? 'is' : 'are'} waiting for an instructor's answer.` : '',
                Number(s.lessons_direct_to_school) > 0 ? `The first ${n(s.lessons_direct_to_school)} went straight to the Bicycle Riding School, before we matched instructors.` : '',
                Number(s.lessons_great) > 0 || Number(s.lessons_ok_or_rough) > 0
                  ? `${n(s.lessons_great ?? 0)} said it went great` + (Number(s.lessons_ok_or_rough) > 0 ? `, ${n(s.lessons_ok_or_rough)} said OK or rough.` : '.')
                  : '',
                Number(s.lessons_words_to_share) > 0 ? `${people(s.lessons_words_to_share)} said we can share what they wrote.` : '',
                s.lessons_cap ? `${n(s.lessons_left)} of ${n(s.lessons_cap)} free lessons left.` : '',
              ].filter(Boolean).join(' ')}
            </p>
          </Section>
        )}

        {showLogan && (
          <Section id="logan" label="This season" title="Going to Logan together">
            <Stats items={[
              { value: s.logan_flights, label: 'flights added' },
              { value: s.logan_matched, label: 'matches made' },
              { value: s.logan_both_yes, label: 'pairs who both said yes' },
            ]} />
            {Number(s.logan_waiting) > 0 && (
              <p className="mt-4 text-[1rem] leading-relaxed text-ink">
                {people(s.logan_waiting)} with a flight still ahead {Number(s.logan_waiting) === 1 ? 'is' : 'are'} waiting for a match.
              </p>
            )}
          </Section>
        )}

        {showOrg && (
          <Section id="organizers" label="Since the invitations went out" title="Ride organizers">
            <OrganizerFunnel
              links={Number(s.org_links)}
              steps={[
                { value: Number(s.org_opened), label: 'opened their link' },
                { value: Number(s.org_first_rides), label: 'saved a ride or walk' },
                { value: Number(s.org_three_going), label: 'had 3 or more people coming' },
                { value: Number(s.org_feedback), label: 'sent feedback after a ride' },
              ]}
              waiting={(s.org_waiting as unknown as Waiting[] | undefined) ?? []}
            />
          </Section>
        )}

        {showParking && (
          <Section id="parking" label={yDay} title="Parking pages">
            <Stats items={[
              { value: s.parking_visitors, label: 'people on the parking pages' },
              { value: s.parking_planned, label: 'planned a trip' },
              { value: s.parking_get_shift, label: 'tapped Get Shift' },
            ]} />
            {Number(s.parking_sellers) > 0 && (
              <p className="mt-4 text-[1rem] leading-relaxed text-ink">{people(s.parking_sellers)} went on to a garage or parking site.</p>
            )}
          </Section>
        )}

        {leads.length > 0 && (
          <Section id="look-into" title="To look into">
            <div className="space-y-3 text-[1rem] leading-relaxed text-ink">
              {leads.map((l) => <p key={l}>{l}</p>)}
            </div>
          </Section>
        )}

        {earlier.length > 0 && (
          <Section id="earlier" title="Earlier this week">
            <div className="space-y-6">
              {earlier.map((d) => (
                <div key={d}>
                  <h3 className="mb-3 text-[1rem] font-bold text-forest">{dayLabel(d, today, yesterday)}</h3>
                  <WinList wins={byDay.get(d)!} />
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </main>
  )
}
