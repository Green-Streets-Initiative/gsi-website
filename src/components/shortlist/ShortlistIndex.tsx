'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Check } from '@phosphor-icons/react'
import { useReviewer } from './ReviewerGate'
import { type ShortlistScoredRow } from '@/lib/shortlist/types'

function StatusChip({ row }: { row: ShortlistScoredRow }) {
  if (row.volunteer_status === 'submitted') {
    const edited = row.submitted_at && row.updated_at > row.submitted_at
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#DCF3E6] px-2 py-0.5 text-[11.5px] font-semibold text-[#1F6B45]">
        <Check size={11} weight="bold" /> {edited ? 'Submitted · edited' : 'Submitted'}
      </span>
    )
  }
  if (row.volunteer_status === 'in_progress') {
    return (
      <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11.5px] font-semibold text-[#92400E]">
        In progress
      </span>
    )
  }
  return (
    <span className="rounded-full bg-[#EDEBE2] px-2 py-0.5 text-[11.5px] font-semibold text-[#4A4D68]">
      Not started
    </span>
  )
}

export default function ShortlistIndex({ rows }: { rows: ShortlistScoredRow[] }) {
  const { reviewer, request } = useReviewer()
  const [ranking, setRanking] = useState(false)
  const [order, setOrder] = useState<ShortlistScoredRow[]>(rows)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const submitted = rows.filter((r) => r.volunteer_status === 'submitted').length
  const reviewsPending = rows.reduce((s, r) => s + (r.reviews_pending ?? 0), 0)
  const hasRanks = rows.some((r) => r.rank !== null)

  const list = useMemo(() => (ranking ? order : rows), [ranking, order, rows])

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }

  async function saveRanking() {
    setSaving(true)
    setMsg(null)
    const res = await request('/api/volunteer-guide/shortlist/ranking', {
      order: order.map((r) => r.school_id),
    })
    setSaving(false)
    if (res.ok) {
      setMsg('Ranking saved.')
      setRanking(false)
      window.location.reload()
    } else {
      setMsg(res.error)
    }
  }

  return (
    <div className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[62ch]">
          <span className="inline-block font-[family-name:var(--font-dm-mono)] text-[11.5px] font-medium uppercase tracking-[0.09em] bg-[#191A2E] text-[#BAF14D] px-2.5 py-1 rounded">
            Project 1 · Build the school shortlist
          </span>
          <h1 className="font-[family-name:var(--font-bricolage)] text-[clamp(24px,4vw,30px)] font-extrabold tracking-tight text-[#191A2E] mt-3 mb-1.5">
            {rows.length} candidate schools
          </h1>
          <p className="m-0 text-[14.5px] text-[#4A4D68]">
            Open a school to check its facts, score it, add contacts, and review its
            routes. Submit each one when you&rsquo;re done; Keith reads every
            submission and every route suggestion. Six criteria, 0–2 each, out of 12.
          </p>
        </div>
        <div className="text-right">
          <div className="font-[family-name:var(--font-dm-mono)] text-[13px] text-[#4A4D68]">
            {submitted} / {rows.length} submitted
            {reviewsPending > 0 && ` · ${reviewsPending} route suggestion${reviewsPending === 1 ? '' : 's'} waiting for Keith`}
          </div>
          <div className="mt-1.5 h-2 w-48 overflow-hidden rounded-full bg-[#E4E2D9]">
            <div
              className="h-full rounded-full bg-[#52B788]"
              style={{ width: `${rows.length ? (submitted / rows.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13.5px] text-[#6B7280]">
          {ranking
            ? 'Move schools up or down, then save. Your order outranks the totals.'
            : hasRanks
              ? 'Ordered by your ranking. Totals are a starting point, not a verdict.'
              : 'Ordered by total until you set a ranking.'}
        </p>
        <div className="flex items-center gap-2">
          {msg && <span className="text-[13px] text-[#4A4D68]">{msg}</span>}
          {ranking ? (
            <>
              <button
                onClick={() => {
                  setRanking(false)
                  setOrder(rows)
                }}
                className="rounded-lg bg-[#EDEBE2] px-3.5 py-1.5 text-[13px] font-semibold text-[#4A4D68]"
              >
                Cancel
              </button>
              <button
                onClick={saveRanking}
                disabled={saving || !reviewer}
                className="rounded-lg bg-[#2966E5] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#2159c7] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save ranking'}
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setOrder(rows)
                setRanking(true)
              }}
              className="rounded-lg bg-[#DEE9FC] px-3.5 py-1.5 text-[13px] font-semibold text-[#1D4FB0] hover:bg-[#cfdffb]"
            >
              {hasRanks ? 'Reorder ranking' : 'Set the ranking'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-[#E4E2D9] bg-white">
        <table className="w-full min-w-[760px] border-collapse text-[14px]">
          <thead>
            <tr className="bg-[#F8F7F2] text-left font-[family-name:var(--font-dm-mono)] text-[11px] uppercase tracking-[0.06em] text-[#4A4D68]">
              <th className="px-3 py-2.5 w-12">#</th>
              <th className="px-3 py-2.5">School</th>
              <th className="px-3 py-2.5 text-center">Total</th>
              <th className="px-3 py-2.5 text-center" title="Average walking score across analyzed routes, 1–10">Walk avg</th>
              <th className="px-3 py-2.5 text-center">Routes</th>
              <th className="px-3 py-2.5 text-center">PTO</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-center" title="Why this school (top 5)">Why</th>
              {ranking && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const rankLabel = ranking ? i + 1 : r.rank ?? '—'
              const top5 = (ranking ? i + 1 : r.rank ?? 99) <= 5
              return (
                <tr key={r.school_id} className="border-t border-[#EDEBE2] hover:bg-[#F8F7F2]">
                  <td className="px-3 py-2.5 font-[family-name:var(--font-dm-mono)] text-[13px] text-[#4A4D68]">
                    {rankLabel}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/volunteer/guide/shortlist/${r.school_id}`}
                      className="font-semibold text-[#191A2E] no-underline hover:text-[#2966E5]"
                    >
                      {r.school_name}
                    </Link>
                    <div className="text-[12.5px] text-[#6B7280]">
                      {r.district ?? r.city}
                      {r.grades ? ` · ${r.grades}` : ''}
                      {r.shared_assessment_school_id ? ' · shares a campus' : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="font-[family-name:var(--font-dm-mono)] text-[15px] font-bold text-[#191A2E]">
                      {r.total}
                    </span>
                    <span className="text-[12px] text-[#6B7280]">/12</span>
                    {r.criteria_missing > 0 && (
                      <div className="text-[11px] text-[#92400E]">
                        {r.criteria_missing} to score
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center font-[family-name:var(--font-dm-mono)] text-[13px] text-[#191A2E]">
                    {r.ai_walk_avg ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center text-[13px] text-[#4A4D68]">
                    {r.routes_analyzed === null ? (
                      <span className="text-[#92400E]">not analyzed</span>
                    ) : (
                      <>
                        {r.routes_analyzed}
                        {(r.routes_near_crashes ?? 0) > 0 && (
                          <span className="text-[#6B7280]"> · {r.routes_near_crashes} near crashes</span>
                        )}
                        {r.reviews_total > 0 && (
                          <div className="text-[11px] text-[#6B7280]">{r.reviews_total} reviewed</div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center font-[family-name:var(--font-dm-mono)] text-[13px] text-[#191A2E]">
                    {r.pto_score ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusChip row={r} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.why_this_school ? (
                      <Check size={15} weight="bold" className="inline text-[#1F6B45]" />
                    ) : top5 ? (
                      <span className="text-[11px] text-[#92400E]">needed</span>
                    ) : (
                      <span className="text-[#C4C2B8]">—</span>
                    )}
                  </td>
                  {ranking && (
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="rounded-md border border-[#E4E2D9] p-1 text-[#4A4D68] hover:bg-[#F8F7F2] disabled:opacity-30"
                      >
                        <ArrowUp size={14} weight="bold" />
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === order.length - 1}
                        aria-label="Move down"
                        className="ml-1 rounded-md border border-[#E4E2D9] p-1 text-[#4A4D68] hover:bg-[#F8F7F2] disabled:opacity-30"
                      >
                        <ArrowDown size={14} weight="bold" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12.5px] text-[#6B7280]">
        Under-served, SRTS and Grades were prefilled from public data; Sidewalks and
        Walkshed come straight from the route analysis and update the moment Keith
        applies one of your route suggestions. You can override any of them on the
        school page — with a reason.
      </p>
    </div>
  )
}
