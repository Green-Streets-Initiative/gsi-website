'use client'

import { useState } from 'react'
import { ChatsCircle, DownloadSimple, ThumbsUp } from '@phosphor-icons/react'
import {
  STOP_QUESTIONS, stopQuestionSentence, type AuditStop,
} from '@/components/walk-audit/stopModel'

interface SubmissionLike {
  id: string
  module: string
  observer_name: string | null
  answers: Record<string, unknown>
  submitted_at: string
}

export interface StopTally {
  key: string
  yes: number
  no: number
  total: number
  /** What walkers added to a "no": a note, a photo, or both. Photos first. */
  notes: { text: string; who: string | null; photoUrl: string | null }[]
}

export interface StopSummary {
  stop: AuditStop
  index: number
  /** How many people sent in answers at this stop. */
  people: number
  /** Every question someone answered, most "no" first. */
  tallies: StopTally[]
  discussions: { who: string | null; notes: string }[]
}

/**
 * Rolls every walker's stop answers up by stop. A walker who saves twice at
 * one stop counts once, with their latest answers (matched by the id kept on
 * their phone, or by name for answers saved before that id existed).
 */
export function summarizeStops(stops: AuditStop[], submissions: SubmissionLike[]): StopSummary[] {
  const byId = new Map<string, StopSummary>()
  stops.forEach((stop, index) => byId.set(stop.id, { stop, index, people: 0, tallies: [], discussions: [] }))

  function summaryFor(s: SubmissionLike): StopSummary | null {
    const id = s.answers?.stop_id
    if (typeof id !== 'string') return null
    let summary = byId.get(id)
    if (!summary) {
      // The organizer removed this stop after people answered: keep the answers.
      const name = typeof s.answers?.stop_name === 'string' ? s.answers.stop_name : 'A removed stop'
      summary = { stop: { id, name, lat: 0, lng: 0 }, index: byId.size, people: 0, tallies: [], discussions: [] }
      byId.set(id, summary)
    }
    return summary
  }

  const latestCheck = new Map<string, SubmissionLike>()
  for (const s of submissions) {
    if (s.module === 'stop_discussion') {
      const summary = summaryFor(s)
      const notes = s.answers?.notes
      if (summary && typeof notes === 'string' && notes.trim()) {
        summary.discussions.push({ who: s.observer_name, notes: notes.trim() })
      }
    } else if (s.module === 'stop_check') {
      const id = s.answers?.stop_id
      if (typeof id !== 'string') continue
      const key = s.answers?.walker_key
      const who = typeof key === 'string' && key
        ? `key:${key}`
        : s.observer_name ? `name:${s.observer_name}` : `anon:${s.id}`
      latestCheck.set(`${id}|${who}`, s)
    }
  }

  const counts = new Map<string, Map<string, StopTally>>()
  for (const s of latestCheck.values()) {
    const summary = summaryFor(s)
    if (!summary) continue
    summary.people++
    const checks = (s.answers?.checks ?? {}) as Record<string, string>
    const notes = (s.answers?.notes ?? {}) as Record<string, string>
    const photos = (s.answers?.photos ?? {}) as Record<string, { url?: string }>
    const perStop = counts.get(summary.stop.id) ?? new Map<string, StopTally>()
    counts.set(summary.stop.id, perStop)
    for (const [key, value] of Object.entries(checks)) {
      if (value !== 'yes' && value !== 'no') continue
      const tally = perStop.get(key) ?? { key, yes: 0, no: 0, total: 0, notes: [] }
      tally[value]++
      tally.total++
      const text = notes[key]?.trim() ?? ''
      const photoUrl = photos[key]?.url ?? null
      if (value === 'no' && (text || photoUrl)) tally.notes.push({ text, who: s.observer_name, photoUrl })
      perStop.set(key, tally)
    }
  }

  const order = new Map(STOP_QUESTIONS.map((q, i) => [q.key, i]))
  for (const summary of byId.values()) {
    for (const tally of counts.get(summary.stop.id)?.values() ?? []) {
      tally.notes.sort((a, b) => Number(!!b.photoUrl) - Number(!!a.photoUrl))
    }
    summary.tallies = [...(counts.get(summary.stop.id)?.values() ?? [])].sort(
      (a, b) =>
        b.no / b.total - a.no / a.total ||
        b.no - a.no ||
        (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0),
    )
  }
  return [...byId.values()].sort((a, b) => a.index - b.index)
}

const SHOWN_AT_FIRST = 5
const YES_SHOWN_AT_FIRST = 5

