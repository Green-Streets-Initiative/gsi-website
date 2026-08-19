'use client'

import { useEffect, useState } from 'react'

// Public edge function — authenticated purely by the signed token in the body.
const PRIZE_DONOR_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/prize-donor`
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

interface DetailRow {
  label: string
  value: string
}

interface SubmittedUnit {
  unit_id: string
  unit_index: number
  status: string | null
  winner_name: string
  detail_rows: DetailRow[]
  tracking_number: string | null
  shipped_at: string | null
  received: boolean
}

interface WaitingUnit {
  unit_index: number
  winner_name: string
  drawn_at: string | null
}

interface DonorPrize {
  prize_id: string
  description: string
  competition_name: string | null
  units: SubmittedUnit[]
  waiting: WaitingUnit[]
  undrawn_count: number
}

async function callPrizeDonor(
  token: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; sponsor_name?: string | null; prizes?: DonorPrize[]; error?: string }> {
  const res = await fetch(PRIZE_DONOR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ token, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) return { ok: false, error: data.error ?? 'request_failed' }
  return data
}

const cardClass = 'rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-6 md:p-8'
const primaryBtn =
  'rounded-xl bg-[#BAF14D] px-5 py-3 text-center font-display font-bold text-[#191A2E] transition hover:bg-[#a8e03c] disabled:opacity-40'

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

function UnitCard({
  unit,
  onShipped,
  token,
}: {
  unit: SubmittedUnit
  token: string
  onShipped: (unitId: string, tracking: string) => void
}) {
  const [tracking, setTracking] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function markShipped() {
    setSubmitting(true)
    setError(null)
    const r = await callPrizeDonor(token, {
      action: 'mark_shipped',
      unit_id: unit.unit_id,
      tracking_number: tracking.trim() || undefined,
    })
    setSubmitting(false)
    if (!r.ok) {
      setError('Something went wrong — please try again, or just reply to our email.')
      return
    }
    onShipped(unit.unit_id, tracking.trim())
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
      <p className="mb-3 font-display text-lg font-bold text-white">{unit.winner_name}</p>
      <dl className="mb-4 space-y-2">
        {unit.detail_rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {row.label}
            </dt>
            <dd className="whitespace-pre-line text-[0.9375rem] leading-[1.55] text-white/90">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Tracking number (optional)"
          className="flex-1 rounded-xl border border-white/20 bg-white/[0.06] px-4 py-3 text-[0.9375rem] text-white placeholder:text-white/60 focus:border-[#BAF14D] focus:outline-none"
        />
        <button type="button" className={primaryBtn} disabled={submitting} onClick={markShipped}>
          {submitting ? 'Saving…' : 'Mark shipped'}
        </button>
      </div>
      {error && <p className="mt-3 text-[0.875rem] leading-[1.5] text-[#FF8C35]">{error}</p>}
    </div>
  )
}

export default function ShipList({ token }: { token: string | null }) {
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [sponsorName, setSponsorName] = useState<string | null>(null)
  const [prizes, setPrizes] = useState<DonorPrize[]>([])

  useEffect(() => {
    if (!token) {
      setInvalid(true)
      setLoading(false)
      return
    }
    let cancelled = false
    callPrizeDonor(token, { action: 'list' }).then((r) => {
      if (cancelled) return
      if (!r.ok) {
        setInvalid(true)
      } else {
        setSponsorName(r.sponsor_name ?? null)
        setPrizes(r.prizes ?? [])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  function handleShipped(unitId: string, tracking: string) {
    setPrizes((prev) =>
      prev.map((p) => ({
        ...p,
        units: p.units.map((u) =>
          u.unit_id === unitId
            ? {
                ...u,
                status: 'shipped',
                tracking_number: tracking || u.tracking_number,
                shipped_at: u.shipped_at ?? new Date().toISOString(),
              }
            : u,
        ),
      })),
    )
  }

  if (loading) {
    return (
      <div className={cardClass}>
        <p className="text-[0.9375rem] leading-[1.6] text-white/75">Loading your winners…</p>
      </div>
    )
  }

  if (invalid) {
    return (
      <div className={cardClass}>
        <h1 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
          This link isn&apos;t valid
        </h1>
        <p className="text-[0.9375rem] leading-[1.6] text-white/75">
          This fulfillment link has expired or is incorrect. Reply to the email you received
          from Green Streets Initiative for a fresh one, or write to{' '}
          <a href="mailto:info@gogreenstreets.org" className="text-[#BAF14D] underline">
            info@gogreenstreets.org
          </a>
          .
        </p>
      </div>
    )
  }

  const needsShipping = prizes.flatMap((p) =>
    p.units.filter((u) => u.status === 'submitted').map((u) => ({ prize: p, unit: u })),
  )
  const shipped = prizes.flatMap((p) =>
    p.units.filter((u) => u.status !== 'submitted').map((u) => ({ prize: p, unit: u })),
  )
  const waiting = prizes.flatMap((p) => p.waiting.map((w) => ({ prize: p, w })))
  const undrawnTotal = prizes.reduce((n, p) => n + p.undrawn_count, 0)
  const competitionName = prizes.find((p) => p.competition_name)?.competition_name

  return (
    <div className="space-y-8">
      <header>
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
          Prize fulfillment
        </div>
        <h1 className="mb-3 font-display text-2xl font-extrabold leading-[1.15] tracking-tight text-white md:text-3xl">
          {sponsorName ? `${sponsorName} × Green Streets` : 'Your donated prizes'}
        </h1>
        <p className="text-[0.9375rem] leading-[1.6] text-white/75">
          Winners of the prizes you donated{competitionName ? ` to ${competitionName}` : ''} and
          their shipping details. Mark each prize shipped as you send it — winners are notified
          automatically, and this page always shows the latest. Questions? Email{' '}
          <a href="mailto:info@gogreenstreets.org" className="text-[#BAF14D] underline">
            info@gogreenstreets.org
          </a>
          .
        </p>
      </header>

      {needsShipping.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg font-bold text-white">
            Ready to ship ({needsShipping.length})
          </h2>
          <div className="space-y-4">
            {needsShipping.map(({ prize, unit }) => (
              <div key={unit.unit_id}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/70">
                  {prize.description}
                </p>
                <UnitCard unit={unit} token={token as string} onShipped={handleShipped} />
              </div>
            ))}
          </div>
        </section>
      )}

      {needsShipping.length === 0 && shipped.length === 0 && waiting.length === 0 && (
        <div className={cardClass}>
          <p className="text-[0.9375rem] leading-[1.6] text-white/75">
            No winners yet — as soon as someone wins one of your prizes and shares their
            shipping details, they&apos;ll appear here.
          </p>
        </div>
      )}

      {waiting.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg font-bold text-white">
            Waiting on winners ({waiting.length})
          </h2>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
            <ul className="space-y-2">
              {waiting.map(({ prize, w }) => (
                <li
                  key={`${prize.prize_id}-${w.unit_index}`}
                  className="text-[0.9375rem] leading-[1.6] text-white/75"
                >
                  <strong className="text-white/90">{w.winner_name}</strong> won a{' '}
                  {prize.description}
                  {w.drawn_at ? ` on ${fmtDate(w.drawn_at)}` : ''} — we&apos;re collecting their
                  shipping address and it&apos;ll appear here.
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {shipped.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg font-bold text-white">
            Shipped ({shipped.length})
          </h2>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
            <ul className="space-y-3">
              {shipped.map(({ prize, unit }) => (
                <li key={unit.unit_id} className="text-[0.9375rem] leading-[1.6] text-white/75">
                  <strong className="text-white/90">{unit.winner_name}</strong> —{' '}
                  {prize.description}
                  {unit.shipped_at ? `, shipped ${fmtDate(unit.shipped_at)}` : ''}
                  {unit.tracking_number ? `, tracking ${unit.tracking_number}` : ''}
                  {unit.received && (
                    <span className="ml-2 text-[#BAF14D]">✓ winner confirmed receipt</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {undrawnTotal > 0 && (
        <p className="text-[0.875rem] leading-[1.6] text-white/70">
          {undrawnTotal} more of your donated {undrawnTotal === 1 ? 'prize hasn' : 'prizes haven'}
          &apos;t been drawn yet — winners will show up here after each drawing.
        </p>
      )}
    </div>
  )
}
