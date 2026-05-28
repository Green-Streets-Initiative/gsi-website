import type { Metadata } from 'next'
import QRCode from 'qrcode'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { brandLabel, type Prize, type PrizeEntryType, type PrizeTier, type EligibilityCriteria } from '../_lib/prizes'
import PrintButton from './PrintButton'

export const metadata: Metadata = {
  title: 'Shift Your Summer — Printable flyer',
  description:
    'A one-page flyer for Shift Your Summer. Print it for your office, classroom, or community board.',
}

export const dynamic = 'force-dynamic'

const CHALLENGE_BASE_URL = 'https://gogreenstreets.org/events/shift-your-summer'

interface SponsorRow {
  id: string
  name: string
  logo_url: string | null
}

interface SponsorshipRow {
  id: string
  display_order: number
  sponsors: SponsorRow | null
}

interface CompetitionRow {
  id: string
  name: string
  description: string
  starts_at: string
  ends_at: string
  is_public: boolean
  event_sponsorships: SponsorshipRow[]
}

function formatDollars(value: number): string {
  if (value >= 1000) {
    const k = (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)
    return `$${k}k`
  }
  return `$${Math.round(value).toLocaleString()}`
}

function sanitizeRef(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(raw)) return null
  return raw
}

function sanitizeSlug(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  if (!/^[a-z0-9-]{1,80}$/.test(raw)) return null
  return raw
}

