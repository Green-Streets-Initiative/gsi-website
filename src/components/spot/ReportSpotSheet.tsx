'use client'

import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { Camera, Image as ImageIcon, X } from '@phosphor-icons/react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'
import { haversineMeters } from '@/lib/geo/measure'
import { resolvePlaceLabel } from '@/lib/nearby/neighborhood'
import { supabase } from '@/lib/supabase'
import PhotoLightbox from '@/components/walk-audit/PhotoLightbox'
import {
  NOTE_MAX, NOT_FOR_TOWN, OWNER_NAMES, SPOT_DETAILS, SPOT_KINDS, SPOT_LABELS, copiedText, isSpotKind,
  type SpotChoice, type SpotDestination, type SpotHeld, type SpotSurface,
} from './spotCopy'

/*
 * "Report a spot" (version 1) on gogreenstreets.org. One sheet, top to
 * bottom: an optional photo, one tap for what's wrong (and a second for the
 * kinds in SPOT_DETAILS), the spot under a
 * fixed pin, an optional note, then a line that says where it goes next,
 * and Send. Saved through /api/spot/report (Shift's report-route-issue).
 * Shift never submits to the town: when the town has a report page on
 * file, the thanks opens it in a new tab with the words already copied.
 *
 * Borrows the route report sheet's look and behaviour
 * (components/commute/ReportRouteSheet.tsx): a bottom sheet on a phone, a
 * centred dialog on desktop, every way out handled by the dialog's close.
 * Copy: the Report a spot contract (shared with the app). English only, as
 * the route report sheet is.
 */

type Spot = { lat: number; lng: number }

export interface ReportSpotSheetProps {
  surface: SpotSurface
  open: boolean
  onClose: () => void
  /** Where the pin starts. */
  spot: Spot
  /** The street, stretch or place at the starting spot ("Brown School"). Used
   *  for "Near …" while the pin stays close to where it started. */
  label?: string | null
}

type SendState = 'idle' | 'sending' | 'sent' | 'error' | 'too_many'
type Photo = { status: 'none' } | { status: 'working' } | { status: 'failed' } | { status: 'ready'; blob: Blob; url: string }
type Answer = { id: string | null; destination: SpotDestination | null; held: SpotHeld | null }

/** The label passed in names the starting spot; past this, the pin is somewhere else. */
const LABEL_RADIUS_M = 75
const PHOTO_MAX_EDGE = 1600
const PHOTO_MAX_BYTES = 1_500_000

/* ── Photo: resized and re-encoded in the browser ──────────────────────
 * Drawing to a canvas and saving as JPEG keeps only the pixels: the
 * camera's EXIF (including where it was taken) never leaves the device.
 * The server checks the bytes and strips metadata again. */

async function decode(file: File): Promise<{ img: CanvasImageSource; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { img: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() }
    } catch { /* fall through to <img>, which also honours the photo's rotation */ }
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('decode'))
    img.src = url
  })
  return { img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
}

async function toJpeg(file: File): Promise<Blob> {
  const { img, w, h, done } = await decode(file)
  try {
    if (!w || !h) throw new Error('empty')
    let edge = Math.min(PHOTO_MAX_EDGE, Math.max(w, h))
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = edge / Math.max(w, h)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      for (const q of [0.85, 0.75, 0.65]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', q))
        if (blob && blob.size <= PHOTO_MAX_BYTES) return blob
      }
      edge = Math.round(edge * 0.75)
    }
    throw new Error('too_large')
  } finally {
    done()
  }
}

function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text))
  } catch { /* fall back */ }
  return Promise.resolve(legacyCopy(text))
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

function safeUrl(u: string | null | undefined): string | null {
  return u && /^https?:\/\//i.test(u) ? u : null
}

/* ── The map: move it, the pin stays in the middle ──────────────────── */

