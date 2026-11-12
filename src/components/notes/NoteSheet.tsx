'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, X } from '@phosphor-icons/react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'
import { toJpeg } from '@/lib/photo/to-jpeg'
import type { SiteLocale } from '@/lib/site-i18n'
import {
  NOTE_KINDS, NOTE_MAX, OSM_KINDS, compassKey, nearestOnLine, noteKindLabel, notesT,
  type LatLng, type NoteSheetKind, type NoteSurface,
} from '@/lib/route-notes'
import type { NotesKey } from '@/lib/site-strings/notes'
import { defaultTrack, type Track } from './NoteDetail'

/*
 * "Add a note" (route notes, Shift 01763; sketch screen 3).
 *
 * The route being looked at is drawn and the pin starts on it; the person
 * moves the map so the pin sits on the spot. The street and the direction
 * come from the line under the pin ("Commonwealth Ave · heading east");
 * "Both ways" covers a note that holds for both. One tap says what it was
 * like; words and one photo are optional. A map fact ("Bike lane ends",
 * "This map is wrong") with words can also go to OpenStreetMap when they
 * tick the box.
 *
 * Twin of Shift components/notes/NoteSheet.tsx, built from this site's
 * Report a spot sheet (components/spot/ReportSpotSheet.tsx): the same map
 * and pin, the same photo handling (resized and re-encoded here, so the
 * camera's location never leaves the device), the same dialog. Saved
 * through /api/notes/add. Mount it to open it; it closes through onClose.
 */

type Spot = LatLng
type SendState = 'idle' | 'sending' | 'sent' | 'error' | 'too_many'
type Photo = { status: 'none' } | { status: 'working' } | { status: 'failed' } | { status: 'ready'; blob: Blob; url: string }

const BOSTON: Spot = { lat: 42.3601, lng: -71.0589 }
/** Farther than this from the line, the direction can't be told: both ways. */
const ON_LINE_M = 60

export interface NoteSheetProps {
  onClose: () => void
  surface: NoteSurface
  /** The route, in the order it's ridden. */
  line?: LatLng[] | null
  /** Where the pin starts; else the middle of the line. */
  spot?: LatLng | null
  /** Called after a note is saved (the box reloads). */
  onAdded?: () => void
  locale?: SiteLocale
  track?: Track
}

/* ── The map: move it, the pin stays in the middle ──────────────────── */

