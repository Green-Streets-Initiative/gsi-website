'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CaretDown, CaretUp, Check, Warning } from '@phosphor-icons/react'
import SchoolRoutesMap from '@/components/shift/SchoolRoutesMap'
import { useReviewer } from './ReviewerGate'
import {
  CRITERIA,
  effectiveBike,
  effectiveWalk,
  routeColor,
  scoreTone,
  type CorridorReviewRow,
  type CriterionKey,
  type EditableFields,
  type ShortlistCorridor,
  type ShortlistScoredRow,
} from '@/lib/shortlist/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const inputCls =
  'w-full rounded-lg border border-[#E4E2D9] bg-white px-3 py-2 text-[14px] text-[#191A2E] placeholder:text-[#9CA3AF] focus:border-[#2966E5] focus:outline-none'
const selectCls =
  'rounded-lg border border-[#E4E2D9] bg-white px-2.5 py-1.5 text-[14px] text-[#191A2E] focus:border-[#2966E5] focus:outline-none'

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E4E2D9] bg-white p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[18px] font-extrabold tracking-tight text-[#191A2E]">
          {title}
        </h2>
        {hint && <span className="text-[12.5px] text-[#6B7280]">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-dm-mono)] text-[10.5px] uppercase tracking-[0.07em] text-[#6B7280]">
        {label}
      </div>
      <div className="text-[14.5px] font-semibold text-[#191A2E]">{value ?? '—'}</div>
    </div>
  )
}

function reviewChip(review: CorridorReviewRow | undefined) {
  if (!review) return { label: 'Not reviewed yet', cls: 'bg-[#EDEBE2] text-[#4A4D68]' }
  if (review.verdict === 'agree') return { label: 'You agreed', cls: 'bg-[#DCF3E6] text-[#1F6B45]' }
  const s = [
    review.suggested_walk_score !== null ? `walk ${review.suggested_walk_score}` : null,
    review.suggested_bike_score !== null ? `bike ${review.suggested_bike_score}` : null,
  ]
    .filter(Boolean)
    .join(', ')
  if (review.status === 'applied') return { label: `Applied by Keith (${s})`, cls: 'bg-[#DCF3E6] text-[#1F6B45]' }
  if (review.status === 'declined') return { label: `Keith kept the original (${s})`, cls: 'bg-[#EDEBE2] text-[#4A4D68]' }
  return { label: `Suggested ${s} · waiting for Keith`, cls: 'bg-[#FEF3C7] text-[#92400E]' }
}

