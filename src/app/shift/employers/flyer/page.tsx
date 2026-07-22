import type { Metadata } from 'next'
import QRCode from 'qrcode'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PrintButton from '@/app/events/shift-your-summer/flyer/PrintButton'

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
}

type PrizeRow = {
  id: string
  name: string
  amount_cents: number | null
  prize_description: string | null
  winner_count: number
  display_order: number
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
  return `${startStr} – ${endStr}`
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
    .select('id, name, starts_at, ends_at')
    .eq('group_id', group.id)
    .order('starts_at', { ascending: false })

  const allChallenges = (challengesRaw ?? []) as ChallengeRow[]
  const nowMs = Date.now()
  const challenge: ChallengeRow | null =
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
        'id, name, amount_cents, prize_description, winner_count, display_order',
      )
      .eq('competition_id', challenge.id)
      .order('display_order')
    prizes = (prizeData ?? []) as PrizeRow[]
  }

  const totalPrizeValue = prizes.reduce(
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

  return (
    <main className="flyer-root min-h-screen bg-white text-[#191A2E]">
      <style>{`
        @page { size: letter; margin: 0.25in 0.5in; }
        @media print {
          .flyer-no-print { display: none !important; }
          .flyer-root { background: white !important; min-height: 0 !important; }
          body > :not(.flyer-root) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
          .flyer-article { padding: 0 !important; }
        }
        .flyer-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* On-screen print button */}
      <div className="flyer-no-print bg-[#191A2E] px-8 py-4 text-white">
        <div className="mx-auto flex max-w-[8.5in] items-center justify-between">
          <div>
            <p className="text-sm font-bold">Printable flyer</p>
            <p className="text-xs text-white/85">
              Use Cmd/Ctrl-P or the button to print or save as PDF.
            </p>
          </div>
          <PrintButton />
        </div>
      </div>

      <article className="flyer-article mx-auto max-w-[8.5in] px-10 py-2">
        {/* Header */}
        <header className="mb-2 border-b-2 border-[#191A2E] pb-1.5">
          <div className="mb-2 inline-flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="text-xl font-extrabold tracking-tight"
                style={{
                  fontFamily:
                    "'Bricolage Grotesque', var(--font-display), sans-serif",
                }}
              >
                Shift
              </span>
              <svg
                viewBox="0 0 40 26"
                width="24"
                height="16"
                aria-hidden="true"
                className="shrink-0"
              >
                <path
                  d="M0,0 L16,13 L0,26 L0,19 L10,13 L0,7Z"
                  fill="#BAF14D"
                />
                <path
                  d="M20,0 L36,13 L20,26 L20,19 L30,13 L20,7Z"
                  fill="#2966E5"
                />
              </svg>
            </span>
            <span className="text-[#191A2E]/30">&middot;</span>
            <span
              className="text-base tracking-wide"
              style={{ fontFamily: "'Trebuchet MS', sans-serif" }}
            >
              <span className="font-bold">Green Streets</span>{' '}
              <span className="font-normal">Initiative</span>
            </span>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h1
                className="mb-1 text-[32px] font-extrabold leading-[1.05] tracking-tight"
                style={{
                  fontFamily:
                    "'Bricolage Grotesque', var(--font-display), sans-serif",
                }}
              >
                {challenge ? (
                  <>
                    {challenge.name}
                    <br />
                    <span className="text-[22px]">× {group.name}</span>
                  </>
                ) : (
                  <>
                    Join {group.name}
                    <br />
                    <span className="text-[22px]">on Shift</span>
                  </>
                )}
              </h1>
              {dateRange && (
                <div className="mb-1 flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-[#BAF14D] px-3 py-1 text-sm font-bold text-[#191A2E]">
                    {new Date(challenge!.starts_at).getTime() > nowMs
                      ? `Starts ${new Date(challenge!.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' })}`
                      : 'Active now'}
                  </span>
                  <span className="text-base font-semibold text-[#191A2E]/75">
                    {dateRange}
                  </span>
                </div>
              )}
              <p className="text-sm text-[#191A2E]/80">
                {challenge
                  ? 'Track your walks, bike rides, and transit trips. Every active trip counts.'
                  : "Track your active commutes — walk, bike, or ride transit — and help your team go green."}
              </p>
            </div>
            {group.logo_url && (
              <div className="flex h-[56px] shrink-0 items-center rounded-xl bg-white px-3 ring-1 ring-[#191A2E]/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={group.logo_url}
                  alt={group.name}
                  className="h-[38px] w-auto max-w-[160px] object-contain"
                />
              </div>
            )}
          </div>
        </header>

        {/* Hero row: pitch + QR */}
        <section className="mb-3 grid grid-cols-[1fr_auto] gap-6">
          <div>
            <h2
              className="mb-2 text-[22px] font-extrabold leading-tight"
              style={{
                fontFamily:
                  "'Bricolage Grotesque', var(--font-display), sans-serif",
              }}
            >
              Walk, bike, ride — and get rewarded for it.
            </h2>
            <p className="mb-2 text-sm leading-[1.5]">
              The Shift app automatically detects your active trips. Build
              streaks, climb the leaderboard, and earn rewards from your
              employer.
            </p>
            <ol className="space-y-1 text-sm">
              <li>
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#BAF14D] text-sm font-extrabold">
                  1
                </span>
                Download Shift on iOS or Android, or scan the QR code.
              </li>
              <li>
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#BAF14D] text-sm font-extrabold">
                  2
                </span>
                Enter code{' '}
                <strong className="font-mono tracking-wider">
                  {group.invite_code}
                </strong>{' '}
                to join {group.name}&rsquo;s team.
              </li>
              <li>
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#BAF14D] text-sm font-extrabold">
                  3
                </span>
                Walk, bike, or ride transit. Every active trip counts!
              </li>
            </ol>
          </div>

          <div className="flex flex-col items-center justify-center text-center">
            <div
              className="h-[120px] w-[120px]"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="mt-2 text-xs font-bold uppercase tracking-widest">
              Scan to join {group.name}
            </p>
            <p className="mt-1 font-mono text-base font-extrabold tracking-[0.15em] text-[#191A2E]">
              {group.invite_code}
            </p>
          </div>
        </section>

        {/* Prizes */}
        {prizes.length > 0 && (
          <section className="mb-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2
                className="text-xl font-extrabold uppercase tracking-wider"
                style={{
                  fontFamily:
                    "'Bricolage Grotesque', var(--font-display), sans-serif",
                }}
              >
                Prizes
              </h2>
              {totalPrizeValue > 0 && (
                <span className="text-sm font-bold text-[#191A2E]/75">
                  {formatDollars(totalPrizeValue)}+ in prizes
                </span>
              )}
            </div>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] leading-snug">
              {prizes.slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className="border-l-2 border-[#BAF14D] pl-3"
                >
                  <p className="font-semibold">
                    {p.name}
                    {p.winner_count > 1 && (
                      <span className="ml-1.5 text-sm font-normal text-[#191A2E]/60">
                        &middot; {p.winner_count} winners
                      </span>
                    )}
                  </p>
                  {p.amount_cents != null && p.amount_cents > 0 && (
                    <p className="text-sm text-[#191A2E]/75">
                      {formatDollars(p.amount_cents)} each
                    </p>
                  )}
                  {p.prize_description && (
                    <p className="text-sm text-[#191A2E]/75">
                      {p.prize_description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-3 border-t border-[#191A2E]/15 pt-1 text-sm text-[#191A2E]/75">
          <p>
            Green Streets Initiative, a 501(c)(3) &middot;{' '}
            <strong>gogreenstreets.org</strong>
          </p>
          <p className="mt-1">
            Join {group.name}&rsquo;s team &middot;{' '}
            <strong>
              shift.gogreenstreets.org/join/{group.invite_code}
            </strong>
          </p>
        </footer>
      </article>
    </main>
  )
}
