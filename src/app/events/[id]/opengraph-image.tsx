/**
 * Social card for a single event — the link that gets pasted into a group
 * chat, a Slack, or a neighborhood list.
 *
 * Cream system, same as the calendar's card, so a shared event reads as the
 * organization. The event's own photo, when it has one, becomes the right-hand
 * panel rather than the whole card: a raw photo cropped to 1.91:1 loses its
 * subject as often as not, and says nothing about when or where.
 *
 * Next emits og:image / twitter:image from this file convention, which is why
 * buildEventPageMetadata sets no images of its own.
 *
 * Nothing here may throw. An OG route that 500s renders no card at all, so
 * every lookup — the event, the photo, the fonts — degrades to something that
 * still prints.
 */
import { ImageResponse } from 'next/og'
import { bricolageFonts } from '@/lib/og-fonts'
import { CREAM, NAVY, FOREST, INK_SOFT } from '@/lib/semester/og-card'
import { townFromAddress } from '@/lib/events-seo'
import {
  parseEventDate, dateMedium, formatTime, isDeadline, getTypeMeta,
  eventRideStyle, formatDistanceText, getTagMeta, RIDE_STYLE_LABEL,
  type CommunityEvent,
} from '@/lib/events'
import { loadEvent } from '../_lib/load'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600
export const alt = 'A community walking, biking or transit event on the Green Streets Initiative calendar'

/** A cropped photo needs less room than a flyer that has to stay readable. */
const PHOTO_WIDTH = 430
const FLYER_WIDTH = 520
/** Past this, inlining the photo costs more memory than the card gains. */
const MAX_PHOTO_BYTES = 4_000_000

/** Headline size by length, so a four-word ride and a conference title both fill the space. */
function titleFontSize(title: string): number {
  if (title.length <= 28) return 82
  if (title.length <= 48) return 68
  if (title.length <= 72) return 56
  return 46
}

function trimToWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** "Wed, Sep 23 · 11 AM–2 PM", or "Entries due Wed, Oct 4" for a deadline. */
function whenLine(event: CommunityEvent): string {
  const day = dateMedium(parseEventDate(event.event_date))
  if (isDeadline(event.event_type)) return `Entries due ${day}`
  if (!event.event_time) return day
  const start = formatTime(event.event_time)
  const end = event.event_end_time ? formatTime(event.event_end_time) : null
  return `${day} · ${end ? `${start}–${end}` : start}`
}

/** "George Sherman Union Plaza, Boston" — the town only when it adds something. */
function whereLine(event: CommunityEvent): string {
  const town = townFromAddress(event.location_address)
  const venue = (event.location_name ?? '').trim()
  // Some listings put the whole street address in the venue name. The room on
  // a card is for the place, not for "14 Tyler St".
  const place = venue.length > 34 && venue.includes(',') ? venue.split(',')[0].trim() : venue
  if (!town || place.toLowerCase().includes(town.toLowerCase())) return place
  return place ? `${place}, ${town}` : town
}

/**
 * "EASY GROUP RIDE · 12 MILES" — what this is, before the name says it. The
 * level reads as an adjective on the type, since "group ride · easy ride"
 * says ride twice, and an unclassified listing says "community event" rather
 * than the bare "Other" the filter list uses.
 */
function eyebrowLine(event: CommunityEvent): string {
  const meta = getTypeMeta(event.event_type)
  const type = meta === getTypeMeta('other') ? 'Community event' : meta.label
  const level = eventRideStyle(event)
  const parts = [level ? `${RIDE_STYLE_LABEL[level]} ${type.toLowerCase()}` : type]
  const distance = formatDistanceText(event.distance_text)
  if (distance) parts.push(distance)
  return parts.join(' · ')
}

/**
 * Pixel dimensions out of the first bytes of a PNG or a JPEG.
 *
 * It doubles as the format gate. Satori decodes PNG and JPEG; handed a WebP it
 * throws deep inside its own image sizing and the whole card 500s, which is
 * how the ABHA social ride's photo took its card down. Anything this can't
 * read is treated as no photo at all — the text card is a fine outcome, a
 * missing card is not. Content-Type is not consulted: the bytes decide.
 */
function probeImage(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue }
        const marker = buf[i + 1]
        // SOFn carries the frame size; DHT/DAC/RSTn in the same range do not.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
        }
        i += 2 + buf.readUInt16BE(i + 2)
      }
    }
  } catch {
    return null
  }
  return null
}

