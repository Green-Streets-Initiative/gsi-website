import type { Metadata } from 'next'
import QRCode from 'qrcode'
import {
  Bicycle,
  Bus,
  PersonSimpleWalk,
  Scooter,
  Train,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { loadWalkRideDays } from '@/app/programs/walk-ride-days/_lib/load'
import PrintButton from '@/app/events/shift-your-summer/flyer/PrintButton'
import {
  contactSentence,
  countingSentences,
  effectiveRules,
  whatToDo,
  eligibilitySentence,
  prizeSentence,
  type ChallengeRulesInput,
  type CountingRules,
} from '@/lib/challenge-rules'

export const metadata: Metadata = {
  title: 'Shift for Employers — Printable flyer',
  description:
    'A one-page flyer for your Shift employer program. Print it for your office or attach to an email.',
}

export const dynamic = 'force-dynamic'

type GroupRow = {
  id: string
  name: string
  slug: string
  invite_code: string
  logo_url: string | null
}

type ChallengeRow = {
  id: string
  name: string
  starts_at: string
  ends_at: string
  counting_rules: CountingRules | null
  contact_name: string | null
  contact_email: string | null
}

type PrizeRow = {
  id: string
  name: string
  amount_cents: number | null
  prize_description: string | null
  winner_count: number
  display_order: number
  award_mode: string
  min_threshold: number | null
  funded_from_pool: boolean
  requires_work_email: boolean
  published_at: string | null
  cancelled_at: string | null
}

function sanitizeSlug(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  // Uppercase allowed: this parameter can also carry an invite code (B613C9).
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(raw)) return null
  return raw
}

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }
  const startStr = new Date(start).toLocaleDateString('en-US', opts)
  const endStr = new Date(end).toLocaleDateString('en-US', {
    ...opts,
    year: 'numeric',
  })
  return `${startStr} to ${endStr}`
}

/** Read once per request (the page is force-dynamic), outside the render body. */
function requestTime(): number {
  return Date.now()
}

/**
 * The mode pictograms on the sign, in the portal's icon set (bold weight;
 * never a filled bicycle). A challenge shows only the modes that count for
 * it; the plain join flyer shows the ones its lede names. Ferry rides under
 * the transit pair rather than adding a seventh icon.
 */
const SIGN_MODES: { key: string; matches: string[]; Icon: React.ElementType; label: string }[] = [
  { key: 'walk', matches: ['walk'], Icon: PersonSimpleWalk, label: 'Walk' },
  { key: 'bike', matches: ['bike'], Icon: Bicycle, label: 'Bike' },
  { key: 'escooter', matches: ['escooter'], Icon: Scooter, label: 'E-scooter' },
  { key: 'bus', matches: ['transit_bus'], Icon: Bus, label: 'Bus' },
  { key: 'train', matches: ['transit_train', 'transit_commuter_rail'], Icon: Train, label: 'Train' },
  { key: 'carpool', matches: ['carpool'], Icon: UsersThree, label: 'Carpool' },
]

function signModes(rules: CountingRules | null | undefined, isChallenge: boolean) {
  if (!isChallenge) return SIGN_MODES.filter((m) => m.key !== 'escooter')
  const modes = effectiveRules(rules).modes
  return SIGN_MODES.filter((m) => m.matches.some((x) => modes.includes(x)))
}

function formatDollars(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1000) {
    const k = (dollars / 1000).toFixed(dollars % 1000 === 0 ? 0 : 1)
    return `$${k}k`
  }
  return `$${Math.round(dollars).toLocaleString()}`
}

