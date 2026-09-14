#!/usr/bin/env node
/**
 * Audit every active Roam's stated distance and time against its own stored
 * route geometry.
 *
 * Usage:
 *   node scripts/seo/audit-roam-distances.mjs            # markdown to stdout
 *   node scripts/seo/audit-roam-distances.mjs --json     # machine output
 *   node scripts/seo/audit-roam-distances.mjs --out seo/reports/YYYY-MM-DD-roam-audit.md
 *
 * WHY. On 2026-09-14 the Roam pages' titles and snippets were changed to lead
 * with the distance ("a 1.5-mile guided route in Cambridge"), which made the
 * stored distance_miles the first thing a searcher reads. That is only a good
 * idea if the number is right.
 *
 * WHAT IS COMPARED — and what is deliberately not. A Roam is an achievable
 * experience, not a survey of a trail's full length, so this script never
 * compares a Roam against an outside source's figure for "the" trail. It
 * compares each Roam's stated distance against the length of the route WE
 * stored for it (roams.route_geometry), plus two weaker cross-checks: the sum
 * of its legs' distances, and the straight-line chain through its required
 * stops (a hard floor — the real route can only be longer). It also checks
 * whether the copy promises a loop the geometry does not close, and whether
 * the implied pace is plausible for the mode.
 *
 * Read-only. Uses the same Supabase env the site's own server pages use
 * (.env.local: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), SELECT only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function die(msg) {
  console.error(`Roam audit failed: ${msg}`)
  process.exit(1)
}
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

// ---- env (.env.local, never printed) ----
function loadEnvLocal() {
  const p = path.join(REPO_ROOT, '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const v = m[2].replace(/^["']|["']$/g, '')
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
}
loadEnvLocal()
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) die('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (expected in .env.local)')

async function select(table, query) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) die(`${res.status} on ${table}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// ---- geometry ----
const R_MI = 3958.7613
function haversineMi([lng1, lat1], [lng2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R_MI * Math.asin(Math.sqrt(a))
}
function pathMi(coords) {
  let d = 0
  for (let i = 1; i < coords.length; i++) d += haversineMi(coords[i - 1], coords[i])
  return d
}
// Same folding as src/lib/roams/queries.ts normalizeRouteGeometry, plus the
// per-leg {lat,lng}[] shape that file mentions but does not draw.
function toLngLat(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const out = []
    for (const p of raw) {
      if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') out.push([p[0], p[1]])
      else if (p && typeof p === 'object' && typeof p.lng === 'number' && typeof p.lat === 'number') out.push([p.lng, p.lat])
      else if (p && typeof p === 'object' && typeof p.longitude === 'number' && typeof p.latitude === 'number') out.push([p.longitude, p.latitude])
    }
    return out.length >= 2 ? out : null
  }
  if (typeof raw === 'object' && Array.isArray(raw.coordinates)) return toLngLat(raw.coordinates)
  return null
}

const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10)
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100)

// Plausible average speeds, door to door, INCLUDING stops. Wide on purpose —
// this is a smell test, not a stopwatch.
const PACE_MPH = {
  walk: [1.5, 4.5],
  bike: [5, 15],
  transit: [3, 30],
  ferry: [3, 30],
  multi: [2, 20],
}

const LOOP_WORDS = /\b(loop|circle|circuit|around the|round trip|out and back|there and back)\b/i

async function main() {
  const today = new Date().toISOString().slice(0, 10)
  const roams = await select(
    'roams',
    `select=id,name,mode,distance_miles,estimated_minutes,hook,description,region,route_geometry,active,event_end&active=eq.true&or=(event_end.is.null,event_end.gte.${today})&order=name.asc`,
  )
  const ids = roams.map((r) => r.id)
  const inList = `(${ids.map((s) => `"${s}"`).join(',')})`
  const [checkpoints, legs] = await Promise.all([
    select('roam_checkpoints', `select=roam_id,label,lat,lng,required,sequence_order&roam_id=in.${inList}&order=sequence_order.asc`),
    select('roam_legs', `select=roam_id,sequence_order,leg_type,estimated_minutes,distance_miles,selected_polyline&roam_id=in.${inList}&order=sequence_order.asc`),
  ])
  const cpBy = new Map()
  for (const c of checkpoints) (cpBy.get(c.roam_id) ?? cpBy.set(c.roam_id, []).get(c.roam_id)).push(c)
  const legBy = new Map()
  for (const l of legs) (legBy.get(l.roam_id) ?? legBy.set(l.roam_id, []).get(l.roam_id)).push(l)

  const rows = roams.map((r) => {
    const geom = toLngLat(r.route_geometry)
    const geomMi = geom ? pathMi(geom) : null
    const closesLoop = geom ? haversineMi(geom[0], geom[geom.length - 1]) < 0.15 : null

    const rl = legBy.get(r.id) ?? []
    const legMiVals = rl.map((l) => l.distance_miles).filter((x) => typeof x === 'number')
    const legMi = legMiVals.length ? legMiVals.reduce((a, b) => a + b, 0) : null
    const legMinVals = rl.map((l) => l.estimated_minutes).filter((x) => typeof x === 'number')
    const legMin = legMinVals.length ? legMinVals.reduce((a, b) => a + b, 0) : null
    const legPolyMi = rl.reduce((acc, l) => {
      const c = toLngLat(l.selected_polyline)
      return c ? (acc ?? 0) + pathMi(c) : acc
    }, null)

    const req = (cpBy.get(r.id) ?? []).filter((c) => c.required && typeof c.lat === 'number' && typeof c.lng === 'number')
    const chainMi = req.length >= 2 ? pathMi(req.map((c) => [c.lng, c.lat])) : null

    const stated = r.distance_miles
    // Best available measurement of OUR route, in order of trust.
    const measured = geomMi ?? legPolyMi ?? legMi ?? null
    const measuredFrom = geomMi != null ? 'route_geometry' : legPolyMi != null ? 'leg polylines' : legMi != null ? 'leg sum' : null
    const diffMi = stated != null && measured != null ? stated - measured : null
    const diffPct = diffMi != null && measured > 0 ? (diffMi / measured) * 100 : null

    const copy = `${r.name ?? ''} ${r.hook ?? ''} ${r.description ?? ''}`
    const copyClaimsLoop = LOOP_WORDS.test(copy)

    const mph = stated != null && r.estimated_minutes ? stated / (r.estimated_minutes / 60) : null
    const [lo, hi] = PACE_MPH[r.mode] ?? PACE_MPH.multi

    const flags = []
    if (stated == null) flags.push('no stated distance')
    if (measured == null) flags.push('no geometry to measure')
    if (diffMi != null && Math.abs(diffMi) > Math.max(0.25, 0.15 * measured)) {
      flags.push(diffMi > 0 ? `stated is ${r1(Math.abs(diffMi))} mi LONGER than route` : `stated is ${r1(Math.abs(diffMi))} mi SHORTER than route`)
    }
    if (chainMi != null && stated != null && stated < chainMi * 0.95) {
      flags.push(`stated ${r1(stated)} mi is below the straight-line floor through its stops (${r1(chainMi)} mi)`)
    }
    // A stored route shorter than the straight line through the stops it visits
    // is physically impossible — the geometry is truncated or missing a leg.
    // That is a MAP problem (the page draws it), separate from the stated number.
    if (chainMi != null && geomMi != null && geomMi < chainMi * 0.95) {
      flags.push(`stored route (${r1(geomMi)} mi) is shorter than the straight line through its own stops (${r1(chainMi)} mi) — geometry incomplete`)
    }
    if (copyClaimsLoop && closesLoop === false) flags.push('copy says loop, route does not return to start')
    // Only a FAST pace is an error signal (distance too long or time too short).
    // A slow one is what a Roam with museums, bakeries or a ferry looks like.
    if (mph != null && mph > hi) flags.push(`implied pace ${r1(mph)} mph is too fast for mode "${r.mode}" (max ${hi})`)
    if (legMi != null && stated != null && Math.abs(legMi - stated) > Math.max(0.25, 0.15 * stated)) {
      flags.push(`legs sum to ${r1(legMi)} mi vs stated ${r1(stated)}`)
    }

    return {
      id: r.id,
      name: r.name,
      mode: r.mode,
      region: r.region,
      stated_miles: stated,
      stated_minutes: r.estimated_minutes,
      measured_miles: r2(measured),
      measured_from: measuredFrom,
      geometry_points: geom?.length ?? 0,
      diff_miles: r2(diffMi),
      diff_pct: r1(diffPct),
      legs: rl.length,
      leg_sum_miles: r2(legMi),
      leg_sum_minutes: legMin,
      required_stops: req.length,
      stop_chain_miles: r2(chainMi),
      closes_loop: closesLoop,
      copy_claims_loop: copyClaimsLoop,
      implied_mph: r1(mph),
      flags,
    }
  })

  const flagged = rows.filter((x) => x.flags.length)
  const out = { audited_at: new Date().toISOString(), roams: rows.length, flagged: flagged.length, rows }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return
  }

  const L = []
  L.push(`# Roam distance audit — ${today}`)
  L.push('')
  L.push(`${rows.length} active Roams. **${flagged.length} flagged.** Measured = length of the route stored for that Roam (\`route_geometry\`), so this compares each Roam against itself, not against any outside source's figure for a trail's full length.`)
  L.push('')
  L.push('| Roam | Mode | Stated | Measured | Δ | Stops floor | Loop? | Pace | Flags |')
  L.push('|---|---|---|---|---|---|---|---|---|')
  const fmt = (v, unit = '') => (v == null ? '—' : `${v}${unit}`)
  for (const x of rows) {
    const delta = x.diff_miles == null ? '—' : `${x.diff_miles > 0 ? '+' : ''}${x.diff_miles} (${x.diff_pct > 0 ? '+' : ''}${x.diff_pct}%)`
    const loop = x.closes_loop == null ? '—' : x.closes_loop ? 'closes' : 'open'
    const loopNote = x.copy_claims_loop ? ` (copy: loop)` : ''
    L.push(
      `| [${x.name}](https://www.gogreenstreets.org/shift/roams/${encodeURIComponent(x.id)}) | ${x.mode} | ${fmt(x.stated_miles, ' mi')} / ${fmt(x.stated_minutes, ' min')} | ${fmt(x.measured_miles, ' mi')}${x.measured_from ? ` (${x.measured_from}, ${x.geometry_points} pts)` : ''} | ${delta} | ${fmt(x.stop_chain_miles, ' mi')} | ${loop}${loopNote} | ${fmt(x.implied_mph, ' mph')} | ${x.flags.length ? x.flags.map((f) => `⚠ ${f}`).join('<br>') : '✓'} |`,
    )
  }
  L.push('')
  L.push('**How to read it.** *Stated* is what the page title, snippet and llms.txt now lead with. *Measured* is our own stored route, walked point to point. *Stops floor* is the straight-line chain through the required stops — a real route can only be longer than this, so a stated distance below it is wrong on its face. *Loop* is whether the stored route ends within 0.15 mi of where it starts; when the copy says "loop" or "circle" and the route is open, the copy is promising more than the route delivers. *Pace* is stated distance over stated time, sanity-checked against a wide band for the mode.')
  L.push('')
  const text = L.join('\n')
  const outPath = arg('out', null)
  if (outPath) {
    const abs = path.resolve(REPO_ROOT, outPath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, text + '\n')
    console.log(`wrote ${outPath} — ${rows.length} roams, ${flagged.length} flagged`)
  } else {
    console.log(text)
  }
}

main().catch((e) => die(e.message))
