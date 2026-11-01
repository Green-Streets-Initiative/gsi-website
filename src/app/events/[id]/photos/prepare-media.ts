/**
 * Readies a picked file for the album, in the browser, before anything is
 * uploaded.
 *
 * Photos are redrawn through a canvas to a fresh JPEG (at most 2560 px on the
 * long side). The new file carries none of the original's stored details, so
 * the place it was taken never leaves the phone, and a HEIC the browser can
 * open comes out as a JPEG. Videos are uploaded as they are: we read the
 * length (a minute at most), take three frames for the server's image check
 * and keep the first as the still shown in the grid.
 */

export class PrepError extends Error {}

export interface PreparedPhoto {
  kind: 'photo'
  blob: Blob
  width: number
  height: number
  taken_at?: string
}

export interface PreparedVideo {
  kind: 'video'
  file: File
  contentType: string
  width: number
  height: number
  duration_s: number
  poster: Blob
  /** Base64 JPEG, no data: prefix. */
  frames: string[]
}

const PHOTO_MAX = 2560
const PHOTO_QUALITY = 0.82
const FRAME_MAX = 1024
/** The server takes frames up to 600,000 characters; stay well under. */
const FRAME_CHARS = 540_000
/** The bucket's limit. */
const VIDEO_BYTES = 50 * 1024 * 1024

export const isVideo = (f: File) => f.type.startsWith('video/') || /\.(mov|mp4|m4v)$/i.test(f.name)

/** The stored extension and type for a video the bucket accepts, or null. */
export function videoType(f: File): { ext: string; contentType: string } | null {
  const t = f.type.toLowerCase()
  if (t === 'video/quicktime' || /\.mov$/i.test(f.name)) return { ext: 'mov', contentType: 'video/quicktime' }
  if (t === 'video/mp4' || t === 'video/x-m4v' || /\.(mp4|m4v)$/i.test(f.name)) return { ext: 'mp4', contentType: 'video/mp4' }
  return null
}

function canvasFor(w: number, h: number, max: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h))
  const width = Math.max(1, Math.round(w * scale))
  const height = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PrepError('Your browser couldn’t prepare this file.')
  return { canvas, ctx, width, height }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality)
  })
}

// ---------------------------------------------------------------- photos

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')) }
    img.src = url
  })
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let img: HTMLImageElement
  try {
    img = await loadImage(file)
  } catch {
    throw new PrepError('Couldn’t read this photo. Try a JPEG.')
  }
  if (!img.naturalWidth || !img.naturalHeight) throw new PrepError('Couldn’t read this photo. Try a JPEG.')
  // Browsers draw an image turned the way its stored orientation says.
  const { canvas, ctx, width, height } = canvasFor(img.naturalWidth, img.naturalHeight, PHOTO_MAX)
  ctx.drawImage(img, 0, 0, width, height)
  let blob: Blob
  try {
    blob = await toJpeg(canvas, PHOTO_QUALITY)
  } catch {
    throw new PrepError('Couldn’t read this photo. Try a JPEG.')
  }
  const taken_at = await exifTakenAt(file).catch(() => undefined)
  return { kind: 'photo', blob, width, height, taken_at }
}

/**
 * When a JPEG says it was taken (EXIF DateTimeOriginal), read before the
 * redraw drops it. Local wall time with no zone, so read as this browser's.
 */
async function exifTakenAt(file: File): Promise<string | undefined> {
  if (!/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return undefined
  const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer())
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return undefined
  const ascii = (at: number, n: number) => {
    let s = ''
    for (let i = 0; i < n && at + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(at + i))
    return s
  }
  let off = 2
  while (off + 4 <= v.byteLength) {
    const marker = v.getUint16(off)
    if ((marker & 0xff00) !== 0xff00) return undefined
    const len = v.getUint16(off + 2)
    if (marker === 0xffe1 && ascii(off + 4, 4) === 'Exif') {
      const tiff = off + 10
      const little = v.getUint16(tiff) === 0x4949
      const entry = (ifd: number, tag: number): number | null => {
        if (ifd + 2 > v.byteLength) return null
        const count = v.getUint16(ifd, little)
        for (let i = 0; i < count; i++) {
          const e = ifd + 2 + i * 12
          if (e + 12 > v.byteLength) return null
          if (v.getUint16(e, little) === tag) return e
        }
        return null
      }
      const ifd0 = tiff + v.getUint32(tiff + 4, little)
      const exifPtr = entry(ifd0, 0x8769)
      const exifIfd = exifPtr != null ? tiff + v.getUint32(exifPtr + 8, little) : null
      const at = (exifIfd != null ? entry(exifIfd, 0x9003) : null) ?? entry(ifd0, 0x0132)
      if (at == null) return undefined
      const m = ascii(tiff + v.getUint32(at + 8, little), 19).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
      if (!m) return undefined
      const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
    }
    off += 2 + len
  }
  return undefined
}

// ---------------------------------------------------------------- videos

function once(el: HTMLVideoElement, event: string, ms = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { cleanup(); reject(new Error('timeout')) }, ms)
    const ok = () => { cleanup(); resolve() }
    const bad = () => { cleanup(); reject(new Error('error')) }
    const cleanup = () => {
      clearTimeout(t)
      el.removeEventListener(event, ok)
      el.removeEventListener('error', bad)
    }
    el.addEventListener(event, ok)
    el.addEventListener('error', bad)
  })
}

export async function prepareVideo(file: File, maxSeconds: number): Promise<PreparedVideo> {
  const type = videoType(file)
  if (!type) throw new PrepError('Use an MP4 or MOV video.')
  if (file.size > VIDEO_BYTES) throw new PrepError('That video is too big. Try a shorter one.')

  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  try {
    const meta = once(v, 'loadedmetadata')
    v.src = url
    try {
      await meta
    } catch {
      throw new PrepError('Couldn’t read this video. Try an MP4.')
    }
    const d = v.duration
    if (!Number.isFinite(d) || d <= 0 || !v.videoWidth || !v.videoHeight) throw new PrepError('Couldn’t read this video. Try an MP4.')
    if (d > maxSeconds + 0.5) throw new PrepError('Videos can be up to a minute.')

    const { canvas, ctx, width, height } = canvasFor(v.videoWidth, v.videoHeight, FRAME_MAX)
    const frames: string[] = []
    let poster: Blob | null = null
    for (const at of [0.1, 0.5, 0.9]) {
      const seeked = once(v, 'seeked')
      v.currentTime = Math.min(d - 0.05, Math.max(0, d * at))
      try {
        await seeked
      } catch {
        throw new PrepError('Couldn’t read this video. Try an MP4.')
      }
      ctx.drawImage(v, 0, 0, width, height)
      let data = canvas.toDataURL('image/jpeg', 0.7).split(',')[1] ?? ''
      if (data.length > FRAME_CHARS) data = canvas.toDataURL('image/jpeg', 0.45).split(',')[1] ?? ''
      if (data && data.length <= FRAME_CHARS) frames.push(data)
      if (!poster) poster = await toJpeg(canvas, PHOTO_QUALITY).catch(() => null)
    }
    if (!poster || frames.length === 0) throw new PrepError('Couldn’t read this video. Try an MP4.')
    return {
      kind: 'video', file, contentType: type.contentType,
      width: v.videoWidth, height: v.videoHeight, duration_s: Math.round(d * 10) / 10,
      poster, frames,
    }
  } finally {
    v.removeAttribute('src')
    v.load()
    URL.revokeObjectURL(url)
  }
}
