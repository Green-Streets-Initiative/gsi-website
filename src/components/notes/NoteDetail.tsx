'use client'

import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { X } from '@phosphor-icons/react'
import type { SiteLocale } from '@/lib/site-i18n'
import {
  fetchNoteDetail, noteKindLabel, notePhotoUrl, notesPlural, notesT, noteWhere, shortDate, voteOnNote,
  type NoteGroup, type VoteAnswer,
} from '@/lib/route-notes'

/*
 * One note, all its dates (route notes, Shift 01763; sketch screen 5).
 *
 * Opens from a row in "From people who bike here", and is the body of
 * gogreenstreets.org/notes/<id>. Everyone's words and photos, newest first,
 * with dates and no names. Anyone can answer "Still true?" once a week per
 * note; two "Not anymore" since the latest "Still true" hide it, and so do
 * two reports. The last line says why the rating changed when it did.
 *
 * Twin of Shift components/notes/NoteDetailSheet.tsx. Light, like the
 * site's other sheets (components/spot/ReportSpotSheet.tsx).
 */

export type Track = (event: string, props?: Record<string, unknown>) => void

export const defaultTrack: Track = (event, props) => {
  try { posthog.capture(event, props) } catch { /* analytics never blocks */ }
}

export function NoteDetailBody({
  group: initial,
  surface,
  locale = 'en',
  track = defaultTrack,
  refresh = true,
}: {
  group: NoteGroup
  surface: string
  locale?: SiteLocale
  track?: Track
  /** Fetch the group again on open (the box carries up to five entries; the detail has them all, current). */
  refresh?: boolean
}) {
  const t = notesT(locale)
  const [g, setG] = useState<NoteGroup>(initial)
  const [voted, setVoted] = useState<VoteAnswer | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // Keyed by the group's id where it's used, so a new note starts fresh.
  useEffect(() => {
    let live = true
    track('note_opened', { surface, kind: initial.kind, people: initial.people })
    if (refresh) void fetchNoteDetail(initial.id).then((full) => { if (live && full) setG({ ...full, mode: full.mode ?? initial.mode }) })
    return () => { live = false }
    // One open per group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id])

  const vote = async (answer: VoteAnswer) => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    const res = await voteOnNote(g.id, answer)
    setBusy(false)
    if (!res.ok) {
      setFailed(true)
      return
    }
    setVoted(answer)
    if (res.group) setG({ ...res.group, mode: res.group.mode ?? g.mode })
    track('note_voted', { surface, answer, kind: g.kind })
  }

  const latest = shortDate(g.latest_at, locale)
  const kind = noteKindLabel(t, g.kind)

  return (
    <div>
      <div className="rounded-xl bg-[#F4F8EE] p-4">
        <p className="text-[0.9375rem] font-bold text-[#191A2E]">{t('notes.still_q')}</p>
        <p className="mt-1 text-[0.9375rem] leading-snug text-[#2F3150]">
          {notesPlural(t, 'notes.said_yes', Math.max(1, g.people), { date: latest })}
          {g.gone > 0 ? ` ${notesPlural(t, 'notes.said_no', g.gone)}` : ''}
        </p>
        {voted && voted !== 'report' ? (
          <p className="mt-2 text-[0.9375rem] font-semibold text-[#2D6A4F]" role="status">{t('notes.voted_thanks')}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void vote('still')}
              disabled={busy}
              className="min-h-[44px] min-w-[120px] cursor-pointer rounded-full bg-[#2D6A4F] px-5 text-[0.9375rem] font-bold text-white transition-colors hover:bg-[#1F4D3A] disabled:cursor-wait disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
            >
              {t('notes.still_true')}
            </button>
            <button
              type="button"
              onClick={() => void vote('gone')}
              disabled={busy}
              className="min-h-[44px] cursor-pointer rounded-full border border-[rgba(25,26,46,0.25)] bg-white px-4 text-[0.9375rem] font-bold text-[#191A2E] transition-colors hover:border-[#2D6A4F] disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
            >
              {t('notes.not_anymore')}
            </button>
          </div>
        )}
        {failed && <p role="alert" className="mt-2 text-[0.9375rem] text-[#9B2C2C]">{t('route_report.failed')}</p>}
      </div>

      {g.words.length > 0 && (
        <ol className="mt-2 list-none p-0">
          {g.words.map((w, i) => (
            <li key={`${w.at}-${i}`} className="mt-4 flex gap-3">
              <span className="w-[3.25rem] shrink-0 text-[0.9375rem] tabular-nums leading-[1.4] text-[#4A4D68]">{shortDate(w.at, locale)}</span>
              <div className="min-w-0 flex-1 space-y-2">
                {w.text && <p className="text-[1rem] leading-[1.45] text-[#191A2E]">{w.text}</p>}
                {w.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={notePhotoUrl(w.photo)}
                    alt={t('notes.photo_alt', { kind })}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-[10px] bg-[rgba(25,26,46,0.06)] object-cover"
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {g.lowers && <p className="mt-4 text-[0.9375rem] leading-snug text-[#2F3150]">{t('notes.why_lower')}</p>}

      {voted === 'report' ? (
        <p className="mt-4 text-[0.9375rem] text-[#4A4D68]" role="status">{t('notes.reported_thanks')}</p>
      ) : (
        <button
          type="button"
          onClick={() => void vote('report')}
          disabled={busy}
          className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center text-[0.9375rem] text-[#4A4D68] underline decoration-[rgba(74,77,104,0.45)] underline-offset-[3px] hover:text-[#191A2E] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
        >
          {t('notes.report')}
        </button>
      )}
    </div>
  )
}

/** The note as a sheet over the page: a bottom sheet on a phone, a centred dialog on a computer. */
export default function NoteDetailSheet({
  group,
  onClose,
  surface,
  locale = 'en',
  track = defaultTrack,
}: {
  /** The group from the box; null keeps the sheet closed. */
  group: NoteGroup | null
  onClose: () => void
  surface: string
  locale?: SiteLocale
  track?: Track
}) {
  const t = notesT(locale)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const open = !!group
  const titleId = `note-detail-${surface}`

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onPointerDown={(e) => { pressStartedOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (e.target === e.currentTarget && pressStartedOnBackdrop.current) onClose() }}
      className="m-0 mt-auto max-h-[90vh] w-full max-w-none rounded-t-2xl bg-white p-0 text-[#191A2E] shadow-[0_-8px_32px_rgba(25,26,46,0.18)] backdrop:bg-[rgba(25,26,46,0.55)] sm:m-auto sm:max-w-[480px] sm:rounded-2xl"
    >
      {group && (
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[rgba(25,26,46,0.08)] px-5 pb-3 pt-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[1.0625rem] font-extrabold leading-snug">{noteKindLabel(t, group.kind)}</h2>
              <p className="mt-0.5 text-[0.9375rem] leading-snug text-[#4A4D68]">{noteWhere(t, group)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[rgba(25,26,46,0.15)] text-[#4A4D68] transition-colors hover:bg-[#F4F8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <NoteDetailBody key={group.id} group={group} surface={surface} locale={locale} track={track} />
          </div>
        </div>
      )}
    </dialog>
  )
}