export interface CardPhoto {
  src: string
  /** Wider than it is tall — usually a flyer, and unreadable sliced into a column. */
  wide: boolean
}

/**
 * The event photo as a data URI, with the one fact the layout needs about it.
 * Satori can fetch a remote image itself, but then a slow or broken origin
 * takes the whole card down with it.
 */
async function loadPhoto(url: string | null): Promise<CardPhoto | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_PHOTO_BYTES) return null
    const dims = probeImage(buf)
    if (!dims || !dims.width || !dims.height) return null
    const type = buf[0] === 0xff ? 'image/jpeg' : 'image/png'
    return {
      src: `data:${type};base64,${buf.toString('base64')}`,
      wide: dims.width / dims.height > 1.15,
    }
  } catch {
    return null
  }
}

function Wordmark() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', fontSize: 28, fontWeight: 700 }}>
      <span style={{ color: FOREST }}>Green Streets</span>
      <span style={{ color: NAVY, marginLeft: 9 }}>Initiative</span>
    </span>
  )
}

/** Shown when the event can't be loaded — a card that still says where the link goes. */
function fallbackCard(fonts: Awaited<ReturnType<typeof bricolageFonts>>) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: CREAM,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          fontFamily: 'Bricolage Grotesque',
        }}
      >
        <span style={{ color: FOREST, fontSize: 26, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase' }}>
          Community Events
        </span>
        <span style={{ color: NAVY, fontSize: 82, fontWeight: 800, lineHeight: 1.04, maxWidth: 900 }}>
          Find your next ride, walk, or roll.
        </span>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Wordmark />
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fonts = await bricolageFonts()

  let loaded = null
  try {
    loaded = await loadEvent(id)
  } catch {
    loaded = null
  }
  if (!loaded) return fallbackCard(fonts)

  const { event } = loaded
  const photo = await loadPhoto(event.image_url)
  const panelWidth = photo?.wide ? FLYER_WIDTH : PHOTO_WIDTH
  const textWidth = photo ? size.width - panelWidth : size.width

  const typeInk = getTypeMeta(event.event_type).ink
  const title = trimToWord(event.title.trim(), photo ? 86 : 110)
  const where = whereLine(event)
  // Tags earn their space only on a card with no photo to fill the right side.
  const chips = photo
    ? []
    : event.tags.slice(0, 3).map((t) => getTagMeta(t))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: CREAM,
          display: 'flex',
          fontFamily: 'Bricolage Grotesque',
        }}
      >
        <div
          style={{
            width: textWidth,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px 64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                color: typeInk,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 4,
                textTransform: 'uppercase',
              }}
            >
              {trimToWord(eyebrowLine(event), 52)}
            </span>
            <span
              style={{
                color: NAVY,
                fontSize: titleFontSize(title),
                fontWeight: 800,
                lineHeight: 1.04,
                marginTop: 20,
              }}
            >
              {title}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {chips.length > 0 && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 26 }}>
                {chips.map((c) => (
                  <div
                    key={c.label}
                    style={{
                      display: 'flex',
                      border: `2px solid ${c.ink}33`,
                      backgroundColor: `${c.ink}12`,
                      borderRadius: 999,
                      padding: '8px 22px',
                    }}
                  >
                    <span style={{ color: c.ink, fontSize: 24, fontWeight: 700 }}>{c.label}</span>
                  </div>
                ))}
              </div>
            )}
            <span style={{ display: 'flex', color: NAVY, fontSize: 36, fontWeight: 700 }}>
              {whenLine(event)}
            </span>
            {where && (
              <span
                style={{
                  display: 'flex',
                  color: INK_SOFT,
                  fontSize: 30,
                  fontWeight: 400,
                  marginTop: 8,
                }}
              >
                {trimToWord(where, photo ? 42 : 70)}
              </span>
            )}
            <div style={{ width: 64, height: 5, backgroundColor: FOREST, borderRadius: 3, display: 'flex', marginTop: 30 }} />
            <div style={{ display: 'flex', marginTop: 18 }}>
              <Wordmark />
            </div>
          </div>
        </div>

        {photo && (
          <div
            style={{
              width: panelWidth,
              height: size.height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // A flyer sits on navy like a poster on a wall; a photo fills
              // the panel edge to edge and needs no ground behind it.
              backgroundColor: photo.wide ? NAVY : CREAM,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              alt=""
              style={
                photo.wide
                  ? { width: panelWidth - 44, objectFit: 'contain' }
                  : { width: panelWidth, height: size.height, objectFit: 'cover' }
              }
            />
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
    },
  )
}