export default async function EmployerFlyerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const groupSlug = sanitizeSlug(params.group)

  if (!groupSlug) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-500">
          Missing group parameter. Use ?group=your-slug
        </p>
      </main>
    )
  }

  const supabase = createServerSupabaseClient()

  // The Share Kit links here with `slug ?? invite_code`, so accept either —
  // a newly provisioned group may not have a slug yet.
  let { data: groupData } = await supabase
    .from('groups')
    .select('id, name, slug, invite_code, logo_url, status, access_ends_at')
    .eq('slug', groupSlug)
    .in('status', ['active', 'cancelled'])
    .maybeSingle()

  if (!groupData) {
    const byInvite = await supabase
      .from('groups')
      .select('id, name, slug, invite_code, logo_url, status, access_ends_at')
      .ilike('invite_code', groupSlug)
      .in('status', ['active', 'cancelled'])
      .maybeSingle()
    groupData = byInvite.data
  }

  if (!groupData) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-500">Group not found.</p>
      </main>
    )
  }

  const group = groupData as GroupRow & { access_ends_at: string | null }
  if (group.access_ends_at && new Date(group.access_ends_at) < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-500">This group&rsquo;s access has expired.</p>
      </main>
    )
  }

  const joinUrl = `https://shift.gogreenstreets.org/join/${group.invite_code}`

  const { data: challengesRaw } = await supabase
    .from('competitions')
    .select('id, name, starts_at, ends_at, counting_rules, contact_name, contact_email')
    .eq('group_id', group.id)
    .order('starts_at', { ascending: false })

  const allChallenges = (challengesRaw ?? []) as ChallengeRow[]
  const nowMs = requestTime()
  // The portal's "Printable flyer" for a specific challenge passes ?challenge=.
  const requested = Array.isArray(params.challenge) ? params.challenge[0] : params.challenge
  const challenge: ChallengeRow | null =
    allChallenges.find((c) => c.id === requested) ??
    allChallenges.find((c) => {
      const s = new Date(c.starts_at).getTime()
      const e = new Date(c.ends_at).getTime()
      return s <= nowMs && e >= nowMs
    }) ??
    allChallenges.find((c) => new Date(c.starts_at).getTime() > nowMs) ??
    null

  let prizes: PrizeRow[] = []
  if (challenge) {
    const { data: prizeData } = await supabase
      .from('employer_challenge_prizes')
      .select(
        'id, name, amount_cents, prize_description, winner_count, display_order, award_mode, min_threshold, funded_from_pool, requires_work_email, published_at, cancelled_at',
      )
      .eq('competition_id', challenge.id)
      .order('display_order')
    // Draft or cancelled guaranteed rewards aren't promised to anyone yet.
    prizes = ((prizeData ?? []) as PrizeRow[]).filter(
      (p) => p.award_mode !== 'guaranteed' || (p.published_at && !p.cancelled_at),
    )
  }

  const guaranteed = prizes.filter((p) => p.award_mode === 'guaranteed')
  let domains: string[] = []
  if (guaranteed.some((p) => p.requires_work_email)) {
    const { data: d } = await supabase
      .from('employer_email_domains')
      .select('domain')
      .eq('group_id', group.id)
      .order('domain')
    domains = (d ?? []).map((x: { domain: string }) => x.domain)
  }
  const commuteOnly = challenge?.counting_rules?.commute_only === true
  const rulesInput = (p: PrizeRow): ChallengeRulesInput => ({
    rules: challenge?.counting_rules ?? null,
    startsAt: challenge!.starts_at,
    endsAt: challenge!.ends_at,
    goal: Number(p.min_threshold ?? 0),
    spots: p.winner_count,
    funded: p.funded_from_pool,
    amountCents: p.amount_cents,
    description: p.prize_description,
    requiresWorkEmail: p.requires_work_email,
    domains,
    employer: group.name,
    contactName: challenge?.contact_name,
    contactEmail: challenge?.contact_email,
  })
  const otherPrizes = prizes.filter((p) => p.award_mode !== 'guaranteed')

  const totalPrizeValue = otherPrizes.reduce(
    (sum, p) => sum + (p.amount_cents ?? 0) * Math.max(p.winner_count, 1),
    0,
  )

  const qrSvg = await QRCode.toString(joinUrl, {
    type: 'svg',
    margin: 0,
    color: { dark: '#191A2E', light: '#ffffff' },
  })

  const dateRange = challenge
    ? formatDateRange(challenge.starts_at, challenge.ends_at)
    : null

  const isChallenge = !!challenge
  const startsLater = challenge ? new Date(challenge.starts_at).getTime() > nowMs : false
  // Carpools are confirmed with a tap, never detected; say so.
  const lede = isChallenge
    ? `A friendly commute challenge for everyone at ${group.name}. It runs on Shift, a free app from Green Streets Initiative, a Boston-area nonprofit. Shift records your trips on its own.`
    : 'Shift is a free app from Green Streets Initiative, a Boston-area nonprofit. It records your walks, bike rides and transit trips on its own (a carpool takes one tap to confirm), and you can win prizes along the way.'

  // A team with no challenge of its own (a Walk/Ride Day trial team, or a
  // customer between challenges) gets the next Walk/Ride Day and its GSI
  // drawing, so the flyer has a date to rally around.
  const wrd = isChallenge ? null : await loadWalkRideDays(new Date(nowMs))
  const wrdDate = wrd?.next
    ? new Date(wrd.next.startsAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York',
      })
    : null

  // The street-sign look (Keith 2026-09-28): Overpass ExtraBold headline in
  // white on a borderless forest panel, everything else in Trebuchet, cream
  // page, navy text. No monospace, no spaced-caps eyebrows, no date badges.
  return (
    <main className="flyer-root street min-h-screen bg-cream text-navy" style={{ fontFamily: 'var(--font-gsi)' }}>
      <style>{`
        /* Zero page margin so browsers don't print their own header and footer
           (page title, URL, page count) on the flyer; the margin lives on the
           article instead. One Letter page: 8.5 x 11in less 0.3in/0.45in. */
        @page { size: letter; margin: 0; }
        @media print {
          .flyer-no-print { display: none !important; }
          .flyer-root { min-height: 0 !important; }
          body > :not(.flyer-root) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
          .flyer-article { padding: 0.3in 0.45in !important; max-width: none !important; }
        }
        .flyer-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* On-screen print button */}
      <div className="flyer-no-print bg-navy px-8 py-4 text-white">
        <div className="mx-auto flex max-w-[8.5in] items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold">Printable flyer</p>
            <p className="text-xs text-white/85">Use Cmd/Ctrl-P or the button to print or save as PDF.</p>
          </div>
          <PrintButton />
        </div>
      </div>

      <article className="flyer-article mx-auto max-w-[8.5in] px-8 py-5">
        {/* Wordmark row: GSI left, the employer's logo right */}
        <header className="mb-3 flex items-center justify-between gap-4">
          <p className="text-[17px] leading-none">
            <span className="font-bold">Green Streets</span> Initiative
          </p>
          {group.logo_url && (
            <div className="flex h-[52px] items-center rounded-xl bg-white px-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={group.logo_url} alt={group.name} className="h-[34px] w-auto max-w-[170px] object-contain" />
            </div>
          )}
        </header>

        {/* The sign */}
        <section className="rounded-[20px] bg-forest px-8 pb-7 pt-6 text-white">
          {/* Mode pictograms first, left-aligned, like the symbol row on a
              transit sign (Keith 2026-10-01: bigger, on their own line) */}
          <ul className="mb-3.5 flex items-center gap-4" aria-label="Ways to get around that count">
            {signModes(challenge?.counting_rules, isChallenge).map(({ key, Icon, label }) => (
              <li key={key} title={label}>
                <Icon size={36} weight="bold" className="text-white" aria-hidden />
                <span className="sr-only">{label}</span>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[17px] leading-snug">
            {isChallenge && dateRange ? (
              <>
                <span className="font-bold">{dateRange}</span>
                <span>{startsLater ? 'Starts soon' : 'Happening now'}</span>
              </>
            ) : (
              <>
                <span className="font-bold">{group.name}</span>
                <span>on Shift</span>
              </>
            )}
          </p>
          <h1 className="mt-3 font-headline text-[44px] font-extrabold leading-[1.02] tracking-[-0.01em] text-white">
            {isChallenge ? challenge!.name : <>Join {group.name} on Shift</>}
          </h1>
          {isChallenge && (
            <p className="mt-3 font-headline text-[22px] font-semibold leading-[1.2] text-white">
              {group.name}
            </p>
          )}
          <p className="mt-3 max-w-[560px] text-[16px] leading-[1.5] text-white">{lede}</p>
        </section>

        {/* How to take part + QR */}
        <section className="mt-4 grid grid-cols-[1fr_170px] gap-8">
          <div>
            <h2 className="font-headline text-[22px] font-extrabold leading-tight">How to take part</h2>
            <ol className="mt-3 grid gap-2.5 text-[15px] leading-[1.45]">
              {[
                <>Download Shift for iPhone or Android, or scan the code.</>,
                <>
                  Enter code <span className="font-headline text-[17px] font-extrabold tracking-[0.06em]">{group.invite_code}</span> to join {group.name}.
                </>,
                <>{isChallenge ? `${whatToDo(challenge!.counting_rules)} Shift does the rest.` : 'Walk, bike or take transit. Shift does the rest.'}</>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest font-headline text-[13px] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="rounded-2xl bg-white p-3">
              <div className="h-[128px] w-[128px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            </div>
            <p className="mt-2 text-[13px] leading-snug text-ink-soft">Scan to join</p>
            <p className="font-headline text-[22px] font-extrabold tracking-[0.06em] text-forest">{group.invite_code}</p>
          </div>
        </section>

        {/* Next Walk/Ride Day, for teams without a challenge of their own */}
        {wrdDate && (
          <section className="mt-4 border-t-2 border-navy/15 pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-headline text-[22px] font-extrabold leading-tight">
                {wrd?.next?.active ? 'Walk/Ride Day is today' : `Walk/Ride Day is ${wrdDate}`}
              </h2>
              {wrd?.prizes && (
                <span className="font-headline text-[20px] font-extrabold text-forest">
                  {wrd.prizes.count} gift cards to win
                </span>
              )}
            </div>
            <p className="mt-2 max-w-[640px] text-[15px] leading-[1.5]">
              Make one walking, biking or transit trip that day and you&rsquo;re entered in the Green Streets Initiative gift card drawing. There&rsquo;s nothing to log.
            </p>
            <p className="mt-1.5 text-[13.5px] leading-[1.45] text-ink-soft">
              Open to Shift members 18 or older in Massachusetts. Rules: gogreenstreets.org/events/walk-ride-day/rules
            </p>
          </section>
        )}

        {/* How to win: the rules' own words */}
        {isChallenge && guaranteed.length > 0 && (
          <section className="mt-4 border-t-2 border-navy/15 pt-4">
            <h2 className="font-headline text-[22px] font-extrabold leading-tight">How to win</h2>
            <div className="mt-2.5 grid gap-1.5">
              {guaranteed.map((p) => (
                <p key={p.id} className="text-[16px] font-bold leading-snug">
                  {prizeSentence(rulesInput(p))}
                </p>
              ))}
            </div>
            <ul className="mt-2.5 grid list-disc gap-1 pl-5 text-[13.5px] leading-[1.45] text-ink-soft">
              {(() => {
                const lines = countingSentences(rulesInput(guaranteed[0]))
                const carpool = lines.find((l) => l.startsWith('For a carpool to count'))
                const top = lines.slice(0, commuteOnly ? 5 : 4)
                return [...top, ...(carpool ? [carpool] : [])]
              })().map((line) => (
                <li key={line}>{line}</li>
              ))}
              {eligibilitySentence(rulesInput(guaranteed[0])) && <li>{eligibilitySentence(rulesInput(guaranteed[0]))}</li>}
              {contactSentence(rulesInput(guaranteed[0])) && <li>{contactSentence(rulesInput(guaranteed[0]))}</li>}
            </ul>
          </section>
        )}

        {/* Drawings and leaderboard prizes */}
        {otherPrizes.length > 0 && (
          <section className="mt-4 border-t-2 border-navy/15 pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-headline text-[22px] font-extrabold leading-tight">Prizes</h2>
              {totalPrizeValue > 0 && (
                <span className="font-headline text-[20px] font-extrabold text-forest">{formatDollars(totalPrizeValue)}+ in prizes</span>
              )}
            </div>
            <ul className="mt-2.5 grid grid-cols-2 gap-x-8 gap-y-2 text-[14px] leading-snug">
              {otherPrizes.slice(0, 8).map((p) => (
                <li key={p.id} className="border-b-2 border-navy/10 pb-2">
                  <p className="font-bold">
                    {p.name}
                    {p.winner_count > 1 && <span className="ml-1.5 font-normal text-ink-soft">· {p.winner_count} winners</span>}
                  </p>
                  {p.amount_cents != null && p.amount_cents > 0 && <p className="text-forest">{formatDollars(p.amount_cents)} each</p>}
                  {p.prize_description && <p className="text-ink-soft">{p.prize_description}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t-2 border-navy pt-3 text-[14px]">
          <p>
            <span className="font-bold">Green Streets</span> Initiative · a Massachusetts nonprofit
          </p>
          <p className="text-ink-soft">shift.gogreenstreets.org/join/{group.invite_code}</p>
        </footer>
      </article>
    </main>
  )
}
