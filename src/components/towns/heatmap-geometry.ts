/**
 * Geometry prep for the town "Where we move" map. Pure functions with no
 * React or MapLibre in them, so a saved layer can be run through them from
 * the command line when the lines look wrong.
 *
 * What the nightly job publishes, per town and mode, is one FeatureCollection
 * of LineStrings. After enrichment (the Shift edge function
 * compute-town-heatmaps) it holds two kinds of feature:
 *
 *   - named corridors redrawn along real street or rail geometry, carrying
 *     `name`, `corridor` (cluster id) and `band` (1–4, how many neighbors);
 *   - the remainder: chains of ~35m grid cells, plus single-cell stubs, with
 *     only `band`.
 *
 * Before enrichment, or when enrichment has not reached a town yet, every
 * feature is a raw 2-point grid cell with no name at all.
 *
 * The street-true runs arrive fragmented. The redraw walks each OSM way on
 * its own, ways split at every intersection, and any stretch where a cell
 * fell under the three-person floor breaks the run. Cambridge's
 * Massachusetts Avenue came as 219 pieces. Measured on that layer, most run
 * ends touch exactly; of the gaps that remain, most are 100–250m, which is
 * what read as dashes on the page.
 *
 * So: per corridor, runs whose ends touch are chained first; then chains are
 * bridged across gaps up to BRIDGE_MAX_M with a straight chord, guarded by
 * bearing so two parallel carriageways or the two arms of a U-shaped path
 * are never stitched across. Each chain becomes contiguous geometry, split
 * only where the band changes, and each piece starts on the exact vertex the
 * previous one ended on. A bridge joins two already-published stretches of
 * the same named street, so it reveals nothing about anyone.
 *
 * A layer with no named features at all (raw) is chained cell-to-cell by
 * shared endpoints and drawn at full weight, so the map is never blank.
 */

export type Pt = [number, number]

type Props = { name?: string; corridor?: string; band?: number } & Record<string, unknown>

/** An unnamed 2-point cell shorter than this is GPS jitter, not a route. */
export const STUB_MAX_M = 60
/** Longest straight chord drawn between two runs of the same corridor. */
export const BRIDGE_MAX_M = 200
/** A chain shorter than this, all in, is dropped as noise. */
export const MIN_CHAIN_M = 40
/** Run ends this close are the same vertex (upstream rounds to ~1m). */
const TOUCH_M = 1.5
/** Bridges longer than this must pass the bearing guard. */
const GUARDED_GAP_M = 30
/** How far back along a run its end tangent is measured. */
const TANGENT_M = 30
/** Chord vs run tangent, on both sides, must be within this. */
const BEARING_TOLERANCE_DEG = 60

function metersPerDegLng(lat: number): number {
  return 111320 * Math.cos((lat * Math.PI) / 180)
}

export function metersBetween(a: Pt, b: Pt): number {
  return Math.hypot((b[1] - a[1]) * 111320, (b[0] - a[0]) * metersPerDegLng(a[1]))
}

export function runLength(c: Pt[]): number {
  let m = 0
  for (let i = 1; i < c.length; i++) m += metersBetween(c[i - 1], c[i])
  return m
}

/** Planar bearing in degrees, 0 = north, clockwise. Fine at street scale. */
function bearing(a: Pt, b: Pt): number {
  const dx = (b[0] - a[0]) * metersPerDegLng(a[1])
  const dy = (b[1] - a[1]) * 111320
  return (Math.atan2(dx, dy) * 180) / Math.PI + (dx < 0 ? 360 : 0)
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** The point roughly `m` meters before the end of a run (or its start). */
function pointBeforeEnd(pts: Pt[], m: number): Pt {
  let acc = 0
  for (let i = pts.length - 1; i > 0; i--) {
    acc += metersBetween(pts[i - 1], pts[i])
    if (acc >= m) return pts[i - 1]
  }
  return pts[0]
}

function pointAfterStart(pts: Pt[], m: number): Pt {
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    acc += metersBetween(pts[i - 1], pts[i])
    if (acc >= m) return pts[i]
  }
  return pts[pts.length - 1]
}

export interface Run {
  pts: Pt[]
  band: number
}

/** Runs oriented head to tail; consecutive runs may touch or need a bridge. */
export interface Chain {
  segs: Run[]
}

