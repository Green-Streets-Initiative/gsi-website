'use client'

/**
 * Uploading an ad file, borrowed from the What Moves Us upload
 * (src/app/record/[slug]/FieldRecorder.tsx and src/lib/field-recorder-types.ts):
 * the same accepted types, and the file goes straight from the browser to
 * storage through a signed link, because Vercel caps a request body at 4.5 MB.
 *
 * Before uploading, the browser reads the file itself: its length, a still
 * for the gallery, three frames for the automatic check, and its format, so
 * nothing about the video has to be guessed later.
 *
 * Its messages follow the page's language (`locale`, English by default).
 */
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { creativeStrings } from '@/lib/site-strings/challenges'

export const UPLOAD_TYPES: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm' }
export const ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm'
/** The storage project's own limit today; the server says the same. */
export const MAX_MB = 50

export function typeOf(file: File): string | null {
  if (Object.values(UPLOAD_TYPES).includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return UPLOAD_TYPES[ext] ?? null
}

export interface Probe {
  duration: number
  thumb: string
  sheet: string
  codec: string
  portrait: boolean
}

/** Reads a picked file in the browser. Throws a plain message if it can't. */
export async function probeVideo(file: File, locale: SiteLocale = 'en'): Promise<Probe> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  v.src = url
  try {
    await waitFor(v, 'loadeddata', 20_000)
    const duration = v.duration
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('read')
    const w = v.videoWidth, h = v.videoHeight
    if (!w || !h) throw new Error('read')

    const frame = async (t: number, maxW: number) => {
      v.currentTime = Math.min(Math.max(t, 0.05), duration - 0.05)
      await waitFor(v, 'seeked', 10_000)
      const scale = Math.min(1, maxW / w)
      const c = document.createElement('canvas')
      c.width = Math.round(w * scale)
      c.height = Math.round(h * scale)
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
      return c
    }

    const mid = await frame(duration * 0.5, 1280)
    const thumb = mid.toDataURL('image/jpeg', 0.82)

    const parts = [await frame(duration * 0.1, 480), await frame(duration * 0.5, 480), await frame(duration * 0.9, 480)]
    const sheet = document.createElement('canvas')
    sheet.width = parts.reduce((a, p) => a + p.width, 0)
    sheet.height = parts[0].height
    let x = 0
    const ctx = sheet.getContext('2d')!
    for (const p of parts) { ctx.drawImage(p, x, 0); x += p.width }

    return { duration, thumb, sheet: sheet.toDataURL('image/jpeg', 0.72), codec: await sniffCodec(file), portrait: h > w }
  } catch {
    throw new Error(translator(creativeStrings, locale)('file.cant_read'))
  } finally {
    v.removeAttribute('src')
    v.load()
    URL.revokeObjectURL(url)
  }
}

function waitFor(el: HTMLVideoElement, event: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { cleanup(); reject(new Error('timeout')) }, ms)
    const ok = () => { cleanup(); resolve() }
    const bad = () => { cleanup(); reject(new Error('error')) }
    const cleanup = () => { clearTimeout(t); el.removeEventListener(event, ok); el.removeEventListener('error', bad) }
    el.addEventListener(event, ok, { once: true })
    el.addEventListener('error', bad, { once: true })
  })
}

/** The video format from its sample-entry tag, read from the file's two ends. */
async function sniffCodec(file: File): Promise<string> {
  const chunk = 4 * 1024 * 1024
  const ends = [file.slice(0, chunk), file.slice(Math.max(0, file.size - chunk))]
  const tags: [string, string][] = [['hvc1', 'hevc'], ['hev1', 'hevc'], ['avc1', 'h264'], ['av01', 'av1'], ['vp09', 'vp9'], ['vp08', 'vp8']]
  for (const part of ends) {
    const text = new TextDecoder('latin1').decode(await part.arrayBuffer())
    for (const [tag, codec] of tags) if (text.includes(tag)) return codec
  }
  if (file.type === 'video/webm') return 'vp9'
  return 'unknown'
}

/** Sends the file to its signed link, reporting progress from 0 to 1. */
export function sendFile(uploadUrl: string, file: File, type: string, onProgress: (p: number) => void, locale: SiteLocale = 'en'): Promise<void> {
  const t = translator(creativeStrings, locale)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('content-type', type)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(xhr.status === 413 ? t('upload.over', { mb: MAX_MB }) : t('upload.unfinished'))))
    xhr.onerror = () => reject(new Error(t('upload.unfinished')))
    xhr.send(file)
  })
}
