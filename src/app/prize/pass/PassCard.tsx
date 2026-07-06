'use client'

import { useEffect, useState } from 'react'

// Public edge function — authenticated purely by the signed token in the body.
const PRIZE_PASS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/prize-pass`
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
// Universal link — opens the Shift app rewards screen if installed.
const CLAIM_LINK = 'https://shift.gogreenstreets.org/rewards'

type PrizeState = 'active' | 'claimed' | 'gone' | 'forfeited'

interface PrizeInfo {
  prize_description: string
  competition_name: string
  requires_fulfillment: boolean
}

async function callPrizePass(
  token: string,
  action: 'details' | 'forfeit',
): Promise<{ ok: boolean; state?: PrizeState; info?: PrizeInfo; error?: string }> {
  const res = await fetch(PRIZE_PASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ token, action }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? 'request_failed' }
  }
  return {
    ok: true,
    state: data.state,
    info: {
      prize_description: data.prize_description,
      competition_name: data.competition_name,
      requires_fulfillment: data.requires_fulfillment,
    },
  }
}

const cardClass =
  'rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8'
const primaryBtn =
  'block w-full rounded-xl bg-[#BAF14D] py-3.5 text-center font-display font-bold text-[#191A2E] transition hover:bg-[#a8e03c] disabled:opacity-40'
const secondaryBtn =
  'block w-full rounded-xl border border-white/20 py-3 text-center font-medium text-white/80 transition hover:bg-white/5 disabled:opacity-40'

export default function PassCard({ token }: { token: string | null }) {
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<PrizeState | null>(null)
  const [info, setInfo] = useState<PrizeInfo | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setInvalid(true)
      setLoading(false)
      return
    }
    let cancelled = false
    callPrizePass(token, 'details').then((r) => {
      if (cancelled) return
      if (!r.ok) {
        setInvalid(true)
      } else {
        setState(r.state ?? null)
        setInfo(r.info ?? null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleForfeit() {
    if (!token) return
    setSubmitting(true)
    setActionError(null)
    const r = await callPrizePass(token, 'forfeit')
    setSubmitting(false)
    if (!r.ok) {
      setActionError("Something went wrong. Please try again, or email info@gogreenstreets.org.")
      return
    }
    setState(r.state ?? null)
    if (r.info) setInfo(r.info)
    setConfirming(false)
  }

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cardClass}>
        <p className="text-[0.9375rem] leading-[1.6] text-white/75">Loading your prize…</p>
      </div>
    )
  }

  // ── Invalid / expired link ─────────────────────────────────
  if (invalid) {
    return (
      <div className={cardClass}>
        <h1 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
          This link isn&apos;t valid
        </h1>
        <p className="text-[0.9375rem] leading-[1.6] text-white/75">
          This prize link has expired or is incorrect. If you think this is a mistake,
          email{' '}
          <a href="mailto:info@gogreenstreets.org" className="text-[#BAF14D] underline">
            info@gogreenstreets.org
          </a>{' '}
          and we&apos;ll help.
        </p>
      </div>
    )
  }

  const prizeName = info?.prize_description ?? 'your prize'
  const competition = info?.competition_name ?? 'the competition'

  // ── Already claimed ────────────────────────────────────────
  if (state === 'claimed') {
    return (
      <div className={cardClass}>
        <h1 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
          You&apos;ve already claimed this 🎉
        </h1>
        <p className="text-[0.9375rem] leading-[1.6] text-white/75">
          Your <strong className="text-white">{prizeName}</strong> is all set. Open the Shift
          app any time to see the details.
        </p>
      </div>
    )
  }

  // ── Already passed on / redrawn ────────────────────────────
  if (state === 'gone') {
    return (
      <div className={cardClass}>
        <h1 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
          This prize has moved on
        </h1>
        <p className="text-[0.9375rem] leading-[1.6] text-white/75">
          It looks like this prize has already been passed on to another winner. Nothing
          more to do here — thanks for letting us know!
        </p>
      </div>
    )
  }

  // ── Just forfeited (success) ───────────────────────────────
  if (state === 'forfeited') {
    return (
      <div className={cardClass}>
        <h1 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
          Passed it on — thank you 💚
        </h1>
        <p className="text-[0.9375rem] leading-[1.6] text-white/75">
          We&apos;ve released <strong className="text-white">{prizeName}</strong> and are
          drawing a new winner. We appreciate you taking a moment to let us know instead of
          leaving it unclaimed.
        </p>
      </div>
    )
  }

  // ── Active: claim or pass on ───────────────────────────────
  return (
    <div className={cardClass}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
        You won a prize
      </div>
      <h1 className="mb-4 font-display text-2xl font-extrabold leading-[1.1] tracking-tight text-white">
        {prizeName}
      </h1>
      <p className="mb-8 text-[0.9375rem] leading-[1.6] text-white/75">
        Your name was drawn in <strong className="text-white">{competition}</strong>. It&apos;s
        still yours — {info?.requires_fulfillment
          ? 'open the Shift app to share your shipping details.'
          : 'open the Shift app to claim it.'}{' '}
        Not for you? You can pass it on and we&apos;ll draw someone new.
      </p>

      {!confirming ? (
        <div className="space-y-3">
          <a href={CLAIM_LINK} className={primaryBtn}>
            Claim my prize
          </a>
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => {
              setActionError(null)
              setConfirming(true)
            }}
          >
            No thanks — pass it on
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="mb-4 text-[0.9375rem] leading-[1.6] text-white/80">
            Pass on <strong className="text-white">{prizeName}</strong>? This can&apos;t be
            undone — we&apos;ll immediately draw a new winner in your place.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              className={primaryBtn}
              disabled={submitting}
              onClick={handleForfeit}
            >
              {submitting ? 'Passing it on…' : 'Yes, pass it on'}
            </button>
            <button
              type="button"
              className={secondaryBtn}
              disabled={submitting}
              onClick={() => setConfirming(false)}
            >
              Keep my prize
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <p className="mt-4 text-[0.875rem] leading-[1.5] text-[#FF8C35]">{actionError}</p>
      )}
    </div>
  )
}
