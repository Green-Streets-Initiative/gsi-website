'use client'

import { useEffect, useMemo, useState } from 'react'
import { CaretRight, PencilSimpleLine, ThumbsUp, WarningCircle } from '@phosphor-icons/react'
import type { SiteLocale } from '@/lib/site-i18n'
import {
  fetchNotesAlong, noteKindLabel, notesPlural, notesT, noteWhere, shortDate,
  type LatLng, type NoteGroup, type NoteSurface, type NotesMode,
} from '@/lib/route-notes'
import NoteSheet from './NoteSheet'
import NoteDetailSheet, { defaultTrack, type Track } from './NoteDetail'
import { useNotesSwitch } from './useNotesSwitch'

/*
 * "From people who bike here" (route notes, Shift 01763; sketch screen 4).
 *
 * The notes along a route, in its direction on a bike: what, where, how
 * many people and the latest date. A row opens the note with all its dates
 * and "Still true?". On a bike route the box ends with "Add a note", which
 * takes the place of "Report a problem with this route" while the
 * route_notes switch is on.
 *
 * On a walking route the same box ("From people who walk here") carries
 * Report a spot's reports; adding one stays with Report a spot.
 *
 * Nothing at all while the switch is off. Paints from the Nearby colour
 * tokens (globals.css .nearby-tone / .nearby-tone-light); tone="light"
 * brings the light set for pages outside Nearby.
 *
 * Twin of Shift components/notes/RouteNotes.tsx.
 */

const MAX_ROWS = 5

function finite(p: LatLng | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
}

export default function RouteNotes({
  points,
  legs,
  mode,
  surface,
  canAdd: canAddProp,
  spot,
  locale = 'en',
  track = defaultTrack,
  tone,
  className = '',
}: {
  /** The route, in the order it's ridden. */
  points?: LatLng[] | null
  /** Or several separate lines (a transit trip's walks), each asked about on its own. */
  legs?: LatLng[][] | null
  mode: NotesMode
  /** Which surface, for the server (adding) and for analytics. */
  surface: NoteSurface | 'nearby_walk' | 'web_roam'
  /** Whether "Add a note" shows; by default on bike routes from a surface the server takes notes from. */
  canAdd?: boolean
  /** A stretch the person picked: Add a note starts its pin there. */
  spot?: LatLng | null
  locale?: SiteLocale
  track?: Track
  /** 'light' for pages outside Nearby; left out, the box inherits Nearby's tone. */
  tone?: 'light'
  className?: string
}) {
  const on = useNotesSwitch()
  const t = notesT(locale)
  const [result, setResult] = useState<{ key: string; groups: NoteGroup[] }>({ key: '', groups: [] })
  const [openGroup, setOpenGroup] = useState<NoteGroup | null>(null)
  const [adding, setAdding] = useState(false)
  const [reload, setReload] = useState(0)

  const lines = useMemo(() => {
    const raw = legs ?? (points ? [points] : [])
    return raw.map((l) => (l ?? []).filter(finite)).filter((l) => l.length >= 2)
  }, [legs, points])
  // One fetch per route, not per render: keyed on each line's ends and length.
  const key = lines
    .map((l) => `${l.length}:${l[0].lat.toFixed(5)},${l[0].lng.toFixed(5)}:${l[l.length - 1].lat.toFixed(5)},${l[l.length - 1].lng.toFixed(5)}`)
    .join('|')
  const fetchKey = `${mode}|${key}|${reload}`

  useEffect(() => {
    if (!on || !key) return
    let live = true
    void fetchNotesAlong(lines, mode).then((groups) => {
      if (!live) return
      setResult({ key: fetchKey, groups })
      if (groups.length > 0) track('notes_box_shown', { surface, mode, notes: groups.length, lowering: groups.filter((g) => g.lowers).length })
    })
    return () => { live = false }
    // lines is keyed by its ends and length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, fetchKey])

  if (!on) return null
  const groups = result.key === fetchKey ? result.groups : []
  const addSurface = surface === 'nearby_walk' || surface === 'web_roam' ? null : surface
  const canAdd = (canAddProp ?? true) && mode === 'bike' && !!addSurface
  if (groups.length === 0 && !canAdd) return null

  return (
    <section
      aria-label={mode === 'walk' ? t('notes.box_title_walk') : t('notes.box_title')}
      className={`${tone === 'light' ? 'nearby-tone-light ' : ''}mt-3 rounded-xl bg-(--nb-panel) px-3.5 py-3 ${className}`}
    >
      {groups.length > 0 && (
        <>
          <h3 className="text-[0.875rem] font-bold text-(--nb-ink-80)">{mode === 'walk' ? t('notes.box_title_walk') : t('notes.box_title')}</h3>
          <ul className="mt-1 list-none p-0">
            {groups.slice(0, MAX_ROWS).map((g) => {
              const good = g.kind === 'nice_here'
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => {
                      track('note_row_tapped', { surface, kind: g.kind })
                      setOpenGroup({ ...g, mode })
                    }}
                    aria-haspopup="dialog"
                    className="flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-lg py-1.5 text-left transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--nb-accent)"
                  >
                    {good ? (
                      <ThumbsUp size={18} weight="fill" aria-hidden className="shrink-0 text-(--nb-accent)" />
                    ) : (
                      <WarningCircle size={18} weight="fill" aria-hidden className="shrink-0 text-(--nb-warn)" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold leading-snug text-(--nb-ink)">{noteKindLabel(t, g.kind)}</span>
                      <span className="mt-0.5 block text-[0.875rem] leading-snug text-(--nb-ink-70)">
                        {notesPlural(t, 'notes.row_meta', Math.max(1, g.people), {
                          where: noteWhere(t, { ...g, mode }),
                          date: shortDate(g.latest_at, locale),
                        })}
                      </span>
                    </span>
                    <CaretRight size={16} aria-hidden className="shrink-0 text-(--nb-ink-60)" />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {canAdd && (
        <button
          type="button"
          onClick={() => {
            track('note_add_tapped', { surface, notes_shown: groups.length })
            setAdding(true)
          }}
          aria-haspopup="dialog"
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-[0.9375rem] font-semibold text-(--nb-accent) transition-opacity hover:opacity-80 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--nb-accent)"
        >
          <PencilSimpleLine size={16} weight="bold" aria-hidden />
          {t('notes.add')}
        </button>
      )}
      {adding && addSurface && (
        <NoteSheet
          onClose={() => setAdding(false)}
          surface={addSurface}
          line={lines[0] ?? null}
          spot={spot ?? null}
          onAdded={() => setReload((n) => n + 1)}
          locale={locale}
          track={track}
        />
      )}
      <NoteDetailSheet group={openGroup} onClose={() => setOpenGroup(null)} surface={surface} locale={locale} track={track} />
    </section>
  )
}