export default function SchoolWorkspace({
  row: initialRow,
  corridors,
  reviews,
}: {
  row: ShortlistScoredRow
  corridors: ShortlistCorridor[]
  reviews: CorridorReviewRow[]
}) {
  const { reviewer, request } = useReviewer()
  const [row, setRow] = useState(initialRow)
  const [save, setSave] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showResearch, setShowResearch] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<{ tone: 'ok' | 'warn'; text: string; items?: string[] } | null>(null)

  // ── Autosave: collect field edits, flush after 800 ms ────────────────
  const pendingRef = useRef<Partial<EditableFields>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    const fields = pendingRef.current
    pendingRef.current = {}
    if (Object.keys(fields).length === 0) return
    setSave('saving')
    const res = await request<{ ok: boolean; row: ShortlistScoredRow }>(
      `/api/volunteer-guide/shortlist/${row.school_id}`,
      { fields },
      'PATCH',
    )
    if (res.ok && res.data.row) {
      // Server row carries recomputed totals; keep anything typed since.
      setRow((cur) => ({ ...res.data.row, ...pendingRef.current, updated_at: res.data.row.updated_at }))
      setSave('saved')
      setSaveError(null)
    } else if (!res.ok) {
      pendingRef.current = { ...fields, ...pendingRef.current }
      setSave('error')
      setSaveError(res.error)
    }
  }, [request, row.school_id])

  const edit = useCallback(
    (fields: Partial<EditableFields>) => {
      setRow((cur) => ({ ...cur, ...fields }))
      pendingRef.current = { ...pendingRef.current, ...fields }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, 800)
    },
    [flush],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // ── Derived ──────────────────────────────────────────────────────────
  const active = useMemo(() => corridors.filter((c) => !c.excluded_at), [corridors])
  const setAside = useMemo(() => corridors.filter((c) => !!c.excluded_at), [corridors])
  const latestReview = useMemo(() => {
    const m = new Map<string, CorridorReviewRow>()
    for (const r of reviews) if (!m.has(r.corridor_id)) m.set(r.corridor_id, r)
    return m
  }, [reviews])
  const reviewedCount = active.filter((c) => latestReview.has(c.id)).length
  const mapRoutes = useMemo(
    () => active.map((c) => ({ id: c.id, name: c.name, waypoints: c.waypoints ?? [] })),
    [active],
  )

  function prefillOf(key: CriterionKey): number | null {
    if (key === 'pto') return null
    return row[`prefill_${key}` as keyof ShortlistScoredRow] as number | null
  }
  function overrideOf(key: CriterionKey): number | null {
    if (key === 'pto') return row.pto_score
    return row[`override_${key}` as keyof ShortlistScoredRow] as number | null
  }
  function noteOf(key: CriterionKey): string {
    if (key === 'pto') return ''
    return (row[`override_${key}_note` as keyof ShortlistScoredRow] as string | null) ?? ''
  }
  function sourceHint(key: CriterionKey): string {
    if (key === 'sidewalks') {
      return row.ai_walk_avg === null
        ? 'no route analysis for this school'
        : `route analysis: average walk score ${row.ai_walk_avg} over ${row.routes_analyzed} routes`
    }
    if (key === 'walkshed') {
      return row.routes_analyzed === null
        ? 'no route analysis for this school'
        : `route analysis: ${row.routes_analyzed} routes, lowest walk score ${row.min_walk}`
    }
    if (key === 'pto') return 'your call — see the PTO notes below'
    return 'from public data (see desk research)'
  }

  async function submit() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      await flush()
    }
    setSubmitting(true)
    setSubmitMsg(null)
    const res = await request<{ ok: boolean; row: ShortlistScoredRow }>(
      `/api/volunteer-guide/shortlist/${row.school_id}/submit`,
      {},
    )
    setSubmitting(false)
    if (res.ok) {
      setRow((cur) => ({ ...cur, ...res.data.row }))
      setSubmitMsg({ tone: 'ok', text: 'Submitted. Keith will see it on his punchlist. You can still edit; edits show as "edited after submit".' })
    } else {
      const missing = (res.data as { missing?: string[] } | undefined)?.missing
      setSubmitMsg({ tone: 'warn', text: res.error, items: missing })
    }
  }

  const submitted = row.volunteer_status === 'submitted'
  const editedAfterSubmit = submitted && !!row.submitted_at && row.updated_at > row.submitted_at

  return (
    <div className="pt-6">
      <Link
        href="/volunteer/guide/shortlist"
        className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#4A4D68] no-underline hover:text-[#2966E5]"
      >
        <ArrowLeft size={14} weight="bold" /> All schools
      </Link>

      {/* Header */}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 font-[family-name:var(--font-bricolage)] text-[clamp(24px,4vw,32px)] font-extrabold tracking-tight text-[#191A2E]">
            {row.school_name}
          </h1>
          <p className="m-0 mt-1 text-[14px] text-[#4A4D68]">
            {row.district ?? row.city}
            {row.grades ? ` · ${row.grades}` : ''}
            {row.enrollment ? ` · ${row.enrollment} students` : ''}
            {row.rank ? ` · ranked #${row.rank}` : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="font-[family-name:var(--font-dm-mono)] text-[28px] font-bold leading-none text-[#191A2E]">
            {row.total}
            <span className="text-[14px] font-medium text-[#6B7280]">/12</span>
          </div>
          <div className="mt-1 text-[12px] text-[#6B7280]">
            {row.criteria_missing > 0 ? `${row.criteria_missing} criteria still to score` : 'all six criteria scored'}
          </div>
          <div className="mt-1 text-[12px]">
            {save === 'saving' && <span className="text-[#6B7280]">Saving…</span>}
            {save === 'saved' && <span className="text-[#1F6B45]">Saved</span>}
            {save === 'error' && <span className="text-[#B91C1C]">Couldn&rsquo;t save: {saveError}</span>}
          </div>
        </div>
      </div>

      {row.shared_assessment_school_id && (
        <div className="mt-4 rounded-r-xl border-l-4 border-[#2966E5] bg-[#DEE9FC] px-4 py-3 text-[14px] text-[#1D4FB0]">
          This school shares a campus with another shortlisted school, so the route analysis below is the same set of routes. Score it on its own merits; a route review made here counts for both.
        </div>
      )}

      <div className="mt-5 grid gap-4">
        {/* Facts */}
        <Card title="Facts" hint="prefilled from public data — tell Keith if anything is wrong">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 md:grid-cols-6">
            <Fact label="Enrollment" value={row.enrollment} />
            <Fact label="Title I" value={row.title_i === null ? '—' : row.title_i ? 'Yes' : 'No'} />
            <Fact label="Low income" value={row.econ_disadv_pct === null ? '—' : `${row.econ_disadv_pct}%`} />
            <Fact label="EJ area" value={row.ej_block_group === null ? '—' : row.ej_block_group ? 'Yes' : 'No'} />
            <Fact label="SRTS partner" value={row.srts_partner === null ? '—' : row.srts_partner ? 'Yes' : 'No'} />
            <Fact label="Grades" value={row.grades} />
          </div>
          {row.research_notes && (
            <div className="mt-4">
              <button
                onClick={() => setShowResearch((v) => !v)}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2966E5]"
              >
                {showResearch ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
                Desk research &amp; sources
              </button>
              {showResearch && (
                <p className="mt-2 mb-0 rounded-lg bg-[#F8F7F2] px-4 py-3 text-[13.5px] leading-relaxed text-[#374151]">
                  {row.research_notes}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Scorecard */}
        <Card title="Scorecard" hint="six criteria, 0–2 each. Override anything with a reason.">
          <div className="grid gap-3">
            {CRITERIA.map((c) => {
              const prefill = prefillOf(c.key)
              const override = overrideOf(c.key)
              const effective = row[`score_${c.key}` as keyof ShortlistScoredRow] as number | null
              const isPto = c.key === 'pto'
              const overridden = !isPto && override !== null
              return (
                <div
                  key={c.key}
                  className={`grid gap-2 rounded-lg border px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center ${
                    overridden ? 'border-[#F59E0B] bg-[#FFFBEB]' : 'border-[#EDEBE2]'
                  }`}
                >
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[15px] font-semibold text-[#191A2E]">{c.label}</span>
                      <span className="font-[family-name:var(--font-dm-mono)] text-[18px] font-bold text-[#191A2E]">
                        {effective ?? '—'}
                      </span>
                      {overridden && (
                        <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#92400E]">
                          your override · prefill was {prefill ?? '—'}
                        </span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-[#6B7280]">
                      {c.help} <span className="text-[#4A4D68]">({sourceHint(c.key)})</span>
                    </div>
                    {overridden && (
                      <input
                        value={noteOf(c.key)}
                        onChange={(e) => edit({ [`override_${c.key}_note`]: e.target.value } as Partial<EditableFields>)}
                        placeholder="Why? (required) — e.g. Street View is out of date on Broadway"
                        className={`${inputCls} mt-2`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    {isPto ? (
                      <select
                        value={row.pto_score ?? ''}
                        onChange={(e) => edit({ pto_score: e.target.value === '' ? null : Number(e.target.value) })}
                        className={selectCls}
                      >
                        <option value="">— not scored</option>
                        <option value="0">0 · no trace online</option>
                        <option value="1">1 · exists but quiet</option>
                        <option value="2">2 · visibly active</option>
                      </select>
                    ) : (
                      <select
                        value={override ?? ''}
                        onChange={(e) =>
                          edit({
                            [`override_${c.key}`]: e.target.value === '' ? null : Number(e.target.value),
                            ...(e.target.value === '' ? { [`override_${c.key}_note`]: null } : {}),
                          } as Partial<EditableFields>)
                        }
                        className={selectCls}
                      >
                        <option value="">Use prefill ({prefill ?? '—'})</option>
                        <option value="0">Override → 0</option>
                        <option value="1">Override → 1</option>
                        <option value="2">Override → 2</option>
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* PTO */}
        <Card title="PTO activity" hint="website, Facebook page, recent events or fundraisers">
          <textarea
            value={row.pto_activity ?? ''}
            onChange={(e) => edit({ pto_activity: e.target.value })}
            rows={3}
            placeholder="What you found — links welcome. No trace online = 0, exists but quiet = 1, visibly active = 2."
            className={inputCls}
          />
        </Card>

        {/* Contacts */}
        <Card title="Contacts" hint="top 8 need at least a named principal with an email">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-[#4A4D68]">Principal</span>
              <input value={row.principal_name ?? ''} onChange={(e) => edit({ principal_name: e.target.value })} placeholder="Name" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-[#4A4D68]">Principal email</span>
              <input value={row.principal_email ?? ''} onChange={(e) => edit({ principal_email: e.target.value })} placeholder="name@district.org" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-[#4A4D68]">PE / wellness lead</span>
              <input value={row.pe_wellness_lead ?? ''} onChange={(e) => edit({ pe_wellness_lead: e.target.value })} placeholder="Name, email" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-[#4A4D68]">PTO contact</span>
              <input value={row.pto_contact ?? ''} onChange={(e) => edit({ pto_contact: e.target.value })} placeholder="Name, email or page" className={inputCls} />
            </label>
          </div>
        </Card>

        {/* Why this school */}
        <Card title="Why this school" hint="top 5 only — one short paragraph Keith can open outreach with">
          <textarea
            value={row.why_this_school ?? ''}
            onChange={(e) => edit({ why_this_school: e.target.value })}
            rows={4}
            placeholder="The case for this school in a few sentences."
            className={inputCls}
          />
        </Card>

        {/* Routes */}
        <Card
          title="Route analysis"
          hint={
            row.assessment_id
              ? `${reviewedCount} of ${active.length} routes reviewed`
              : undefined
          }
        >
          {!row.assessment_id ? (
            <div className="flex items-start gap-2 rounded-lg bg-[#FEF3C7] px-4 py-3 text-[14px] text-[#92400E]">
              <Warning size={18} weight="bold" className="mt-0.5 shrink-0" />
              <span>
                No route analysis for this school. {row.school_name.includes('Winter Hill') ? 'Its building is closed and students are in temporary space — confirm where they report before anything else. ' : ''}
                Score Sidewalks and Walkshed by overriding them above, with a reason.
              </span>
            </div>
          ) : (
            <>
              <p className="mt-0 mb-3 text-[13.5px] text-[#4A4D68]">
                Our analyzer mapped these walking routes, checked them against state crash
                data, and scored each 1–10 from Street View. Open each route, look at the
                photos, and either agree or suggest a corrected score. Be most skeptical of
                generous scores on busy multi-lane roads.
              </p>
              {mapRoutes.length > 0 && (
                <SchoolRoutesMap
                  routes={mapRoutes}
                  schoolName={row.school_name}
                  selectedId={selectedRoute}
                  onSelect={setSelectedRoute}
                  colorFor={(_, i) => routeColor(i)}
                />
              )}
              <div className="mt-3 grid gap-2">
                {active.map((c, i) => {
                  const w = effectiveWalk(c)
                  const b = effectiveBike(c)
                  const chip = reviewChip(latestReview.get(c.id))
                  const adjusted = c.final_walk_score !== null || c.final_bike_score !== null
                  return (
                    <Link
                      key={c.id}
                      href={`/volunteer/guide/shortlist/${row.school_id}/routes/${c.id}`}
                      onMouseEnter={() => setSelectedRoute(c.id)}
                      onMouseLeave={() => setSelectedRoute(null)}
                      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 no-underline transition ${
                        selectedRoute === c.id ? 'border-[#2966E5] bg-[#F8FAFF]' : 'border-[#EDEBE2] hover:border-[#2966E5]'
                      }`}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-dm-mono)] text-[12px] font-bold text-white"
                        style={{ background: routeColor(i) }}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="min-w-[160px] flex-1">
                        <span className="block text-[14.5px] font-semibold text-[#191A2E]">{c.name}</span>
                        <span className="block text-[12.5px] text-[#6B7280]">
                          {c.distance_miles?.toFixed(1)} mi · {c.estimated_walk_minutes} min walk
                          {(c.crash_flags?.length ?? 0) > 0 && ` · ${c.crash_flags!.length} crash cluster${c.crash_flags!.length === 1 ? '' : 's'}`}
                        </span>
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${scoreTone(w).bg} ${scoreTone(w).text}`}>
                        Walk {w ?? '—'}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${scoreTone(b).bg} ${scoreTone(b).text}`}>
                        Bike {b ?? '—'}
                      </span>
                      {adjusted && (
                        <span className="rounded-full bg-[#DEE9FC] px-2 py-0.5 text-[11px] font-semibold text-[#1D4FB0]">
                          Keith adjusted
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${chip.cls}`}>{chip.label}</span>
                    </Link>
                  )
                })}
              </div>
              {setAside.length > 0 && (
                <p className="mb-0 mt-3 text-[12.5px] text-[#6B7280]">
                  {setAside.length} route{setAside.length === 1 ? '' : 's'} set aside by Keith (not reviewed, not published):{' '}
                  {setAside.map((c) => c.name).join(', ')}.
                </p>
              )}
            </>
          )}
        </Card>

        {/* Submit */}
        <section className="rounded-xl border border-[#E4E2D9] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[18px] font-extrabold tracking-tight text-[#191A2E]">
                {submitted ? 'Submitted' : 'Done with this school?'}
              </h2>
              <p className="m-0 mt-1 text-[13.5px] text-[#4A4D68]">
                {submitted
                  ? `Submitted ${row.submitted_by ? `by ${row.submitted_by} ` : ''}on ${new Date(row.submitted_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.${editedAfterSubmit ? ' Edited since — Keith will see the new version.' : ''}${row.reviewed_at ? ' Keith has read it.' : ''}`
                  : 'Everything saves as you type. Submitting tells Keith this school is ready to read. Needs a PTO score and a reason for each override.'}
              </p>
            </div>
            <button
              onClick={submit}
              disabled={submitting || !reviewer}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[14px] font-semibold disabled:opacity-50 ${
                submitted ? 'bg-[#EDEBE2] text-[#4A4D68]' : 'bg-[#2966E5] text-white hover:bg-[#2159c7]'
              }`}
            >
              {submitted && <Check size={14} weight="bold" />}
              {submitting ? 'Submitting…' : submitted ? 'Re-submit' : 'Submit to Keith'}
            </button>
          </div>
          {submitMsg && (
            <div
              className={`mt-3 rounded-lg px-4 py-3 text-[13.5px] ${
                submitMsg.tone === 'ok' ? 'bg-[#DCF3E6] text-[#1F6B45]' : 'bg-[#FEF3C7] text-[#92400E]'
              }`}
            >
              {submitMsg.text}
              {submitMsg.items && submitMsg.items.length > 0 && (
                <ul className="mb-0 mt-1 list-disc pl-5">
                  {submitMsg.items.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