function chainStart(c: Chain): Pt {
  return c.segs[0].pts[0]
}
function chainEnd(c: Chain): Pt {
  const last = c.segs[c.segs.length - 1].pts
  return last[last.length - 1]
}
function reversed(c: Chain): Chain {
  return { segs: c.segs.slice().reverse().map((s) => ({ band: s.band, pts: s.pts.slice().reverse() })) }
}
function chainLength(c: Chain): number {
  let m = 0
  for (let i = 0; i < c.segs.length; i++) {
    m += runLength(c.segs[i].pts)
    if (i > 0) m += metersBetween(chainEnd({ segs: [c.segs[i - 1]] }), c.segs[i].pts[0])
  }
  return m
}

/** ~1m endpoint key; upstream rounds coordinates to 1e-5 so shared nodes match exactly. */
function vertexKey(p: Pt): string {
  return `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`
}

/**
 * Phase 1: chain runs whose ends coincide (shared vertex). Linear time via an
 * endpoint index; each run is used once. Works for named runs and for raw
 * grid cells alike.
 */
export function chainTouching(runs: Run[]): Chain[] {
  const unused = new Set<Run>()
  const atKey = new Map<string, Run[]>()
  for (const r of runs) {
    if (r.pts.length < 2) continue
    unused.add(r)
    for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) {
      const k = vertexKey(p)
      const list = atKey.get(k)
      if (list) list.push(r)
      else atKey.set(k, [r])
    }
  }
  const takeAt = (p: Pt, except: Run): Run | null => {
    const list = atKey.get(vertexKey(p))
    if (!list) return null
    for (const r of list) if (r !== except && unused.has(r)) return r
    return null
  }
  const oriented = (r: Run, from: Pt): Run =>
    vertexKey(r.pts[0]) === vertexKey(from) ? r : { band: r.band, pts: r.pts.slice().reverse() }

  const chains: Chain[] = []
  while (unused.size > 0) {
    const seed = unused.values().next().value as Run
    unused.delete(seed)
    const segs: Run[] = [seed]
    // extend forward from the tail
    for (;;) {
      const tail = segs[segs.length - 1]
      const end = tail.pts[tail.pts.length - 1]
      const next = takeAt(end, tail)
      if (!next) break
      unused.delete(next)
      segs.push(oriented(next, end))
    }
    // extend backward from the head
    for (;;) {
      const head = segs[0]
      const start = head.pts[0]
      const prev = takeAt(start, head)
      if (!prev) break
      unused.delete(prev)
      // orient so that prev ENDS at `start`
      const o = oriented(prev, start) // starts at `start`
      segs.unshift({ band: o.band, pts: o.pts.slice().reverse() })
    }
    chains.push({ segs })
  }
  return chains
}

/** Can chain `a` be extended into chain `b` with a bridge from a's end to b's start? Returns the gap or -1. */
function bridgeGap(a: Chain, b: Chain): number {
  const ae = chainEnd(a)
  const bs = chainStart(b)
  const gap = metersBetween(ae, bs)
  if (gap > BRIDGE_MAX_M) return -1
  if (gap <= GUARDED_GAP_M) return gap
  const chord = bearing(ae, bs)
  const aTail = a.segs[a.segs.length - 1].pts
  const bHead = b.segs[0].pts
  const aTan = bearing(pointBeforeEnd(aTail, TANGENT_M), ae)
  const bTan = bearing(bs, pointAfterStart(bHead, TANGENT_M))
  if (angleDiff(chord, aTan) > BEARING_TOLERANCE_DEG) return -1
  if (angleDiff(chord, bTan) > BEARING_TOLERANCE_DEG) return -1
  return gap
}

/**
 * Phase 2: bridge chains across gaps, always taking the closest admissible
 * pair first so a run never skips its true neighbor for a farther one.
 * Chain counts per corridor are small after phase 1, so the cubic loop is fine.
 */
export function bridgeChains(chains: Chain[]): Chain[] {
  const list = chains.slice()
  for (;;) {
    let best: { i: number; j: number; merged: Chain; gap: number } | null = null
    for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue
        const a = list[i]
        const b = list[j]
        const candidates: Array<[number, () => Chain]> = [
          [bridgeGap(a, b), () => ({ segs: [...a.segs, ...b.segs] })],
          [bridgeGap(a, reversed(b)), () => ({ segs: [...a.segs, ...reversed(b).segs] })],
          [bridgeGap(reversed(a), b), () => ({ segs: [...reversed(a).segs, ...b.segs] })],
        ]
        for (const [gap, build] of candidates) {
          if (gap >= 0 && (!best || gap < best.gap)) best = { i, j, merged: build(), gap }
        }
      }
    }
    if (!best) break
    const { i, j, merged } = best
    list[i] = merged
    list.splice(j, 1)
  }
  return list
}

