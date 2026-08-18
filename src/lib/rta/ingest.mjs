/**
 * RTA GTFS ingest — canonical implementation (Around You M2, Shift app).
 *
 * Refreshes one agency's rows in the shared Supabase project's rta_stops /
 * rta_departures tables from its published GTFS zip. Lives on the website
 * because Supabase edge isolates can't afford the CPU of parsing a 200k-row
 * stop_times.txt (WORKER_RESOURCE_LIMIT, observed 2026-08-18); this module
 * is imported by BOTH the Vercel cron route (weekly automation) and
 * scripts/ingest-rta.mjs (manual backfill).
 *
 * Plain ESM, no Next.js imports. The zip reader is dependency-free
 * (node:zlib inflateRawSync + a minimal central-directory parser) so the
 * website gains no new packages.
 *
 * Schedule semantics (documented in docs/specs/nearby-in-app.md in the
 * Shift repo): calendar.txt patterns win; services defined only in
 * calendar_dates.txt get a derived pattern (dow = union of added dates'
 * weekdays, range = min..max) — required for Trillium feeds, which are
 * calendar_dates-only. Post-midnight times (>24:00:00) stay attributed to
 * their service day.
 */

import { inflateRawSync } from 'node:zlib'

// ── Minimal zip reader ──────────────────────────────────────────

/**
 * @param {Buffer} buf
 * @returns {Map<string, Buffer>} basename → decompressed bytes (wanted files only)
 */
function unzipWanted(buf, wanted) {
  const files = new Map()
  // Find End Of Central Directory (scan back from the end; signature 06054b50).
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error('not a zip (no EOCD)')
  const count = buf.readUInt16LE(eocd + 10)
  let ptr = buf.readUInt32LE(eocd + 16) // central directory offset

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error('bad central directory entry')
    const method = buf.readUInt16LE(ptr + 10)
    const compSize = buf.readUInt32LE(ptr + 20)
    const nameLen = buf.readUInt16LE(ptr + 28)
    const extraLen = buf.readUInt16LE(ptr + 30)
    const commentLen = buf.readUInt16LE(ptr + 32)
    const localOffset = buf.readUInt32LE(ptr + 42)
    const name = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8')
    ptr += 46 + nameLen + extraLen + commentLen

    const base = name.split('/').pop() ?? name
    if (!wanted.has(base)) continue

    // Local header: sizes of name/extra can differ from the central copy.
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('bad local header')
    const lNameLen = buf.readUInt16LE(localOffset + 26)
    const lExtraLen = buf.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + lNameLen + lExtraLen
    const raw = buf.subarray(dataStart, dataStart + compSize)
    files.set(base, method === 0 ? Buffer.from(raw) : inflateRawSync(raw))
  }
  return files
}

// ── CSV ─────────────────────────────────────────────────────────