function StopCard({ summary, onPhoto }: { summary: StopSummary; onPhoto: (url: string) => void }) {
  const [showAll, setShowAll] = useState(false)
  const [showAllYes, setShowAllYes] = useState(false)
  const problems = summary.tallies.filter((t) => t.no > 0)
  const working = summary.tallies.filter((t) => t.no === 0)
  const shown = showAll ? problems : problems.slice(0, SHOWN_AT_FIRST)

  return (
    <div className="border-t border-gray-100 pt-5 first:border-0 first:pt-0">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#191A2E] text-base font-extrabold text-white">
          {summary.index + 1}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-tight text-[#191A2E]">{summary.stop.name}</h3>
          {summary.people > 0 && (
            <p className="text-sm text-[#4B5563]">
              {summary.people} {summary.people === 1 ? 'person' : 'people'} answered
            </p>
          )}
        </div>
      </div>

      {shown.length > 0 && (
        <ul className="mt-4 space-y-3.5">
          {shown.map((t) => {
            const noPct = Math.round((t.no / t.total) * 100)
            return (
              <li key={t.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] text-[#191A2E]">{stopQuestionSentence(t.key)}</p>
                  <p className="shrink-0 text-sm font-bold text-[#B45309]">
                    {t.no} of {t.total} said no
                  </p>
                </div>
                <div
                  className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-[#52B788]"
                  role="img"
                  aria-label={`${t.no} no, ${t.yes} yes`}
                >
                  <div className="h-full bg-[#D97706]" style={{ width: `${noPct}%` }} />
                </div>
                {t.notes.slice(0, 4).map((note, i) => (
                  <div key={i} className="mt-2 flex items-start gap-2.5 border-l-2 border-[#D97706]/50 pl-2.5">
                    {note.photoUrl && (
                      <button onClick={() => onPhoto(note.photoUrl!)} className="shrink-0" aria-label="Open the photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={note.photoUrl} alt="" className="h-20 w-24 cursor-pointer rounded-lg object-cover" />
                      </button>
                    )}
                    <p className="min-w-0 text-sm text-[#374151]">
                      {note.text}
                      {note.who && <span className="text-[#6B7280]">{note.text ? ` (${note.who})` : `Photo by ${note.who}`}</span>}
                    </p>
                  </div>
                ))}
              </li>
            )
          })}
        </ul>
      )}
      {problems.length > SHOWN_AT_FIRST && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-sm font-semibold text-[#2966E5]"
        >
          {showAll ? 'Show fewer' : `Show all ${problems.length}`}
        </button>
      )}

      {working.length > 0 && (
        <p className="mt-4 flex items-start gap-2 text-sm text-[#374151]">
          <ThumbsUp size={16} weight="fill" className="mt-0.5 shrink-0 text-[#52B788]" />
          <span>
            <span className="font-semibold text-[#3D5407]">Everyone said yes: </span>
            {(showAllYes ? working : working.slice(0, YES_SHOWN_AT_FIRST))
              .map((t) => STOP_QUESTIONS.find((q) => q.key === t.key)?.short ?? t.key)
              .join(', ')}
            {working.length > YES_SHOWN_AT_FIRST && (
              <button
                onClick={() => setShowAllYes(!showAllYes)}
                className="ml-1.5 font-semibold text-[#2966E5]"
              >
                {showAllYes ? 'Show fewer' : `and ${working.length - YES_SHOWN_AT_FIRST} more`}
              </button>
            )}
          </span>
        </p>
      )}

      {summary.discussions.map((d, i) => (
        <div key={i} className="mt-4 rounded-xl bg-[#F4F8EE] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#3D5407]">
            <ChatsCircle size={16} weight="fill" /> What the group said{d.who ? `, noted by ${d.who}` : ''}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-[#191A2E]">{d.notes}</p>
        </div>
      ))}
    </div>
  )
}

export default function StopResults({ summaries, onDownload, onPhoto }: {
  summaries: StopSummary[]
  onDownload: () => void
  onPhoto: (url: string) => void
}) {
  const withAnswers = summaries.filter((s) => s.people > 0 || s.discussions.length > 0)
  if (withAnswers.length === 0) return null
  return (
    <div id="stops" className="scroll-mt-4 rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[#191A2E]">Stop by stop</h2>
        <div className="flex items-center gap-3 text-[13px] text-[#4B5563]">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#D97706]"></span> no</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#52B788]"></span> yes</span>
        </div>
      </div>
      <div className="space-y-5">
        {withAnswers.map((s) => <StopCard key={s.stop.id} summary={s} onPhoto={onPhoto} />)}
      </div>
      <button
        onClick={onDownload}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-semibold text-[#191A2E] hover:border-[#2966E5]"
      >
        <DownloadSimple size={13} weight="bold" /> Download every answer (CSV)
      </button>
    </div>
  )
}
