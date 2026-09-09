'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Warning } from '@phosphor-icons/react'
import VolunteerRouteMap from '@/components/volunteer-route/VolunteerRouteMap'
import PhotoLightbox from '@/components/walk-audit/PhotoLightbox'
import { useReviewer } from './ReviewerGate'
import {
  effectiveBike,
  effectiveWalk,
  routeColor,
  scoreTone,
  scoreWord,
  type CorridorImage,
  type CorridorReviewRow,
  type ShortlistCorridor,
  type ShortlistScoredRow,
} from '@/lib/shortlist/types'

function Bar({ label, score }: { label: string; score: number | null }) {
  const tone = scoreTone(score)
  const fill = score === null ? 'bg-gray-300' : score >= 7 ? 'bg-green-500' : score >= 4 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[12.5px] text-[#4A4D68]">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EDEBE2]">
        {score !== null && <div className={`h-full rounded-full ${fill}`} style={{ width: `${(score / 10) * 100}%` }} />}
      </div>
      <span className={`w-8 shrink-0 text-right font-[family-name:var(--font-dm-mono)] text-[14px] font-bold ${tone.text}`}>
        {score ?? '—'}
      </span>
      <span className="w-28 shrink-0 text-[12px] text-[#6B7280]">{scoreWord(score)}</span>
    </div>
  )
}

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1)