function SpotPinMap({ start, onSettle }: { start: Spot; onSettle: (p: Spot) => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const onSettleRef = useRef(onSettle)
  onSettleRef.current = onSettle

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
    <div className="relative mt-2 h-[200px] overflow-hidden rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.15)] sm:h-[220px]">
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

/* ── The sheet ───────────────────────────────────────────────────────── */

export default function ReportSpotSheet({ surface, open, onClose, spot, label }: ReportSpotSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const takeRef = useRef<HTMLInputElement>(null)
  const chooseRef = useRef<HTMLInputElement>(null)
  const openedAt = useRef(0)
  const closedBy = useRef('close')
  const pressStartedOnBackdrop = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const askSeq = useRef(0)

  const [photo, setPhoto] = useState<Photo>({ status: 'none' })
  const [lightbox, setLightbox] = useState(false)
  const [choice, setChoice] = useState<SpotChoice | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [access, setAccess] = useState(false)
  const [note, setNote] = useState('')
  const [pin, setPin] = useState<Spot>(spot)
  const [dest, setDest] = useState<SpotDestination | null>(null)
  const [place, setPlace] = useState<string | null>(label ?? null)
  const [state, setState] = useState<SendState>('idle')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [canTakePhoto, setCanTakePhoto] = useState(false)

  const titleId = `spot-title-${surface}`

  // Fresh every time it opens, at the spot it was opened for.
  useEffect(() => {
    if (!open) return
    setPhoto({ status: 'none' })
    setLightbox(false)
    setChoice(null)
    setDetail(null)
    setAccess(false)
    setNote('')
    setPin(spot)
    setDest(null)
    setPlace(label ?? null)
    setState('idle')
    setAnswer(null)
    setCopyFailed(false)
    closedBy.current = 'close'
    openedAt.current = Date.now()
    try { setCanTakePhoto(window.matchMedia('(pointer: coarse)').matches) } catch { setCanTakePhoto(false) }
    posthog.capture('spot_sheet_opened', { surface, has_label: !!label })
    settle(spot)
    // Opening is the trigger; the spot and label are read as they are then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // A photo preview is a blob URL: let it go when it's replaced or the sheet goes.
  useEffect(() => {
    if (photo.status !== 'ready') return
    const url = photo.url
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current) }, [])

  /** Where the pin landed: the town and its report page, and a place name. */
  function settle(p: Spot) {
    setPin(p)
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => void lookUp(p), 400)
  }

  async function lookUp(p: Spot) {
    const seq = ++askSeq.current
    const nearStart = haversineMeters(p.lat, p.lng, spot.lat, spot.lng) <= LABEL_RADIUS_M
    let d: SpotDestination | null = null
    try {
      const { data, error } = await supabase.rpc('report_spot_destination', { p_lat: p.lat, p_lng: p.lng })
      const r = data as Record<string, unknown> | null
      if (!error && r && typeof r.town === 'string') {
        d = {
          town: r.town,
          name: typeof r.name === 'string' ? r.name : null,
          url: typeof r.url === 'string' ? r.url : null,
          action_label: typeof r.action_label === 'string' ? r.action_label : null,
        }
      }
    } catch { /* no town: the sheet still saves */ }
    if (seq !== askSeq.current) return
    setDest(d)

    if (label && nearStart) {
      setPlace(label)
      return
    }
    // The neighbourhood, from the circles the app uses. With the town
    // already known this is a lookup in a cached table, never a geocode.
    if (!d) {
      setPlace(null)
      return
    }
    try {
      const pl = await resolvePlaceLabel(p.lat, p.lng, d.town)
      if (seq !== askSeq.current) return
      const hood = pl.neighborhood && pl.neighborhood.toLowerCase() !== d.town.toLowerCase() ? pl.neighborhood : null
      setPlace(hood ? `${hood}, ${d.town}` : d.town)
    } catch {
      if (seq === askSeq.current) setPlace(d.town)
    }
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
    onClose()
  }

  const onClosed = () => {
    if (state !== 'sent' && state !== 'sending') {
      posthog.capture('spot_sheet_dismissed', {
        surface,
        seconds_on_screen: Math.round((Date.now() - openedAt.current) / 1000),
        affordance: closedBy.current,
        picked: !!choice,
      })
    }
    onClose()
  }

  const send = async () => {
    if (!choice || needsDetail || state === 'sending' || photo.status === 'working') return
    setState('sending')
    const form = new FormData()
    form.append('report', JSON.stringify({
      surface,
      kinds: [choice],
      detail: choice === 'map_wrong' ? null : detail,
      access_barrier: choice !== 'map_wrong' && access,
      note: note.trim() || null,
      segment: { lat: Number(pin.lat.toFixed(6)), lng: Number(pin.lng.toFixed(6)), ...(place ? { label: place.slice(0, 120) } : {}) },
    }))
    if (photo.status === 'ready') form.append('photo', photo.blob, 'spot.jpg')
    try {
      const res = await fetch('/api/spot/report', { method: 'POST', body: form })
      const data = await res.json().catch(() => null) as Record<string, unknown> | null
      if (res.ok && data?.ok) {
        const d = data.destination as SpotDestination | null | undefined
        const h = data.held as { owner?: unknown; street?: unknown } | null | undefined
        const held: SpotHeld | null = h && (h.owner === 'massdot' || h.owner === 'dcr' || h.owner === 'state')
          ? { owner: h.owner, street: typeof h.street === 'string' ? h.street : null }
          : null
        setAnswer({
          id: typeof data.id === 'string' ? data.id : null,
          destination: d && typeof d.town === 'string' ? d : null,
          held,
        })
        setState('sent')
        // Never the note: what was picked, and what came with it.
        posthog.capture('spot_reported', {
          surface,
          kind: choice,
          detail,
          access_barrier: choice !== 'map_wrong' && access,
          held: held?.owner ?? null,
          has_photo: photo.status === 'ready',
          has_note: !!note.trim(),
          has_town: !!d?.town,
          has_town_page: !!safeUrl(d?.url),
          seconds_on_screen: Math.round((Date.now() - openedAt.current) / 1000),
        })
        return
      }
      setState(res.status === 429 ? 'too_many' : 'error')
      posthog.capture('spot_report_failed', { surface, status: res.status })
    } catch {
      setState('error')
      posthog.capture('spot_report_failed', { surface, status: 0 })
    }
  }

  // Thanks: the town's page opens in a new tab with the words copied. A real
  // link, so no browser blocks it as a pop-up; the copy starts first.
  const kindDetails = choice && isSpotKind(choice) ? SPOT_DETAILS[choice] : undefined
  const needsDetail = !!kindDetails && !detail
  const notForTown = !!choice && NOT_FOR_TOWN.has(`${choice}:${detail ?? ''}`)
  const townUrl = answer?.held || notForTown ? null : safeUrl(answer?.destination?.url)
  const town = answer?.destination?.town ?? null
  const handoffText = choice && isSpotKind(choice) ? copiedText(choice, detail, place, note, pin.lat, pin.lng, access) : ''
  const openTownPage = () => {
    void copyToClipboard(handoffText).then((ok) => setCopyFailed(!ok))
    if (answer?.id) {
      void fetch('/api/spot/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoff: answer.id }),
        keepalive: true,
      }).catch(() => {})
    }
    posthog.capture('spot_handoff_opened', { surface })
  }

  // The line above Send: what happens next.
  const nextLine = choice === 'map_wrong'
    ? 'This comes to Green Streets, and we’ll fix the map.'
    : notForTown
      ? 'We’ll save it and show it to people walking here.'
    : dest && safeUrl(dest.url)
      ? `Next: send it to ${dest.town}. We’ll open their report page with your words copied.`
      : dest
        ? `We’ll save it and show it to people walking here. We don’t have ${dest.town}’s report page yet.`
        : 'We’ll save it and show it to people walking here.'

  const chip = (on: boolean) =>
    `min-h-[44px] cursor-pointer rounded-full border px-3.5 text-left text-[0.9375rem] font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F] ${
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
      onCancel={(e) => {
        // Escape closes the photo first, then the sheet.
        if (lightbox) { e.preventDefault(); return }
        closedBy.current = 'escape'
      }}
      onPointerDown={(e) => { pressStartedOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (e.target === e.currentTarget && pressStartedOnBackdrop.current) close('backdrop') }}
      className="m-0 mt-auto max-h-[92vh] w-full max-w-none rounded-t-2xl bg-white p-0 text-[#191A2E] shadow-[0_-8px_32px_rgba(25,26,46,0.18)] backdrop:bg-[rgba(25,26,46,0.55)] sm:m-auto sm:max-w-[480px] sm:rounded-2xl"
    >
      {open && (
        <div className="flex max-h-[92vh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[rgba(25,26,46,0.08)] px-5 pb-3 pt-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[1.0625rem] font-extrabold leading-snug">Report a spot</h2>
              {state !== 'sent' && (
                <p className="mt-0.5 text-[0.9375rem] leading-snug text-[#4A4D68]">
                  Something in the way when you walk? Tell us where, and we&apos;ll help you send it to the town.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => close('close')}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[rgba(25,26,46,0.15)] text-[#4A4D68] transition-colors hover:bg-[#F4F8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>

          {state === 'sent' ? (
            <div className="px-5 pb-2 pt-6" role="status">
              {choice === 'map_wrong' ? (
                <p className="text-[1.0625rem] font-bold">Thanks. We&apos;ll fix the map.</p>
              ) : answer?.held ? (
                <>
                  <p className="text-[1.0625rem] font-bold">Thanks.</p>
                  <p className="mt-1 text-[0.9375rem] text-[#4A4D68]">
                    This street belongs to {OWNER_NAMES[answer.held.owner]}, not {town ?? 'the town'}, so {town ?? 'the town'} can&apos;t fix it.
                    We&apos;ve saved it, and people walking here will see it on their route.
                  </p>
                </>
              ) : townUrl && town ? (
                <>
                  <p className="text-[1.0625rem] font-bold">Saved. Now tell {town}.</p>
                  <p className="mt-1 text-[0.9375rem] text-[#4A4D68]">
                    People walking here will see it on their route. {town} can fix it once they hear about it.
                  </p>
                  <a
                    href={townUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={openTownPage}
                    className={`${primary} mt-5 flex items-center justify-center px-4 text-center`}
                  >
                    Open {town}&apos;s report page
                  </a>
                  <p className="mt-2 text-center text-[0.875rem] text-[#4A4D68]">
                    Your words and the spot are copied. Paste them in.
                  </p>
                  {copyFailed && (
                    <textarea
                      readOnly
                      value={handoffText}
                      rows={3}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Your words and the spot"
                      className="mt-2 block w-full resize-none rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.15)] bg-white px-3 py-2.5 text-[0.9375rem] text-[#191A2E]"
                    />
                  )}
                </>
              ) : (
                <p className="text-[1.0625rem] font-bold">Thanks. People walking here will see it on their route.</p>
              )}
              <div className="pt-4" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
                <button
                  type="button"
                  onClick={() => close('done')}
                  className="min-h-[48px] w-full cursor-pointer rounded-full border border-[rgba(25,26,46,0.18)] bg-white text-[1rem] font-bold text-[#191A2E] transition-colors hover:border-[#2D6A4F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                {/* Photo (optional) */}
                <input ref={takeRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
                <input ref={chooseRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
                {photo.status === 'ready' ? (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setLightbox(true)} aria-label="See the photo" className="shrink-0 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="h-16 w-20 rounded-lg object-cover" />
                    </button>
                    <p className="min-w-0 flex-1 text-[0.9375rem] font-semibold">Photo added</p>
                    <button type="button" onClick={() => setPhoto({ status: 'none' })}
                      className="min-h-[44px] cursor-pointer px-2 text-[0.9375rem] font-semibold text-[#4A4D68] underline underline-offset-[3px] hover:text-[#191A2E]">
                      Remove
                    </button>
                  </div>
                ) : photo.status === 'working' ? (
                  <p className="text-[0.9375rem] text-[#4A4D68]" role="status">Adding the photo…</p>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {/* A computer has no camera to choose: only the files. */}
                      {canTakePhoto && (
                        <button type="button" onClick={() => takeRef.current?.click()} className={quietButton}>
                          <Camera size={18} aria-hidden /> Take a photo
                        </button>
                      )}
                      <button type="button" onClick={() => chooseRef.current?.click()} className={quietButton}>
                        <ImageIcon size={18} aria-hidden /> Choose a photo
                      </button>
                    </div>
                    <p className="mt-1.5 text-[0.875rem] text-[#4A4D68]">A photo is optional. Leave out faces and license plates.</p>
                    {photo.status === 'failed' && (
                      <p role="alert" className="mt-1 text-[0.9375rem] text-[#9B2C2C]">That photo didn&apos;t work. Try another.</p>
                    )}
                  </div>
                )}

                {/* What's wrong: one tap */}
                <fieldset className="m-0 mt-5 border-0 p-0">
                  <legend className="mb-2 text-[0.9375rem] font-bold">What&apos;s wrong?</legend>
                  <div role="radiogroup" aria-labelledby={`${titleId}-what`}>
                  <span id={`${titleId}-what`} className="sr-only">What&apos;s wrong?</span>
                  <div className="flex flex-wrap gap-2">
                    {SPOT_KINDS.map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={choice === k} onClick={() => { setChoice(k); setDetail(null) }} className={chip(choice === k)}>
                        {SPOT_LABELS[k]}
                      </button>
                    ))}
                  </div>
                  {/* The second tap, where it decides who fixes it */}
                  {kindDetails && (
                    <div className="mt-3">
                      <p id={`${titleId}-which`} className="mb-2 text-[0.9375rem] text-[#4A4D68]">Which one?</p>
                      <div role="radiogroup" aria-labelledby={`${titleId}-which`} className="flex flex-wrap gap-2">
                        {kindDetails.map((d) => (
                          <button key={d.key} type="button" role="radio" aria-checked={detail === d.key} onClick={() => setDetail(d.key)} className={chip(detail === d.key)}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={choice === 'map_wrong'}
                    onClick={() => { setChoice('map_wrong'); setDetail(null) }}
                    className={`mt-2 inline-flex min-h-[44px] cursor-pointer items-center rounded-full px-1 text-[0.9375rem] font-semibold underline underline-offset-[3px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F] ${
                      choice === 'map_wrong' ? 'text-[#2D6A4F] decoration-[#2D6A4F]' : 'text-[#4A4D68] decoration-[rgba(74,77,104,0.45)] hover:text-[#191A2E]'
                    }`}
                  >
                    {choice === 'map_wrong' ? '✓ ' : ''}This map is wrong
                  </button>
                  </div>
                </fieldset>

                {/* Where */}
                <p className="mt-4 text-[0.9375rem] font-bold">Where is it?</p>
                <p className="text-[0.875rem] text-[#4A4D68]">Move the map so the pin is on the spot.</p>
                <SpotPinMap start={spot} onSettle={settle} />
                {place && <p className="mt-1.5 text-[0.9375rem] text-[#191A2E]">Near {place}</p>}

                {choice && choice !== 'map_wrong' && (
                  <label className="mt-5 flex min-h-[44px] cursor-pointer items-center gap-3 text-[0.9375rem] text-[#191A2E]">
                    <input
                      type="checkbox"
                      checked={access}
                      onChange={(e) => setAccess(e.target.checked)}
                      className="h-5 w-5 shrink-0 cursor-pointer accent-[#2D6A4F]"
                    />
                    It makes it hard for wheelchairs or strollers
                  </label>
                )}

                {/* Note (optional) */}
                <label className="mt-5 block text-[0.9375rem] font-bold" htmlFor={`${titleId}-note`}>
                  Anything to add? <span className="font-normal text-[#4A4D68]">(optional)</span>
                </label>
                <textarea
                  id={`${titleId}-note`}
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                  maxLength={NOTE_MAX}
                  rows={3}
                  placeholder={choice === 'spot_other' ? 'What’s in the way?' : undefined}
                  aria-describedby={`${titleId}-count`}
                  className="mt-1.5 block w-full resize-none rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.15)] bg-white px-3 py-2.5 text-[1rem] text-[#191A2E] outline-none placeholder:text-[#6B6E85] focus:border-[#2D6A4F]"
                />
                <p id={`${titleId}-count`} className="mt-1 text-right text-[0.875rem] tabular-nums text-[#4A4D68]">
                  {NOTE_MAX - note.length} left
                </p>
              </div>

              <div className="border-t border-[rgba(25,26,46,0.08)] px-5 pt-3" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
                {state === 'error' || state === 'too_many' ? (
                  <p role="alert" className="mb-2 text-[0.9375rem] text-[#9B2C2C]">
                    {state === 'too_many'
                      ? "That's a lot of reports from here in one hour. Please try again later."
                      : "Couldn't send. Try again."}
                  </p>
                ) : (
                  <p className="mb-2 text-[0.9375rem] leading-snug text-[#4A4D68]">{nextLine}</p>
                )}
                <button
                  type="button"
                  onClick={send}
                  disabled={!choice || needsDetail || state === 'sending' || photo.status === 'working'}
                  className={primary}
                >
                  {state === 'sending' ? 'Sending…' : !choice ? 'Pick what’s wrong first' : needsDetail ? 'Pick one above' : 'Send'}
                </button>
              </div>
            </>
          )}

          {lightbox && photo.status === 'ready' && (
            <PhotoLightbox src={photo.url} alt="Your photo" onClose={() => setLightbox(false)} />
          )}
        </div>
      )}
    </dialog>
  )
}