function NotePinMap({ start, line, onSettle }: { start: Spot; line: Spot[]; onSettle: (p: Spot) => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const onSettleRef = useRef(onSettle)
  useEffect(() => { onSettleRef.current = onSettle }, [onSettle])

  useEffect(() => {
    let cancelled = false
    let map: maplibregl.Map | null = null
    ;(async () => {
      const maplibregl = await loadMaplibre()
      if (cancelled || !boxRef.current) return
      map = new maplibregl.Map({
        container: boxRef.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [start.lng, start.lat],
        zoom: 17,
        maxZoom: 19,
        minZoom: 12,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      })
      map.touchZoomRotate.disableRotation()
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      requestAnimationFrame(() => map?.resize())
      if (line.length >= 2) {
        map.on('load', () => {
          if (!map) return
          map.addSource('note-route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.map((p) => [p.lng, p.lat]) } },
          })
          map.addLayer({ id: 'note-route-casing', type: 'line', source: 'note-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8 } })
          map.addLayer({ id: 'note-route-line', type: 'line', source: 'note-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#2966E5', 'line-width': 5 } })
        })
      }
      map.on('moveend', () => {
        const c = map!.getCenter()
        onSettleRef.current({ lat: c.lat, lng: c.lng })
      })
    })()
    return () => {
      cancelled = true
      map?.remove()
    }
    // The map is made once per opening; moving it is the person's job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-[200px] overflow-hidden rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.15)] sm:h-[220px]">
      {/* h-full, not absolute inset-0: maplibre's own CSS makes its container
          position: relative, which collapses an inset-only box to 0 high. */}
      <div ref={boxRef} className="h-full w-full" />
      {/* The pin's tip is the spot: the map's centre. */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
        <svg width="30" height="40" viewBox="0 0 30 40">
          <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 39 15 39s14-13.7 14-24.1C29 7.2 22.7 1 15 1z" fill="#2D6A4F" stroke="#fff" strokeWidth="2" />
          <circle cx="15" cy="15" r="5" fill="#fff" />
        </svg>
      </div>
    </div>
  )
}

/** The street under the pin, from MassDOT's road records (through /api/spot/report, which saves nothing). */
async function streetAt(p: Spot): Promise<string | null> {
  try {
    const res = await fetch('/api/spot/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ road: { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) } }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { road?: { street?: unknown } | null }
    return typeof data.road?.street === 'string' && data.road.street ? data.road.street : null
  } catch {
    return null
  }
}

/* ── The sheet ───────────────────────────────────────────────────────── */

export default function NoteSheet({ onClose, surface, line, spot, onAdded, locale = 'en', track = defaultTrack }: NoteSheetProps) {
  const t = notesT(locale)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const takeRef = useRef<HTMLInputElement>(null)
  const chooseRef = useRef<HTMLInputElement>(null)
  const openedAt = useRef(0)
  const closedBy = useRef('close')
  const pressStartedOnBackdrop = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const askSeq = useRef(0)

  const [usable] = useState<Spot[]>(() => (line ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)))
  const [start] = useState<Spot>(() => spot ?? (usable.length > 0 ? usable[Math.floor(usable.length / 2)] : BOSTON))
  const [center, setCenter] = useState<Spot>(start)
  const [street, setStreet] = useState<string | null>(null)
  const [kind, setKind] = useState<NoteSheetKind | null>(null)
  const [bothWays, setBothWays] = useState(false)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<Photo>({ status: 'none' })
  const [osm, setOsm] = useState(false)
  const [state, setState] = useState<SendState>('idle')
  const [sentWith, setSentWith] = useState<{ words: boolean; photo: boolean; osm: boolean } | null>(null)
  const [canTakePhoto] = useState(() => {
    try { return window.matchMedia('(pointer: coarse)').matches } catch { return false }
  })

  const titleId = `note-sheet-${surface}`
  const onLine = usable.length >= 2 ? nearestOnLine(usable, center) : null
  const heading = onLine && onLine.metres <= ON_LINE_M ? onLine.heading : null
  const both = bothWays || heading == null
  const at = onLine && onLine.metres <= ON_LINE_M ? onLine.at : center

  // Opening: the dialog, the event, and the street at the starting spot.
  useEffect(() => {
    openedAt.current = Date.now()
    const d = dialogRef.current
    if (d && !d.open) d.showModal()
    track('note_sheet_opened', { surface, has_line: usable.length >= 2 })
    lookUp(start)
    return () => { if (settleTimer.current) clearTimeout(settleTimer.current) }
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A photo preview is a blob URL: let it go when it's replaced or the sheet goes.
  useEffect(() => {
    if (photo.status !== 'ready') return
    const url = photo.url
    return () => URL.revokeObjectURL(url)
  }, [photo])

  /** Once the pin settles: the street's name, at the line's point when the pin is on it. */
  function lookUp(p: Spot) {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const seq = ++askSeq.current
      const near = usable.length >= 2 ? nearestOnLine(usable, p) : null
      void streetAt(near && near.metres <= ON_LINE_M ? near.at : p).then((name) => {
        if (seq === askSeq.current) setStreet(name)
      })
    }, 450)
  }

  const settle = (p: Spot) => {
    setCenter((c) => (Math.abs(c.lat - p.lat) < 1e-7 && Math.abs(c.lng - p.lng) < 1e-7 ? c : p))
    lookUp(p)
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    setPhoto({ status: 'working' })
    try {
      const blob = await toJpeg(file)
      setPhoto({ status: 'ready', blob, url: URL.createObjectURL(blob) })
    } catch {
      setPhoto({ status: 'failed' })
    }
  }

  const close = (affordance: string) => {
    closedBy.current = affordance
    dialogRef.current?.close()
  }

  // One handler for every way out (button, Escape, backdrop, Done).
  const onClosed = () => {
    if (state !== 'sent' && state !== 'sending') {
      track('note_sheet_dismissed', {
        surface,
        affordance: closedBy.current,
        kind,
        seconds_on_screen: Math.round((Date.now() - openedAt.current) / 1000),
      })
    }
    onClose()
  }

  const words = note.trim()
  const canOsm = !!kind && OSM_KINDS.has(kind) && words.length > 0
  const working = photo.status === 'working'
  const canSend = !!kind && state !== 'sending' && !working

  const send = async () => {
    if (!kind || state === 'sending' || working) return
    setState('sending')
    const body = {
      surface,
      kinds: [kind],
      note: words || null,
      heading: both ? null : Math.round(heading ?? 0) % 360,
      both_ways: both,
      osm: canOsm && osm,
      segment: { lat: Number(at.lat.toFixed(6)), lng: Number(at.lng.toFixed(6)), ...(street ? { label: street.slice(0, 120) } : {}) },
    }
    const form = new FormData()
    form.append('note', JSON.stringify(body))
    if (photo.status === 'ready') form.append('photo', photo.blob, 'note.jpg')
    try {
      const res = await fetch('/api/notes/add', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
      if (res.ok && data?.ok) {
        setSentWith({ words: !!body.note, photo: photo.status === 'ready', osm: body.osm })
        setState('sent')
        onAdded?.()
        // Never the words or the place: what was picked and how.
        track('note_added', {
          surface,
          kind,
          both_ways: both,
          has_note: !!body.note,
          has_photo: photo.status === 'ready',
          osm: body.osm,
          seconds_on_screen: Math.round((Date.now() - openedAt.current) / 1000),
        })
        return
      }
      setState(res.status === 429 ? 'too_many' : 'error')
      track('note_add_failed', { surface, status: res.status })
    } catch {
      setState('error')
      track('note_add_failed', { surface, status: 0 })
    }
  }

  const where = street
    ? both
      ? t('notes.where_both', { street })
      : t('notes.where_heading', { street, dir: t(`notes.dir_${compassKey(heading ?? 0)}` as NotesKey) })
    : heading != null
      ? t('notes.where_heading', { street: t('notes.this_stretch'), dir: t(`notes.dir_${compassKey(heading)}` as NotesKey) })
      : t('notes.where_unknown')

  const tile = (on: boolean) =>
    `min-h-[48px] cursor-pointer rounded-xl border px-3 py-2 text-left text-[0.9375rem] font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F] ${
      on ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white' : 'border-[rgba(25,26,46,0.18)] bg-white text-[#191A2E] hover:border-[#2D6A4F]'
    }`
  const quietButton =
    'inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[rgba(25,26,46,0.18)] bg-white px-3.5 text-[0.9375rem] font-semibold text-[#191A2E] transition-colors hover:border-[#2D6A4F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]'
  const primary =
    'min-h-[48px] w-full cursor-pointer rounded-full bg-[#2D6A4F] text-[1rem] font-bold text-white transition-colors hover:bg-[#1F4D3A] disabled:cursor-not-allowed disabled:bg-[rgba(25,26,46,0.12)] disabled:text-[#4A4D68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClosed}
      onCancel={() => { closedBy.current = 'escape' }}
      onPointerDown={(e) => { pressStartedOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (e.target === e.currentTarget && pressStartedOnBackdrop.current) close('backdrop') }}
      className="m-0 mt-auto max-h-[94vh] w-full max-w-none rounded-t-2xl bg-white p-0 text-[#191A2E] shadow-[0_-8px_32px_rgba(25,26,46,0.18)] backdrop:bg-[rgba(25,26,46,0.55)] sm:m-auto sm:max-w-[480px] sm:rounded-2xl"
    >
      <div className="flex max-h-[94vh] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(25,26,46,0.08)] px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[1.0625rem] font-extrabold leading-snug">
              {state === 'sent' ? t('notes.thanks_title') : t('notes.sheet_title')}
            </h2>
            {state !== 'sent' && <p className="mt-0.5 text-[0.9375rem] leading-snug text-[#4A4D68]">{t('notes.sheet_sub')}</p>}
          </div>
          <button
            type="button"
            onClick={() => close('close')}
            aria-label={t('common.close')}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[rgba(25,26,46,0.15)] text-[#4A4D68] transition-colors hover:bg-[#F4F8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        {state === 'sent' && sentWith ? (
          <div className="px-5 pb-2 pt-6" role="status">
            <p className="text-[1rem] leading-snug text-[#191A2E]">{kind === 'map_wrong' ? t('notes.thanks_map') : t('notes.thanks_body')}</p>
            {(sentWith.words || sentWith.photo) && (
              <p className="mt-2 text-[0.9375rem] leading-snug text-[#4A4D68]">{sentWith.photo ? t('notes.thanks_photo') : t('notes.thanks_words')}</p>
            )}
            {sentWith.osm && <p className="mt-2 text-[0.9375rem] leading-snug text-[#4A4D68]">{t('notes.thanks_osm_web')}</p>}
            <div className="pt-5" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={() => close('done')}
                className="min-h-[48px] w-full cursor-pointer rounded-full border border-[rgba(25,26,46,0.18)] bg-white text-[1rem] font-bold text-[#191A2E] transition-colors hover:border-[#2D6A4F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
              >
                {t('common.done')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {/* Where: the route under the pin */}
              <NotePinMap start={start} line={usable} onSettle={settle} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 text-[0.9375rem] font-semibold leading-snug text-[#191A2E]" aria-live="polite">{where}</p>
                {heading != null && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={bothWays}
                    onClick={() => setBothWays((b) => !b)}
                    className={`min-h-[44px] shrink-0 cursor-pointer rounded-full border px-3.5 text-[0.875rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F] ${
                      bothWays ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white' : 'border-[rgba(25,26,46,0.25)] bg-white text-[#191A2E] hover:border-[#2D6A4F]'
                    }`}
                  >
                    {t('notes.both_ways')}
                  </button>
                )}
              </div>

              {/* What it was like (one tap) */}
              <fieldset className="m-0 mt-5 border-0 p-0">
                <legend className="mb-2 text-[0.9375rem] font-bold">{t('notes.what_like')}</legend>
                <div role="radiogroup" aria-label={t('notes.what_like')} className="grid grid-cols-2 gap-2">
                  {NOTE_KINDS.map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(kind === k ? null : k)} className={tile(kind === k)}>
                      {noteKindLabel(t, k)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  role="radio"
                  aria-checked={kind === 'map_wrong'}
                  onClick={() => setKind(kind === 'map_wrong' ? null : 'map_wrong')}
                  className={`mt-2 inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-dashed px-3.5 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F] ${
                    kind === 'map_wrong' ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white' : 'border-[rgba(25,26,46,0.35)] bg-white text-[#2F3150] hover:border-[#2D6A4F]'
                  }`}
                >
                  {noteKindLabel(t, 'map_wrong')}
                </button>
              </fieldset>

              {kind && (
                <>
                  {/* Words (optional) */}
                  <label className="mt-5 block text-[0.9375rem] font-bold" htmlFor={`${titleId}-note`}>
                    {t('notes.say_more')} <span className="font-normal text-[#4A4D68]">{t('notes.optional')}</span>
                  </label>
                  <textarea
                    id={`${titleId}-note`}
                    value={note}
                    onChange={(e) => setNote(Array.from(e.target.value).slice(0, NOTE_MAX).join(''))}
                    rows={3}
                    placeholder={kind === 'map_wrong' ? t('notes.placeholder_map') : t('notes.placeholder')}
                    aria-describedby={`${titleId}-count`}
                    className="mt-1.5 block w-full resize-none rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.15)] bg-white px-3 py-2.5 text-[1rem] text-[#191A2E] outline-none placeholder:text-[#6B6E85] focus:border-[#2D6A4F]"
                  />
                  <p id={`${titleId}-count`} className="mt-1 text-right text-[0.875rem] tabular-nums text-[#4A4D68]">
                    {t('route_report.left', { count: NOTE_MAX - Array.from(note).length })}
                  </p>

                  {/* One photo (optional) */}
                  <input ref={takeRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
                  <input ref={chooseRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
                  <div className="mt-3">
                    {photo.status === 'ready' ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
                        <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-[#2F3150]">{t('notes.photo_added')}</p>
                        <button type="button" onClick={() => setPhoto({ status: 'none' })}
                          className="min-h-[44px] shrink-0 cursor-pointer px-2 text-[0.9375rem] font-semibold text-[#4A4D68] underline underline-offset-[3px] hover:text-[#191A2E]">
                          {t('spot_report.photo_remove')}
                        </button>
                      </div>
                    ) : photo.status === 'working' ? (
                      <p className="text-[0.9375rem] text-[#4A4D68]" role="status">{t('spot_report.photo_uploading')}</p>
                    ) : (
                      <div>
                        <div className="flex flex-wrap gap-2">
                          {/* A computer has no camera to choose: only the files. */}
                          {canTakePhoto && (
                            <button type="button" onClick={() => takeRef.current?.click()} className={quietButton}>
                              <Camera size={18} aria-hidden /> {t('spot_report.photo_take')}
                            </button>
                          )}
                          <button type="button" onClick={() => chooseRef.current?.click()} className={quietButton}>
                            <ImageIcon size={18} aria-hidden /> {t('spot_report.photo_choose')}
                          </button>
                        </div>
                        <p className="mt-1.5 text-[0.875rem] leading-snug text-[#4A4D68]">{t('notes.photo_hint')}</p>
                        {photo.status === 'failed' && (
                          <p role="alert" className="mt-1 text-[0.9375rem] text-[#9B2C2C]">{t('spot_report.photo_failed')}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* A map fact can also go to OpenStreetMap, in their words */}
                  {OSM_KINDS.has(kind) && (
                    <label className={`mt-4 flex min-h-[44px] items-center gap-3 text-[0.9375rem] leading-snug ${canOsm ? 'cursor-pointer text-[#191A2E]' : 'text-[#4A4D68]'}`}>
                      <input
                        type="checkbox"
                        checked={canOsm && osm}
                        disabled={!canOsm}
                        onChange={(e) => setOsm(e.target.checked)}
                        className="h-5 w-5 shrink-0 cursor-pointer accent-[#2D6A4F] disabled:cursor-not-allowed"
                      />
                      {canOsm ? t('notes.osm_box') : t('notes.osm_box_needs_words')}
                    </label>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-[rgba(25,26,46,0.08)] px-5 pt-3" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
              {state === 'error' || state === 'too_many' ? (
                <p role="alert" className="mb-2 text-[0.9375rem] text-[#9B2C2C]">
                  {state === 'too_many' ? t('route_report.too_many') : t('route_report.failed')}
                </p>
              ) : (
                <p className="mb-2 text-[0.9375rem] leading-snug text-[#4A4D68]">{kind === 'map_wrong' ? t('notes.next_map') : t('notes.next')}</p>
              )}
              <button type="button" onClick={() => void send()} disabled={!canSend} className={primary}>
                {state === 'sending' || working ? (
                  <span role="status" aria-label={t('notes.send')} className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[rgba(25,26,46,0.2)] border-t-[#191A2E] align-middle" />
                ) : kind ? t('notes.send') : t('notes.send_pick_first')}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
