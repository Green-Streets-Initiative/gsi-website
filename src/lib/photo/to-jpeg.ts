/*
 * A photo resized and re-encoded in the browser, for Report a spot and
 * route notes. Drawing to a canvas and saving as JPEG keeps only the
 * pixels: the camera's EXIF (including where it was taken) never leaves the
 * device. The server checks the bytes and strips metadata again
 * (src/lib/photo/strip-jpeg.ts).
 *
 * Browser only: call it from an event handler, never during a server render.
 */

export const PHOTO_MAX_EDGE = 1600
export const PHOTO_MAX_BYTES = 1_500_000

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

export async function toJpeg(file: File): Promise<Blob> {
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