export default function RouteReview({
  row,
  corridor,
  index,
  images,
  reviews,
  siblings,
}: {
  row: ShortlistScoredRow
  corridor: ShortlistCorridor
  index: number
  images: CorridorImage[]
  reviews: CorridorReviewRow[]
  siblings: { id: string; name: string }[]
}) {
  const { reviewer, request } = useReviewer()
  const mine = useMemo(
    () => reviews.find((r) => r.reviewer_name === reviewer) ?? reviews[0] ?? null,
    [reviews, reviewer],
  )
  const [review, setReview] = useState<CorridorReviewRow | null>(mine)
  useEffect(() => setReview(mine), [mine])

  const walkNow = effectiveWalk(corridor)
  const bikeNow = effectiveBike(corridor)
  const [verdict, setVerdict] = useState<'agree' | 'adjust'>(mine?.verdict ?? 'agree')
  const [walk, setWalk] = useState<string>(String(mine?.suggested_walk_score ?? walkNow ?? ''))
  const [bike, setBike] = useState<string>(String(mine?.suggested_bike_score ?? bikeNow ?? ''))
  const [note, setNote] = useState(mine?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    if (lightbox === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? i : Math.min(images.length - 1, i + 1)))
      if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? i : Math.max(0, i - 1)))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightbox, images.length])

  const color = routeColor(index)
  const letter = String.fromCharCode(65 + index)
  const excluded = !!corridor.excluded_at
  const concerns = (corridor.ai_flags ?? []).filter((f) => f.type !== 'positive')
  const positives = (corridor.ai_flags ?? []).filter((f) => f.type === 'positive')
  const crashes = corridor.crash_flags ?? []
  const routeCoordinates = (corridor.waypoints ?? [])
    .filter((p) => typeof p?.lat === 'number' && typeof p?.lng === 'number')
    .map((p) => [p.lng, p.lat] as [number, number])
  const pins = crashes
    .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
    .map((c) => ({
      lat: c.lat,
      lng: c.lng,
      note: `${c.crashCount ?? 1} crash${(c.crashCount ?? 1) === 1 ? '' : 'es'} nearby (state data)`,
      category: 'crash',
      color: '#DC2626',
    }))
  const keithAdjusted = corridor.final_walk_score !== null || corridor.final_bike_score !== null
  const prevRoute = siblings[index - 1]
  const nextRoute = siblings[index + 1]

  async function submit() {
    setBusy(true)
    setMsg(null)
    const res = await request<{ ok: boolean; review: CorridorReviewRow; unchanged?: boolean }>(
      `/api/volunteer-guide/shortlist/routes/${corridor.id}/review`,
      {
        verdict,
        walk: verdict === 'adjust' && walk !== '' ? Number(walk) : null,
        bike: verdict === 'adjust' && bike !== '' ? Number(bike) : null,
        note,
      },
    )
    setBusy(false)
    if (res.ok) {
      setReview(res.data.review)
      setMsg({
        tone: 'ok',
        text: res.data.unchanged
          ? 'Nothing changed since your last review.'
          : verdict === 'agree'
            ? 'Recorded: you agree with the analysis.'
            : 'Suggestion sent. Keith will apply or keep the original and you’ll see which here.',
      })
    } else {
      setMsg({ tone: 'warn', text: res.error })
    }
  }

  return (
    <div className="pt-6">
      <Link
        href={`/volunteer/guide/shortlist/${row.school_id}`}
        className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#4A4D68] no-underline hover:text-[#2966E5]"
      >
        <ArrowLeft size={14} weight="bold" /> {row.school_name}
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full font-[family-name:var(--font-dm-mono)] text-[15px] font-bold text-white"
          style={{ background: color }}
        >
          {letter}
        </span>
        <h1 className="m-0 font-[family-name:var(--font-bricolage)] text-[clamp(22px,3.5vw,28px)] font-extrabold tracking-tight text-[#191A2E]">
          {corridor.name}
        </h1>
        {excluded && (
          <span className="rounded-full bg-[#EDEBE2] px-2.5 py-0.5 text-[12px] font-semibold text-[#4A4D68]">
            Set aside by Keith
          </span>
        )}
      </div>
      <p className="m-0 mt-1 text-[13.5px] text-[#6B7280]">
        {corridor.distance_miles?.toFixed(1)} mi · {corridor.estimated_walk_minutes} min walk · {corridor.estimated_bike_minutes} min bike
        {crashes.length > 0 && ` · ${crashes.length} crash cluster${crashes.length === 1 ? '' : 's'} nearby`}
      </p>

      <div className="mt-4 grid gap-4">
        {routeCoordinates.length >= 2 && (
          <VolunteerRouteMap routeCoordinates={routeCoordinates} pins={pins} heightClass="h-72" endLabel="School" />
        )}

        {/* Scores */}
        <section className="rounded-xl border border-[#E4E2D9] bg-white p-5">
          <h2 className="m-0 mb-3 font-[family-name:var(--font-bricolage)] text-[18px] font-extrabold tracking-tight text-[#191A2E]">
            Safety scores
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="m-0 mb-1.5 font-[family-name:var(--font-dm-mono)] text-[10.5px] uppercase tracking-[0.07em] text-[#6B7280]">Walking</p>
              <div className="grid gap-1.5">
                <Bar label="AI analysis" score={corridor.ai_walk_score} />
                {keithAdjusted && <Bar label="Keith's call" score={corridor.final_walk_score} />}
                {review?.verdict === 'adjust' && review.suggested_walk_score !== null && (
                  <Bar label="Your suggestion" score={review.suggested_walk_score} />
                )}
              </div>
            </div>
            <div>
              <p className="m-0 mb-1.5 font-[family-name:var(--font-dm-mono)] text-[10.5px] uppercase tracking-[0.07em] text-[#6B7280]">Biking</p>
              <div className="grid gap-1.5">
                <Bar label="AI analysis" score={corridor.ai_bike_score} />
                {keithAdjusted && <Bar label="Keith's call" score={corridor.final_bike_score} />}
                {review?.verdict === 'adjust' && review.suggested_bike_score !== null && (
                  <Bar label="Your suggestion" score={review.suggested_bike_score} />
                )}
              </div>
            </div>
          </div>
          {corridor.score_adjustment_note && (
            <p className="mb-0 mt-3 text-[13px] italic text-[#4A4D68]">Keith&rsquo;s note: {corridor.score_adjustment_note}</p>
          )}
        </section>

        {/* What the analysis saw */}
        {(corridor.ai_summary || concerns.length > 0 || positives.length > 0) && (
          <section className="rounded-xl border border-[#E4E2D9] bg-white p-5">
            <h2 className="m-0 mb-2 font-[family-name:var(--font-bricolage)] text-[18px] font-extrabold tracking-tight text-[#191A2E]">
              What the analysis saw
            </h2>
            {corridor.ai_summary && <p className="mt-0 mb-3 text-[14px] text-[#374151]">{corridor.ai_summary}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {concerns.length > 0 && (
                <div>
                  <p className="m-0 mb-1 font-[family-name:var(--font-dm-mono)] text-[10.5px] uppercase tracking-[0.07em] text-[#6B7280]">Concerns</p>
                  <ul className="m-0 grid list-none gap-1 p-0">
                    {concerns.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[13.5px] text-[#374151]">
                        <Warning size={14} weight="bold" className="mt-0.5 shrink-0 text-amber-600" />
                        {f.description ?? String(f)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {positives.length > 0 && (
                <div>
                  <p className="m-0 mb-1 font-[family-name:var(--font-dm-mono)] text-[10.5px] uppercase tracking-[0.07em] text-[#6B7280]">Works well</p>
                  <ul className="m-0 grid list-none gap-1 p-0">
                    {positives.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[13.5px] text-[#374151]">
                        <Check size={14} weight="bold" className="mt-0.5 shrink-0 text-green-600" />
                        {f.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Street View */}
        <section className="rounded-xl border border-[#E4E2D9] bg-white p-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[18px] font-extrabold tracking-tight text-[#191A2E]">
              Street View along the route
            </h2>
            <span className="text-[12.5px] text-[#6B7280]">{images.length} frames · tap to enlarge · arrow keys to step</span>
          </div>
          {images.length === 0 ? (
            <p className="m-0 text-[13.5px] text-[#6B7280]">No Street View frames were cached for this route.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setLightbox(i)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-md bg-[#EDEBE2]"
                  aria-label={`Open frame ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 font-[family-name:var(--font-dm-mono)] text-[10px] text-white">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Review */}
        <section className={`rounded-xl border p-5 ${excluded ? 'border-[#E4E2D9] bg-[#F8F7F2]' : 'border-[#2966E5] bg-white'}`}>
          <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[18px] font-extrabold tracking-tight text-[#191A2E]">
            Your review
          </h2>
          {excluded ? (
            <p className="m-0 mt-1 text-[14px] text-[#4A4D68]">
              Keith set this route aside — it won&rsquo;t be walked or published, so there&rsquo;s nothing to review.
            </p>
          ) : (
            <>
              <p className="m-0 mt-1 mb-3 text-[13.5px] text-[#4A4D68]">
                Does the score match what you see in the photos? Be most skeptical of generous
                scores on busy multi-lane roads — that&rsquo;s the tool&rsquo;s weak spot. Your
                suggestion goes to Keith; if he applies it, it becomes the score that counts.
              </p>
              {review && (
                <div
                  className={`mb-3 rounded-lg px-4 py-2.5 text-[13.5px] ${
                    review.status === 'applied'
                      ? 'bg-[#DCF3E6] text-[#1F6B45]'
                      : review.status === 'declined'
                        ? 'bg-[#EDEBE2] text-[#4A4D68]'
                        : review.verdict === 'agree'
                          ? 'bg-[#DCF3E6] text-[#1F6B45]'
                          : 'bg-[#FEF3C7] text-[#92400E]'
                  }`}
                >
                  {review.verdict === 'agree'
                    ? `${review.reviewer_name} agreed with the analysis on ${new Date(review.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
                    : review.status === 'applied'
                      ? `Keith applied ${review.reviewer_name}'s suggestion${review.reviewed_at ? ` on ${new Date(review.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.`
                      : review.status === 'declined'
                        ? `Keith kept the original score.${review.review_note ? ` "${review.review_note}"` : ''}`
                        : `${review.reviewer_name}'s suggestion is waiting for Keith.`}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(['agree', 'adjust'] as const).map((v) => (
                  <label
                    key={v}
                    className={`cursor-pointer rounded-lg border px-3.5 py-2 text-[14px] font-semibold ${
                      verdict === v ? 'border-[#2966E5] bg-[#DEE9FC] text-[#1D4FB0]' : 'border-[#E4E2D9] text-[#4A4D68]'
                    }`}
                  >
                    <input type="radio" name="verdict" value={v} checked={verdict === v} onChange={() => setVerdict(v)} className="sr-only" />
                    {v === 'agree' ? 'Scores look right' : 'Suggest a correction'}
                  </label>
                ))}
              </div>
              {verdict === 'adjust' && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#4A4D68]">Walk (now {walkNow ?? '—'})</span>
                    <select value={walk} onChange={(e) => setWalk(e.target.value)} className="rounded-lg border border-[#E4E2D9] bg-white px-2.5 py-1.5 text-[14px] text-[#191A2E]">
                      <option value="">keep</option>
                      {SCORES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#4A4D68]">Bike (now {bikeNow ?? '—'})</span>
                    <select value={bike} onChange={(e) => setBike(e.target.value)} className="rounded-lg border border-[#E4E2D9] bg-white px-2.5 py-1.5 text-[14px] text-[#191A2E]">
                      <option value="">keep</option>
                      {SCORES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={verdict === 'adjust' ? 'Why? (required) — which frames, what you saw' : 'Anything worth noting (optional)'}
                className="mt-3 w-full rounded-lg border border-[#E4E2D9] bg-white px-3 py-2 text-[14px] text-[#191A2E] placeholder:text-[#9CA3AF] focus:border-[#2966E5] focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={submit}
                  disabled={busy || !reviewer || (verdict === 'adjust' && (!note.trim() || (walk === '' && bike === '')))}
                  className="rounded-lg bg-[#2966E5] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#2159c7] disabled:opacity-50"
                >
                  {busy ? 'Sending…' : review ? 'Update my review' : verdict === 'agree' ? 'Record agreement' : 'Send suggestion to Keith'}
                </button>
                {msg && (
                  <span className={`text-[13.5px] ${msg.tone === 'ok' ? 'text-[#1F6B45]' : 'text-[#92400E]'}`}>{msg.text}</span>
                )}
              </div>
            </>
          )}
        </section>

        {/* Prev / next */}
        <div className="flex items-center justify-between gap-3">
          {prevRoute ? (
            <Link href={`/volunteer/guide/shortlist/${row.school_id}/routes/${prevRoute.id}`} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#2966E5] no-underline">
              <ArrowLeft size={14} weight="bold" /> {prevRoute.name}
            </Link>
          ) : <span />}
          {nextRoute ? (
            <Link href={`/volunteer/guide/shortlist/${row.school_id}/routes/${nextRoute.id}`} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#2966E5] no-underline">
              {nextRoute.name} <ArrowRight size={14} weight="bold" />
            </Link>
          ) : (
            <Link href={`/volunteer/guide/shortlist/${row.school_id}`} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#2966E5] no-underline">
              Back to {row.school_name} <ArrowRight size={14} weight="bold" />
            </Link>
          )}
        </div>
      </div>

      {lightbox !== null && images[lightbox] && (
        <PhotoLightbox
          src={images[lightbox].image_url}
          alt={`Frame ${lightbox + 1} of ${images.length}`}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