/** RFC-4180-ish parse for the small files. @param {string} text */
function parseCsv(text) {
  const rows = []
  let field = ''
  let row = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else if (c !== '\r') field += c
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  if (rows.length === 0) return []
  const header = rows[0].map((h, i) => (i === 0 ? h.replace(/^﻿/, '') : h).trim())
  return rows
    .slice(1)
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

/** "25:07:00" → seconds after local midnight (may exceed 86400). */
function timeToSecs(t) {
  const m = (t ?? '').trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

/** "20260818" → "2026-08-18". */
function gtfsDate(d) {
  const m = (d ?? '').trim().match(/^(\d{4})(\d{2})(\d{2})$/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

// ── Ingest ──────────────────────────────────────────────────────

const WANTED = new Set([
  'stops.txt',
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'calendar.txt',
  'calendar_dates.txt',
])

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase service-role client
 * @param {{ slug: string, gtfs_url: string }} agency
 * @returns {Promise<{ stops: number, departures: number, services: number }>}
 */
export async function ingestAgency(supabase, agency) {
  const res = await fetch(agency.gtfs_url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`GTFS download ${res.status} for ${agency.slug}`)
  const files = unzipWanted(Buffer.from(await res.arrayBuffer()), WANTED)

  const text = (name) => {
    const b = files.get(name)
    return b ? b.toString('utf8') : null
  }

  const stopsTxt = text('stops.txt')
  const routesTxt = text('routes.txt')
  const tripsTxt = text('trips.txt')
  const stopTimesTxt = text('stop_times.txt')
  if (!stopsTxt || !routesTxt || !tripsTxt || !stopTimesTxt) {
    throw new Error(`GTFS zip for ${agency.slug} missing required files`)
  }

  const routes = new Map()
  for (const r of parseCsv(routesTxt)) {
    routes.set(r.route_id, { short: r.route_short_name ?? '', long: r.route_long_name ?? '' })
  }

  // service_id → { dow bitmask (Mon=1..Sun=64), start, end }
  const services = new Map()
  const calendarTxt = text('calendar.txt')
  if (calendarTxt) {
    for (const c of parseCsv(calendarTxt)) {
      const dow =
        (c.monday === '1' ? 1 : 0) |
        (c.tuesday === '1' ? 2 : 0) |
        (c.wednesday === '1' ? 4 : 0) |
        (c.thursday === '1' ? 8 : 0) |
        (c.friday === '1' ? 16 : 0) |
        (c.saturday === '1' ? 32 : 0) |
        (c.sunday === '1' ? 64 : 0)
      const start = gtfsDate(c.start_date)
      const end = gtfsDate(c.end_date)
      if (start && end && dow > 0) services.set(c.service_id, { dow, start, end })
    }
  }
  const calendarDatesTxt = text('calendar_dates.txt')
  if (calendarDatesTxt) {
    const derived = new Map()
    for (const cd of parseCsv(calendarDatesTxt)) {
      if (cd.exception_type !== '1' || services.has(cd.service_id)) continue
      const iso = gtfsDate(cd.date)
      if (!iso) continue
      const jsDow = new Date(`${iso}T12:00:00Z`).getUTCDay()
      const bit = jsDow === 0 ? 64 : 1 << (jsDow - 1)
      const cur = derived.get(cd.service_id)
      if (!cur) derived.set(cd.service_id, { dows: bit, min: iso, max: iso })
      else {
        cur.dows |= bit
        if (iso < cur.min) cur.min = iso
        if (iso > cur.max) cur.max = iso
      }
    }
    for (const [sid, d] of derived) services.set(sid, { dow: d.dows, start: d.min, end: d.max })
  }

  const trips = new Map()
  for (const t of parseCsv(tripsTxt)) {
    trips.set(t.trip_id, {
      routeId: t.route_id,
      serviceId: t.service_id,
      headsign: t.trip_headsign ?? '',
      direction: t.direction_id === '0' ? 0 : t.direction_id === '1' ? 1 : null,
    })
  }

  const stopRows = []
  const knownStops = new Set()
  for (const s of parseCsv(stopsTxt)) {
    const lat = Number(s.stop_lat)
    const lng = Number(s.stop_lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !s.stop_id) continue
    stopRows.push({ agency: agency.slug, stop_id: s.stop_id, name: s.stop_name || s.stop_id, lat, lng })
    knownStops.add(s.stop_id)
  }

  // Replace this agency's rows.
  {
    const { error } = await supabase.from('rta_departures').delete().eq('agency', agency.slug)
    if (error) throw new Error(`delete departures: ${error.message}`)
  }
  {
    const { error } = await supabase.from('rta_stops').delete().eq('agency', agency.slug)
    if (error) throw new Error(`delete stops: ${error.message}`)
  }
  for (let i = 0; i < stopRows.length; i += 2000) {
    const { error } = await supabase.from('rta_stops').insert(stopRows.slice(i, i + 2000))
    if (error) throw new Error(`insert stops @${i}: ${error.message}`)
  }

  // stop_times: walk lines, flush every 4000 rows.
  let departures = 0
  let batch = []
  const flush = async () => {
    if (batch.length === 0) return
    const { error } = await supabase.from('rta_departures').insert(batch)
    if (error) throw new Error(`insert departures: ${error.message}`)
    departures += batch.length
    batch = []
  }

  const headerEnd = stopTimesTxt.indexOf('\n')
  const headerLine = stopTimesTxt.slice(0, headerEnd).replace(/^﻿/, '').trim()
  const header = headerLine.split(',')
  const iTrip = header.indexOf('trip_id')
  const iStop = header.indexOf('stop_id')
  const iDep = header.indexOf('departure_time')
  const iArr = header.indexOf('arrival_time')
  if (iTrip < 0 || iStop < 0 || (iDep < 0 && iArr < 0)) {
    throw new Error('stop_times.txt missing required columns')
  }

  let cursor = headerEnd + 1
  while (cursor < stopTimesTxt.length) {
    let lineEnd = stopTimesTxt.indexOf('\n', cursor)
    if (lineEnd === -1) lineEnd = stopTimesTxt.length
    const line = stopTimesTxt.slice(cursor, lineEnd)
    cursor = lineEnd + 1
    if (!line || line.length < 3) continue

    let cols
    if (line.includes('"')) {
      const parsed = parseCsv(`${headerLine}\n${line}`)
      if (parsed.length === 0) continue
      cols = header.map((h) => parsed[0][h] ?? '')
    } else {
      cols = line.replace(/\r$/, '').split(',')
    }

    const trip = trips.get(cols[iTrip])
    if (!trip) continue
    const service = services.get(trip.serviceId)
    if (!service) continue
    const stopId = cols[iStop]
    if (!knownStops.has(stopId)) continue
    const secs = timeToSecs((iDep >= 0 ? cols[iDep] : '') || (iArr >= 0 ? cols[iArr] : ''))
    if (secs === null) continue
    const route = routes.get(trip.routeId)

    batch.push({
      agency: agency.slug,
      stop_id: stopId,
      route_short_name: route?.short ?? '',
      route_long_name: route?.long ?? '',
      headsign: trip.headsign,
      direction_id: trip.direction,
      departure_secs: secs,
      dow: service.dow,
      service_start: service.start,
      service_end: service.end,
      trip_id: cols[iTrip],
    })
    if (batch.length >= 4000) await flush()
  }
  await flush()

  // Feeds are period-scoped and can lapse (WRTA's expired Aug 11 2026 a week
  // before we first ingested it) — record the horizon so the inventory
  // self-reports staleness instead of silently serving nothing.
  let maxServiceEnd = null
  for (const s of services.values()) {
    if (!maxServiceEnd || s.end > maxServiceEnd) maxServiceEnd = s.end
  }
  const today = new Date().toISOString().slice(0, 10)
  const stale = !maxServiceEnd || maxServiceEnd < today
  await supabase
    .from('rta_agencies')
    .update({
      last_ingested_at: new Date().toISOString(),
      ingest_note: stale
        ? `STALE FEED: service ends ${maxServiceEnd ?? 'n/a'} — agency has not published the current period (or the feed URL moved)`
        : `ok; service through ${maxServiceEnd}`,
    })
    .eq('slug', agency.slug)

  return { stops: stopRows.length, departures, services: services.size, maxServiceEnd }
}
