/**
 * The JPEG with its metadata segments taken out (EXIF and XMP live in APP1,
 * plus comments and the other application blocks), keeping JFIF (APP0), the
 * colour profile (APP2) and Adobe's colour flag (APP14) so it still looks
 * the same. The sheets' canvas re-encode (src/lib/photo/to-jpeg.ts) already
 * left none; this makes it true for any sender. Null when the bytes aren't
 * a well-formed JPEG. Used by /api/spot/report and /api/notes/add.
 */
export function stripJpegMetadata(b: Uint8Array): Uint8Array | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null
  const keep: Uint8Array[] = [b.subarray(0, 2)]
  let scan = false
  let i = 2
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null
    const marker = b[i + 1]
    if (marker === 0xff) { i++; continue } // fill byte
    // Start of scan: the picture itself, to the end.
    if (marker === 0xda) {
      keep.push(b.subarray(i))
      scan = true
      break
    }
    // Markers without a length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      keep.push(b.subarray(i, i + 2))
      i += 2
      continue
    }
    const len = (b[i + 2] << 8) | b[i + 3]
    if (len < 2 || i + 2 + len > b.length) return null
    const isApp = marker >= 0xe0 && marker <= 0xef
    const dropped = (isApp && marker !== 0xe0 && marker !== 0xe2 && marker !== 0xee) || marker === 0xfe
    if (!dropped) keep.push(b.subarray(i, i + 2 + len))
    i += 2 + len
  }
  if (!scan) return null
  const out = new Uint8Array(keep.reduce((a, k) => a + k.length, 0))
  let o = 0
  for (const k of keep) { out.set(k, o); o += k.length }
  return out
}