type GroupRow = {
  name: string
  slug: string
  invite_code: string
  logo_url: string | null
}

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'America/New_York' }
  const startStr = new Date(start).toLocaleDateString('en-US', opts)
  const endStr = new Date(end).toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${startStr} – ${endStr}`
}

export default async function FlyerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const refCode = sanitizeRef(params.ref)
  const groupSlug = sanitizeSlug(params.group)

  const supabase = createServerSupabaseClient()

  let group: GroupRow | null = null
  if (groupSlug) {
    const { data } = await supabase
      .from('groups')
      .select('name, slug, invite_code, logo_url, status, access_ends_at')
      .eq('slug', groupSlug)
      .in('status', ['active', 'cancelled'])
      .maybeSingle()
    if (data) {
      const row = data as GroupRow & { access_ends_at: string | null }
      if (!row.access_ends_at || new Date(row.access_ends_at) >= new Date()) {
        group = { name: row.name, slug: row.slug, invite_code: row.invite_code, logo_url: row.logo_url }
      }
    }
  }

  const shareUrl = group
    ? `https://shift.gogreenstreets.org/join/${group.invite_code}`
    : refCode
      ? `${CHALLENGE_BASE_URL}?ref=${refCode}`
      : CHALLENGE_BASE_URL

  const { data: competitionsRaw } = await supabase
    .from('competitions')
    .select(`
      id, name, description, starts_at, ends_at, is_public,
      event_sponsorships (
        id, display_order,
        sponsors ( id, name, logo_url )
      )
    `)
    .eq('is_public', true)
    .is('group_id', null)
    .like('name', '%Shift Your Summer%')
    .order('starts_at', { ascending: false })
    .limit(5)

  const competitions = (competitionsRaw ?? []) as unknown as CompetitionRow[]
  const nowMs = Date.now()
  const competition: CompetitionRow | null =
    competitions.find(c => {
      const s = new Date(c.starts_at).getTime()
      const e = new Date(c.ends_at).getTime()
      return s <= nowMs && e >= nowMs
    }) ??
    competitions.find(c => new Date(c.starts_at).getTime() > nowMs) ??
    competitions[0] ??
    null

  let prizes: Prize[] = []
  if (competition) {
    const { data: prizeData } = await supabase
      .from('competition_prizes')
      .select('id, place, prize_type, description, value_amount, funded_by_sponsorship_id, tier, display_order, brand_name_override, image_url, product_url, entry_type, eligibility_criteria, funder:funded_by_sponsorship_id(id, sponsors(id, name, logo_url, website_url)), competition_prize_units(id)')
      .eq('competition_id', competition.id)
      .eq('prize_type', 'individual')
      .order('display_order', { ascending: true })
    prizes = (prizeData ?? []).map((row: Record<string, unknown>) => {
      const funderRaw = row.funder as unknown
      const funder = Array.isArray(funderRaw) ? funderRaw[0] ?? null : funderRaw ?? null
      const funderObj = funder as { id?: string; sponsors?: unknown } | null
      const sponsorRaw = funderObj?.sponsors
      const sponsor = Array.isArray(sponsorRaw) ? sponsorRaw[0] ?? null : sponsorRaw ?? null
      return {
        id: row.id as string,
        place: row.place as number | null,
        prize_type: row.prize_type as string,
        description: row.description as string,
        value_amount: (row.value_amount as number | null) ?? null,
        funded_by_sponsorship_id: (row.funded_by_sponsorship_id as string | null) ?? null,
        tier: ((row.tier as PrizeTier | undefined) ?? 'standard') as PrizeTier,
        display_order: (row.display_order as number | undefined) ?? 0,
        brand_name_override: (row.brand_name_override as string | null) ?? null,
        image_url: (row.image_url as string | null) ?? null,
        product_url: (row.product_url as string | null) ?? null,
        quantity: Array.isArray(row.competition_prize_units)
          ? (row.competition_prize_units as unknown[]).length
          : 0,
        entry_type: ((row.entry_type as PrizeEntryType | undefined) ?? 'achievement_gated') as PrizeEntryType,
        eligibility_criteria: ((row.eligibility_criteria as EligibilityCriteria | null | undefined) ?? null) as EligibilityCriteria | null,
        funder: funderObj ? { id: funderObj.id as string, sponsors: sponsor as { id: string; name: string; logo_url: string | null; website_url: string | null } | null } : null,
      } as Prize
    })
  }

  const sponsors: SponsorRow[] = (competition?.event_sponsorships ?? [])
    .filter(s => s.sponsors)
    .sort((a, b) => a.display_order - b.display_order)
    .map(s => s.sponsors!)
    .filter(s => s.logo_url)

  const featuredPrizes = prizes
    .filter(p => p.tier === 'grand' || p.tier === 'featured')
    .slice(0, 6)

  const grandPrize = featuredPrizes.find(p => p.tier === 'grand') ?? null
  const otherFeatured = featuredPrizes.filter(p => p !== grandPrize)

  const totalPrizeValue = prizes.reduce((sum, p) => {
    const unitValue = p.value_amount ?? 0
    return sum + unitValue * Math.max(p.quantity, 1)
  }, 0)

  // Generate the QR as inline SVG so it prints crisp at any size and needs no
  // network round-trip on the print client.
  const qrSvg = await QRCode.toString(shareUrl, {
    type: 'svg',
    margin: 0,
    color: { dark: '#191A2E', light: '#ffffff' },
  })

  const dateRange = competition
    ? formatDateRange(competition.starts_at, competition.ends_at)
    : 'June 15 – August 15'
  const eventName = competition?.name ?? 'Shift Your Summer'

  return (
    <main className="flyer-root min-h-screen bg-white text-[#191A2E]">
      <style>{`
        @page { size: letter; margin: 0.35in 0.5in; }
        @media print {
          .flyer-no-print { display: none !important; }
          .flyer-root { background: white !important; min-height: 0 !important; }
          body > :not(.flyer-root) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
          .flyer-article { padding: 0 !important; }
        }
        .flyer-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* On-screen print button — hidden when printing */}
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
            {/* Shift wordmark: Bricolage Grotesque + chevrons */}
            <span className="flex items-center gap-1.5">
              <span className="font-display text-xl font-extrabold tracking-tight">
                Shift
              </span>
              <svg viewBox="0 0 40 26" width="24" height="16" aria-hidden="true" className="shrink-0">
                <path d="M0,0 L16,13 L0,26 L0,19 L10,13 L0,7Z" fill="#BAF14D" />
                <path d="M20,0 L36,13 L20,26 L20,19 L30,13 L20,7Z" fill="#2966E5" />
              </svg>
            </span>
            <span className="text-[#191A2E]/30">&middot;</span>
            {/* GSI wordmark: Trebuchet MS, "Green Streets" bold + "Initiative" regular */}
            <span className="text-base tracking-wide" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
              <span className="font-bold">Green Streets</span>{' '}
              <span className="font-normal">Initiative</span>
            </span>
          </div>
          <h1 className={`mb-1 font-display font-extrabold leading-[1.05] tracking-tight ${group ? 'text-[32px]' : 'text-[38px]'}`}>
            {group ? (
              <>{eventName}<br /><span className="text-[22px]">× {group.name}</span></>
            ) : eventName}
          </h1>
          <div className="mb-1 flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-[#BAF14D] px-3 py-1 text-sm font-bold text-[#191A2E]">
              Starts {new Date(competition?.starts_at ?? '2026-06-15').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' })}
            </span>
            <span className="text-base font-semibold text-[#191A2E]/75">{dateRange}</span>
          </div>
          <p className="text-sm text-[#191A2E]/80">
            An 8-week challenge to walk, bike, and ride transit. Free to join.
          </p>
          <p className="mt-0.5 text-xs font-bold text-[#191A2E]/60">#ShiftYourSummer</p>
        </header>

        {/* Hero row: pitch + QR */}
        <section className="mb-3 grid grid-cols-[1fr_auto] gap-6">
          <div>
            <h2 className="mb-2 font-display text-[22px] font-extrabold leading-tight">
              Walk, bike, ride — and get rewarded for it.
            </h2>
            <p className="mb-2 text-sm leading-[1.5]">
              The Shift app automatically detects your active trips. Build streaks, climb the
              leaderboard, and enter to win prizes from local and national partners.
            </p>
            <ol className="space-y-1 text-sm">
              <li>
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#BAF14D] text-sm font-extrabold">1</span>
                Download Shift on iOS or Android{group ? ' or scan the QR code' : ''}.
              </li>
              <li>
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#BAF14D] text-sm font-extrabold">2</span>
                {group ? (
                  <>Enter code <strong className="font-mono tracking-wider">{group.invite_code}</strong> to join {group.name}&rsquo;s team.</>
                ) : (
                  <>Take active trips. Walk, bike, or ride transit — Shift detects automatically.</>
                )}
              </li>
              <li>
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#BAF14D] text-sm font-extrabold">3</span>
                {group
                  ? 'Walk, bike, or ride transit. Every active trip is a prize entry.'
                  : 'Climb the leaderboard. Every trip is a prize entry.'}
              </li>
            </ol>
          </div>

          <div className="flex flex-col items-center justify-center text-center">
            <div
              className="h-[120px] w-[120px]"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="mt-2 text-xs font-bold uppercase tracking-widest">
              {group ? `Scan to join ${group.name}` : 'Scan to join'}
            </p>
            {group ? (
              <p className="mt-1 font-mono text-base font-extrabold tracking-[0.15em] text-[#191A2E]">
                {group.invite_code}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#191A2E]/75 break-all">
                gogreenstreets.org/events/shift-your-summer
              </p>
            )}
          </div>
        </section>

        {/* Featured prizes */}
        {featuredPrizes.length > 0 && (
          <section className="mb-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-extrabold uppercase tracking-wider">
                What&apos;s at stake
              </h2>
              {totalPrizeValue > 0 && (
                <span className="text-sm font-bold text-[#191A2E]/75">
                  {formatDollars(totalPrizeValue)}+ in prizes
                </span>
              )}
            </div>

            {grandPrize && (
              <div className="mb-2 flex items-center gap-4 rounded-lg border-2 border-[#BAF14D] bg-[#BAF14D]/10 p-3">
                <div className="flex-1">
                  <span className="mb-1 inline-block rounded-full bg-[#BAF14D] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#191A2E]">
                    Grand Prize
                  </span>
                  <p className="mt-1 text-base font-extrabold leading-tight">
                    {grandPrize.description}
                  </p>
                  {brandLabel(grandPrize) && (
                    <p className="mt-0.5 text-sm text-[#191A2E]/75">From {brandLabel(grandPrize)}</p>
                  )}
                  {grandPrize.value_amount != null && grandPrize.value_amount > 0 && (
                    <p className="mt-0.5 text-sm font-bold text-[#191A2E]/60">
                      Value: {formatDollars(grandPrize.value_amount)}+
                    </p>
                  )}
                </div>
                {grandPrize.image_url && (
                  <div className="h-[85px] w-[85px] shrink-0 overflow-hidden rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={grandPrize.image_url}
                      alt={grandPrize.description}
                      className="h-full w-full scale-[1.6] translate-y-[-8%] object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            {otherFeatured.length > 0 && (
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] leading-snug">
                {otherFeatured.map(p => {
                  const brand = brandLabel(p)
                  return (
                    <li key={p.id} className="border-l-2 border-[#BAF14D] pl-3">
                      <p className="font-semibold">
                        {p.description}
                        {p.quantity > 1 && (
                          <span className="ml-1.5 text-sm font-normal text-[#191A2E]/60">
                            &middot; {p.quantity} winners
                          </span>
                        )}
                      </p>
                      {brand && (
                        <p className="text-sm text-[#191A2E]/75">From {brand}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

          </section>
        )}

        {/* Sponsors */}
        {sponsors.length > 0 && (
          <section className="mb-2">
            <h2 className="mb-1 font-display text-base font-extrabold uppercase tracking-wider">
              Made possible by
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {sponsors.slice(0, 8).map(s => (
                <div
                  key={s.id}
                  className="flex h-[44px] items-center justify-center rounded-md border border-[#191A2E]/10 bg-white px-2"
                >
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.logo_url}
                      alt={s.name}
                      className="max-h-[30px] max-w-[85%] object-contain"
                    />
                  ) : (
                    <span className="text-center text-xs font-semibold">{s.name}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-1.5 border-t border-[#191A2E]/15 pt-1 text-sm text-[#191A2E]/75">
          <p>
            Green Streets Initiative, a 501(c)(3) &middot; <strong>gogreenstreets.org/events/shift-your-summer</strong>
          </p>
          {group ? (
            <p className="mt-1">
              Join {group.name}&rsquo;s team &middot; <strong>gogreenstreets.org/events/shift-your-summer/share/{group.slug}</strong>
            </p>
          ) : (
            <p className="mt-1">
              Bring it to your team &middot; <strong>gogreenstreets.org/shift/employers</strong>
            </p>
          )}
        </footer>
      </article>
    </main>
  )
}