/**
 * One chain → contiguous LineStrings, split only at band changes. A bridge
 * chord is drawn in the lower of the two bands it joins.
 */
export function chainToFeatures(chain: Chain, baseProps: Props): GeoJSON.Feature[] {
  const feats: GeoJSON.Feature[] = []
  const emit = (pts: Pt[], band: number) => {
    if (pts.length < 2) return
    feats.push({
      type: 'Feature',
      properties: { ...baseProps, band },
      geometry: { type: 'LineString', coordinates: pts },
    })
  }
  let cur: Pt[] = []
  let curBand = 0
  chain.segs.forEach((s, i) => {
    if (i === 0) {
      cur = s.pts.slice()
      curBand = s.band
      return
    }
    const prevEnd = cur[cur.length - 1]
    let pts = s.pts
    const gap = metersBetween(prevEnd, pts[0])
    if (gap <= TOUCH_M) pts = pts.slice(1)
    if (s.band === curBand) {
      cur.push(...pts)
      return
    }
    if (gap > TOUCH_M && curBand < s.band) {
      // the bridge belongs to the lighter band
      cur.push(pts[0])
      pts = pts.slice(1)
    }
    emit(cur, curBand)
    cur = [cur[cur.length - 1], ...pts]
    curBand = s.band
  })
  emit(cur, curBand)
  return feats
}

export interface SplitResult {
  /** Banded lines drawn on top at full weight. */
  streets: GeoJSON.FeatureCollection
  /** Unnamed remainder, drawn faint underneath. */
  grid: GeoJSON.FeatureCollection
  /** True when the layer had no named corridors (raw cells drawn as chains). */
  raw: boolean
}

export function splitLayer(fc: GeoJSON.FeatureCollection): SplitResult {
  const byCorridor = new Map<string, { props: Props; runs: Run[] }>()
  const unnamed: GeoJSON.Feature[] = []
  for (const f of fc.features) {
    if (f.geometry.type !== 'LineString') continue
    const c = f.geometry.coordinates as Pt[]
    if (c.length < 2) continue
    const props = (f.properties ?? {}) as Props
    const band = typeof props.band === 'number' ? props.band : 1
    if (props.name && props.corridor) {
      const g = byCorridor.get(props.corridor) ?? { props, runs: [] }
      g.runs.push({ pts: c, band })
      byCorridor.set(props.corridor, g)
    } else {
      unnamed.push(f)
    }
  }

  const streets: GeoJSON.Feature[] = []

  if (byCorridor.size === 0) {
    // Raw layer: nothing has been named yet. Chain cells by shared endpoints
    // per band and draw the chains at full weight; lone cells are jitter.
    const byBand = new Map<number, Run[]>()
    for (const f of unnamed) {
      const band = typeof f.properties?.band === 'number' ? (f.properties.band as number) : 1
      const list = byBand.get(band) ?? []
      list.push({ pts: (f.geometry as GeoJSON.LineString).coordinates as Pt[], band })
      byBand.set(band, list)
    }
    for (const [band, runs] of byBand) {
      for (const chain of chainTouching(runs)) {
        if (chain.segs.length < 2) continue
        streets.push(...chainToFeatures(chain, { band }))
      }
    }
    return {
      streets: { type: 'FeatureCollection', features: streets },
      grid: { type: 'FeatureCollection', features: [] },
      raw: true,
    }
  }

  for (const g of byCorridor.values()) {
    const { name, corridor } = g.props
    for (const chain of bridgeChains(chainTouching(g.runs))) {
      if (chainLength(chain) < MIN_CHAIN_M) continue
      streets.push(...chainToFeatures(chain, { name, corridor }))
    }
  }

  const grid: GeoJSON.Feature[] = []
  for (const f of unnamed) {
    const c = (f.geometry as GeoJSON.LineString).coordinates as Pt[]
    if (c.length === 2 && metersBetween(c[0], c[1]) < STUB_MAX_M) continue
    grid.push(f)
  }

  return {
    streets: { type: 'FeatureCollection', features: streets },
    grid: { type: 'FeatureCollection', features: grid },
    raw: false,
  }
}
