'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, ImagePlus, Lock, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EventsToneProvider, toneClass } from '@/components/events/EventsTone'
import '@/components/events/events-tone.css'
import EmailCode from './EmailCode'
import PhotoViewer from './PhotoViewer'
import { PrepError, isVideo, preparePhoto, prepareVideo, videoType } from './prepare-media'
import {
  ApiError, clockTime, consoleSignIn, countLine, dayLabel, duration, fetchAlbum, fileName, post, readGuest, shortDate, writeGuest,
  type AlbumRef, type AlbumResponse, type Guest,
} from './photo-api'

interface Slot { path: string; token?: string; signed_url?: string; error?: string }
interface AddResult { path: string; id?: string; status: string; message?: string }
interface Summary { total: number; added: number; pending: number; appOnly: number; blocked: number; errors: { name: string; message: string }[] }

/** Runs `fn` over `items`, `n` at a time. */
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

async function upload(slot: Slot, body: Blob, contentType: string) {
  if (!slot.token) throw new PrepError('That upload didn’t start. Try again.')
  const { error } = await supabase.storage.from('event-photos').uploadToSignedUrl(slot.path, slot.token, body, { contentType })
  if (error) throw new PrepError('That upload didn’t finish. Try again.')
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export default function PhotoAlbum({ initial, preview, albumRef, back, autoAdd = false, goingHref }: {
  initial: AlbumResponse
  preview: string
  /** A Shift ride date's album, reached by the ride's link code; default: the calendar event. */
  albumRef?: AlbumRef
  /** A link back to the ride's page. */
  back?: { href: string; label: string }
  /** Arrived from an "Add yours" button: open the first step of adding. */
  autoAdd?: boolean
  /** An invite-only ride: where to say Going (the ride page's Going card). */
  goingHref?: string
}) {
  const [data, setData] = useState(initial)
  const [guest, setGuest] = useState<Guest | null>(null)
  // For callbacks that finish after a confirm step changed who's signed in.
  const guestRef = useRef<Guest | null>(null)
  useEffect(() => { guestRef.current = guest }, [guest])
  const eventId = initial.event.id
  // Every call names the album the same way the page was opened.
  const ref = useMemo<AlbumRef>(() => albumRef ?? { event: eventId }, [albumRef, eventId])
  const { album, photos, event } = data

  // ---- The album, again with the person's token (their own photos, Remove) ----
  const refresh = useCallback(async (g: Guest | null) => {
    try {
      const next = await fetchAlbum(ref, preview, g?.token)
      if (!next) return
      if (g && next.album.needs_code) {
        // The token has expired or isn't valid any more: confirm again next time.
        writeGuest(null)
        setGuest(null)
      }
      setData(next)
    } catch { /* keep what's on screen */ }
  }, [ref, preview])

  useEffect(() => {
    const g = readGuest()
    // From an "Add yours" button: straight to the email step, or to choosing
    // (a file picker can't open without a tap of its own).
    if (autoAdd && initial.album.state === 'open' && !initial.album.locked) setStep(g ? 'choose' : 'email')
    // Invite-only, not confirmed yet: the email step is the way in.
    if (autoAdd && initial.album.locked === 'code' && !g) setStep('email')
    if (!g) return
    setGuest(g)
    refresh(g)
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  // A calendar event's own organizer, signed in to the console in this
  // browser: load again with that sign-in so Remove shows on every photo.
  useEffect(() => {
    if (!('event' in ref) || readGuest()) return
    let live = true
    consoleSignIn().then((t) => { if (live && t) void refresh(null) })
    return () => { live = false }
  }, [ref, refresh])

  // ---- Adding ----
  const fileRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<'idle' | 'email' | 'choose'>('idle')
  const [picked, setPicked] = useState<{ file: File; preview: string | null }[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const room = Math.max(0, album.max_per_person - album.mine_count)

  useEffect(() => () => picked.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), [picked])

  function startAdd() {
    setSummary(null)
    setAddError(null)
    if (guest) {
      fileRef.current?.click()
    } else {
      setStep('email')
      requestAnimationFrame(() => addRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    }
  }

  function onVerified(g: Guest) {
    setGuest(g)
    // Confirming to see an invite-only ride's photos isn't asking to add any.
    setStep(album.locked ? 'idle' : 'choose')
    refresh(g)
  }

  function notMe() {
    writeGuest(null)
    setGuest(null)
    setStep('idle')
    setPicked([])
    setSummary(null)
    refresh(null)
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setStep('idle')
    setSummary(null)
    setAddError(null)
    setPicked(files.map((file) => ({ file, preview: isVideo(file) ? null : URL.createObjectURL(file) })))
    requestAnimationFrame(() => addRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  async function share() {
    if (!guest) {
      setStep('email')
      return
    }
    const files = picked.slice(0, room).map((p) => p.file)
    if (files.length === 0) return
    const total = files.length
    const out: Summary = { total, added: 0, pending: 0, appOnly: 0, blocked: 0, errors: [] }
    setProgress({ done: 0, total })
    setAddError(null)

    // One upload slot per photo; a video gets two (the video and its still).
    const specs = files.flatMap((f) => (isVideo(f) ? [{ ext: videoType(f)?.ext ?? 'mp4' }, { ext: 'jpg' }] : [{ ext: 'jpg' }]))
    const slots: Slot[] = []
    try {
      for (let i = 0; i < specs.length; i += 60) {
        const r = await post<{ files: Slot[] }>({ action: 'upload_urls', web: true, ...ref, preview, files: specs.slice(i, i + 60) }, guest.token)
        slots.push(...r.files)
      }
    } catch (err) {
      setProgress(null)
      if (err instanceof ApiError && err.status === 401) {
        writeGuest(null)
        setGuest(null)
        setStep('email')
        setAddError('Confirm your email again to add photos.')
      } else {
        setAddError(err instanceof ApiError ? err.message : 'Something went wrong. Try again in a minute.')
      }
      return
    }

    let k = 0
    const jobs = files.map((file) => {
      const main = slots[k++]
      const still = isVideo(file) ? slots[k++] : undefined
      return { file, main, still }
    })
    let done = 0
    await pool(jobs, 2, async ({ file, main, still }) => {
      try {
        let item: Record<string, unknown>
        if (isVideo(file)) {
          const v = await prepareVideo(file, album.max_video_seconds)
          if (!still) throw new PrepError('That upload didn’t start. Try again.')
          await upload(main, v.file, v.contentType)
          await upload(still, v.poster, 'image/jpeg')
          item = { path: main.path, kind: 'video', width: v.width, height: v.height, duration_s: v.duration_s, poster_path: still.path, frames: v.frames }
        } else {
          const p = await preparePhoto(file)
          await upload(main, p.blob, 'image/jpeg')
          item = { path: main.path, kind: 'photo', width: p.width, height: p.height, ...(p.taken_at ? { taken_at: p.taken_at } : {}) }
        }
        const r = await post<{ items: AddResult[] }>({ action: 'add', web: true, ...ref, preview, items: [item] }, guest.token)
        const res = r.items[0]
        if (res?.status === 'ok') out.added++
        else if (res?.status === 'pending') out.pending++
        else if (res?.status === 'app_only') out.appOnly++
        else if (res?.status === 'blocked') out.blocked++
        else out.errors.push({ name: file.name, message: res?.message ?? 'Couldn’t add that one.' })
      } catch (err) {
        out.errors.push({
          name: file.name,
          message: err instanceof PrepError || err instanceof ApiError ? err.message : 'Couldn’t add that one.',
        })
      }
      done++
      setProgress({ done, total })
    })

    setProgress(null)
    setPicked([])
    setSummary(out)
    await refresh(guest)
  }

  // ---- Save all ----
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null)
  const [ready, setReady] = useState<File[] | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveable = photos.filter((p) => p.url)
  const zipName = `${event.title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'ride'}-photos.zip`

  async function zipAndSave(files: File[]) {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const f of files) zip.file(f.name, f)
    // Photos and videos are already compressed: store them as they are.
    saveBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), zipName)
  }

  async function saveAll() {
    setSaveError(null)
    setReady(null)
    const list = saveable
    const files: File[] = new Array(list.length)
    let done = 0
    setSaving({ done: 0, total: list.length })
    try {
      await pool(list.map((p, i) => ({ p, i })), 4, async ({ p, i }) => {
        const r = await fetch(p.url!)
        if (!r.ok) throw new Error(String(r.status))
        const b = await r.blob()
        files[i] = new File([b], fileName(p, i), { type: b.type || (p.kind === 'video' ? 'video/mp4' : 'image/jpeg') })
        done++
        setSaving({ done, total: list.length })
      })
      // On a phone, the share menu's "Save" puts them straight into Photos.
      // It needs a fresh tap, so it's a second button once they're ready.
      const phone = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
      if (phone && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
        setReady(files)
      } else {
        await zipAndSave(files)
      }
    } catch {
      setSaveError('Couldn’t get all of them. Try again in a minute.')
    } finally {
      setSaving(null)
    }
  }

  async function shareReady() {
    if (!ready) return
    try {
      await navigator.share({ files: ready })
      setReady(null)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      await zipAndSave(ready).catch(() => setSaveError('Couldn’t save them. Try again in a minute.'))
      setReady(null)
    }
  }

  // ---- Viewer ----
  const [open, setOpen] = useState<number | null>(null)
  function onRemoved(id: string) {
    const left = photos.filter((p) => p.id !== id)
    setData((d) => ({ ...d, photos: d.photos.filter((p) => p.id !== id), album: { ...d.album, count: Math.max(0, d.album.count - 1) } }))
    if (left.length === 0) setOpen(null)
    else if (open != null && open >= left.length) setOpen(left.length - 1)
    refresh(guestRef.current)
  }

  // ---- Words ----
  const locked = album.locked ?? null
  const meta = locked ? '' : [photos.length > 0 ? countLine(photos, album.people) : 'No photos yet', event.organizer_name].filter(Boolean).join(' · ')
  const canAdd = album.state === 'open' && !locked
  const pickedCount = Math.min(picked.length, room)
  const pickedVideos = picked.slice(0, room).filter((p) => isVideo(p.file)).length
  const pickedNoun = pickedVideos === 0 ? plural(pickedCount, 'photo', 'photos') : pickedVideos === pickedCount ? plural(pickedCount, 'video', 'videos') : 'photos and videos'

  const primary = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-5 text-[16px] font-bold text-(--ev-on-accent-fill) hover:opacity-90 disabled:opacity-60'
  const secondary = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] border border-(--ev-line-strong) bg-(--ev-card) px-5 text-[16px] font-bold text-(--ev-ink) hover:bg-(--ev-panel) disabled:opacity-60'

  return (
    <EventsToneProvider tone="light">
      <div className={`min-h-screen bg-(--ev-bg) px-4 pb-24 pt-6 sm:px-8 sm:pt-10 ${toneClass('light')}`}>
        <div className="mx-auto max-w-[1040px]">
          {/* ---- Header ---- */}
          {back && (
            <a href={back.href} className="mb-3 inline-flex min-h-[44px] items-center text-[15px] font-semibold text-(--ev-accent) hover:underline">
              ← {back.label}
            </a>
          )}
          <p className="text-[14px] font-semibold text-(--ev-accent)">Photos · {dayLabel(event.date)}</p>
          <h1 className="mt-2 font-display text-[clamp(26px,4vw,40px)] font-extrabold leading-[1.1] tracking-tight text-(--ev-ink)">
            {event.title}
          </h1>
          {meta && <p className="mt-2 text-[15px] font-medium text-(--ev-ink-80)">{meta}</p>}

          {/* ---- Invite-only, and not (yet) on the list: one line and the way in ---- */}
          {locked && (
            <div className="mt-6 max-w-[560px] rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5 shadow-(--ev-shadow)" aria-live="polite">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-ink)" aria-hidden>
                  <Lock size={20} />
                </span>
                <p className="pt-1 text-[16px] leading-snug text-(--ev-ink)">
                  <span className="font-bold">These photos are just for people who said Going.</span>{' '}
                  {locked === 'code'
                    ? 'Confirm the email you used to see them.'
                    : <><span className="font-semibold">{guest?.email || 'That email'}</span> hasn&apos;t said Going yet.</>}
                </p>
              </div>
              {locked === 'code' && step === 'email' && !guest ? (
                <div className="mt-4">
                  <EmailCode
                    albumRef={ref} preview={preview} purpose="view"
                    intro="We'll send a 6-digit code to it."
                    onVerified={onVerified}
                    onCancel={() => setStep('idle')}
                  />
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {locked === 'code' ? (
                    <>
                      <button type="button" onClick={() => setStep('email')} className={primary}>Confirm my email</button>
                      {goingHref && <a href={goingHref} className={secondary}>Say Going</a>}
                    </>
                  ) : (
                    <>
                      {goingHref && <a href={goingHref} className={primary}>Say Going</a>}
                      <button type="button" onClick={() => { notMe(); setStep('email') }} className={secondary}>Use another email</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {!locked && album.state === 'soon' && (
            <p className="mt-2 text-[15px] text-(--ev-ink-80)">Photos open when the ride starts, {dayLabel(event.date)} at {clockTime(album.starts_at)}.</p>
          )}
          {!locked && album.state === 'closed' && album.add_closes_at && (
            <p className="mt-2 text-[15px] text-(--ev-ink-80)">Adding photos closed on {shortDate(album.add_closes_at)}.</p>
          )}

          {/* ---- Add and save ---- */}
          {(canAdd || saveable.length > 0) && (
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {canAdd && room > 0 && !progress && (
                <button type="button" onClick={startAdd} className={primary}>
                  <ImagePlus size={19} /> Add your photos
                </button>
              )}
              {saveable.length > 0 && (
                <button type="button" onClick={saveAll} disabled={!!saving} className={secondary}>
                  <Download size={18} />
                  {saving ? `Getting ${saving.done} of ${saving.total}…` : `Save all (${saveable.length})`}
                </button>
              )}
            </div>
          )}
          {canAdd && guest && (
            <p className="mt-2 text-[14px] text-(--ev-ink-75)">
              Adding as {guest.first_name || guest.email}.{' '}
              <button type="button" onClick={notMe} className="font-semibold text-(--ev-accent) hover:underline">Not you?</button>
            </p>
          )}
          {canAdd && room === 0 && (
            <p className="mt-2 text-[15px] text-(--ev-ink-80)">You&apos;ve added {album.max_per_person}, the most for one ride.</p>
          )}
          {saveError && <p role="alert" className="mt-2 text-[14px] font-semibold text-(--ev-danger)">{saveError}</p>}
          {ready && (
            <div className="mt-3 rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-4">
              <p className="text-[15px] font-semibold text-(--ev-ink)">{ready.length} ready to save.</p>
              <button type="button" onClick={shareReady} className={`${primary} mt-3 w-full sm:w-auto`}>
                <Download size={18} /> Save {ready.length} to your phone
              </button>
            </div>
          )}

          <div ref={addRef} aria-live="polite">
            {canAdd && step === 'email' && !guest && (
              <div className="mt-4 max-w-[520px] rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5 shadow-(--ev-shadow)">
                <p className="text-[17px] font-bold text-(--ev-ink)">Add your photos</p>
                {addError && <p role="alert" className="mt-1 text-[14px] font-semibold text-(--ev-danger)">{addError}</p>}
                <div className="mt-2">
                  <EmailCode
                    albumRef={ref} preview={preview}
                    intro="First, your email. We'll send a 6-digit code. You only do this once."
                    onVerified={onVerified}
                    onCancel={() => setStep('idle')}
                  />
                </div>
              </div>
            )}

            {canAdd && step === 'choose' && guest && picked.length === 0 && (
              <div className="mt-4 max-w-[520px] rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5 shadow-(--ev-shadow)">
                <p className="text-[17px] font-bold text-(--ev-ink)">You&apos;re all set, {guest.first_name}.</p>
                <p className="mt-1 text-[15px] text-(--ev-ink-80)">Pick the photos and videos from the ride.</p>
                <button type="button" onClick={() => fileRef.current?.click()} className={`${primary} mt-4`}>
                  <ImagePlus size={19} /> Choose photos
                </button>
              </div>
            )}

            {picked.length > 0 && !progress && (
              <div className="mt-4 max-w-[640px] rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5 shadow-(--ev-shadow)">
                <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
                  {picked.slice(0, room).slice(0, 15).map((p, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-(--ev-ink)">
                      {p.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.preview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-white"><Play size={20} /></span>
                      )}
                    </div>
                  ))}
                </div>
                {pickedCount > 15 && <p className="mt-2 text-[14px] text-(--ev-ink-75)">and {pickedCount - 15} more</p>}
                {picked.length > room && (
                  <p className="mt-2 text-[14px] text-(--ev-ink-80)">You can add up to {album.max_per_person} to one ride, so we&apos;ll add the first {room}.</p>
                )}
                <p className="mt-3 text-[14px] leading-snug text-(--ev-ink-75)">
                  {event.invite_only ? 'People who said Going to this ride can see them' : 'Anyone with this page\u2019s link can see them'}, with your first name. Anyone in a photo can take it down. We remove where each photo was taken before saving it.
                </p>
                {addError && <p role="alert" className="mt-2 text-[14px] font-semibold text-(--ev-danger)">{addError}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={share} className={primary}>
                    Share {pickedCount} {pickedNoun}
                  </button>
                  <button type="button" onClick={() => { setPicked([]); setAddError(null) }} className="min-h-[48px] rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-80) hover:bg-(--ev-panel)">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {progress && (
              <div className="mt-4 max-w-[520px] rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5">
                <p className="text-[16px] font-semibold text-(--ev-ink)">Adding {Math.min(progress.done + 1, progress.total)} of {progress.total}…</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--ev-track)" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
                  <div className="h-full rounded-full bg-(--ev-accent) transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              </div>
            )}

            {summary && (
              <div className="mt-4 max-w-[520px] rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5">
                <p className="text-[17px] font-bold text-(--ev-ink)">
                  {(() => {
                    const ok = summary.added + summary.pending + summary.appOnly
                    if (ok === 0) return 'Nothing was added.'
                    if (ok === summary.total) return summary.total === 1 ? 'Added. Thank you!' : `All ${summary.total} added. Thank you!`
                    return `Added ${ok} of ${summary.total}.`
                  })()}
                </p>
                <ul className="mt-2 space-y-1 text-[15px] text-(--ev-ink-80)">
                  {summary.pending > 0 && (
                    <li>{summary.pending === 1 ? 'One is' : `${summary.pending} are`} still being checked and will show up for everyone soon.</li>
                  )}
                  {summary.appOnly > 0 && (
                    <li>{summary.appOnly === 1 ? 'One shows' : `${summary.appOnly} show`} only in the Shift app, to people signed in.</li>
                  )}
                  {summary.blocked > 0 && <li>{summary.blocked === 1 ? 'One' : summary.blocked} can&apos;t be shared here.</li>}
                  {summary.errors.map((e, i) => (
                    <li key={i}><span className="font-semibold text-(--ev-ink)">{e.name}</span>: {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ---- The photos ---- */}
          {photos.length > 0 ? (
            <ul className="mt-6 grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2 lg:grid-cols-6" aria-label="Photos and videos">
              {photos.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button" onClick={() => setOpen(i)}
                    aria-label={`${p.kind === 'video' ? 'Video' : 'Photo'} by ${p.poster_name}`}
                    className={`group relative block aspect-square w-full overflow-hidden rounded-md ${p.thumb_url ? 'bg-(--ev-line)' : 'bg-(--ev-ink)'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-accent)`}
                  >
                    {p.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                    ) : p.kind === 'video' ? (
                      <span className="flex h-full w-full items-center justify-center text-white"><Play size={26} fill="currentColor" /></span>
                    ) : null}
                    {p.kind === 'video' && (
                      <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-linear-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-[13px] font-semibold text-white">
                        <Play size={13} fill="currentColor" /> {duration(p.duration_s)}
                      </span>
                    )}
                    {p.status === 'pending' && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[13px] font-semibold text-white">Checking</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : album.state === 'open' && !locked ? (
            <div className="mt-6 rounded-2xl border border-dashed border-(--ev-line-strong) px-5 py-10 text-center">
              <p className="text-[16px] font-semibold text-(--ev-ink)">No photos yet</p>
              <p className="mt-1 text-[15px] text-(--ev-ink-80)">Were you there? Add the first ones.</p>
            </div>
          ) : null}

          {!locked && (
            <p className="mt-10 max-w-[560px] text-[14px] leading-relaxed text-(--ev-ink-75)">
              Anyone in a photo can take it down from the photo itself. This page doesn&apos;t show up in search.
            </p>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" multiple accept="image/*,video/mp4,video/quicktime" className="hidden" onChange={onFiles} />

      {open != null && photos[open] && (
        <PhotoViewer
          photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          guest={guest} onGuest={setGuest} onRemoved={onRemoved}
          albumRef={ref} preview={preview} organizer={!!album.is_organizer}
        />
      )}
    </EventsToneProvider>
  )
}
