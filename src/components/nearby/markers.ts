/**
 * Marker HTML factories for the /nearby snapshot maps. Rendered as MapLibre
 * DOM markers so the Bluebikes pins can carry live availability counts.
 * Color language: lime = you / protected paths, Bluebikes blue = docks,
 * MBTA yellow = bus stops, official line colors = rail stations.
 */

const BUS_SVG = '<svg width="13" height="13" viewBox="0 0 256 256" fill="#191A2E"><path d="M184,28H72A36,36,0,0,0,36,64V208a20,20,0,0,0,20,20H84a20,20,0,0,0,20-20V192h48v16a20,20,0,0,0,20,20h28a20,20,0,0,0,20-20V64A36,36,0,0,0,184,28ZM60,168V112H196v56ZM72,52H184a12,12,0,0,1,12,12V88H60V64A12,12,0,0,1,72,52Zm8,152H60V192H80Zm96,0V192h20v12Zm-68-64a16,16,0,1,1-16-16A16,16,0,0,1,108,140Zm72,0a16,16,0,1,1-16-16A16,16,0,0,1,180,140Z"/></svg>'

// Phosphor Train — white so it reads on any official line color
const TRAIN_SVG = '<svg width="15" height="15" viewBox="0 0 256 256" fill="#fff"><path d="M184,24H72A32,32,0,0,0,40,56V184a32,32,0,0,0,32,32h8L65.6,235.2a8,8,0,1,0,12.8,9.6L100,216h56l21.6,28.8a8,8,0,1,0,12.8-9.6L176,216h8a32,32,0,0,0,32-32V56A32,32,0,0,0,184,24ZM56,120V80h64v40Zm80-40h64v40H136ZM72,40H184a16,16,0,0,1,16,16v8H56V56A16,16,0,0,1,72,40ZM184,200H72a16,16,0,0,1-16-16V136H200v48A16,16,0,0,1,184,200ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm88,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z"/></svg>'

export function userDotHtml(): string {
  return `<div style="width:18px;height:18px;border-radius:50%;background:#BAF14D;border:3px solid #191A2E;box-shadow:0 0 0 2px #BAF14D,0 0 14px rgba(186,241,77,0.55)" title="Your location"></div>`
}

/** GBFS num_bikes_available INCLUDES e-bikes — split it for display. */
export function dockCounts(bikesAvailable: number, ebikes: number) {
  return { classic: Math.max(0, bikesAvailable - ebikes), ebikes }
}

/** "3 classic · 2 e-bikes" (or the zero-classic variant) — one wording
 *  everywhere. Pass a `tr` (from useNearbyT) to localize; without it the
 *  English source is returned inline (the map-marker tooltips use this). */
type NearbyTr = (key: string, replacements?: Record<string, string | number | null | undefined>) => string

export function dockStatsText(bikesAvailable: number, ebikes: number, tr?: NearbyTr): string {
  const { classic } = dockCounts(bikesAvailable, ebikes)
  if (tr) {
    if (classic === 0 && ebikes > 0) {
      return tr(ebikes === 1 ? 'dock.no_classic_one' : 'dock.no_classic_other', { ebikes })
    }
    return tr(ebikes === 1 ? 'dock.stats_one' : 'dock.stats_other', { classic, ebikes })
  }
  if (classic === 0 && ebikes > 0) return `no classic bikes right now — ${ebikes} e-bike${ebikes === 1 ? '' : 's'}`
  return `${classic} classic · ${ebikes} e-bike${ebikes === 1 ? '' : 's'}`
}

export function bluebikeHtml(bikesAvailable: number, ebikes: number, name: string, selected = false): string {
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  return `
    <div title="${escapeAttr(name)} — Bluebikes dock, ${escapeAttr(dockStatsText(bikesAvailable, ebikes))}" style="
      display:flex;align-items:center;justify-content:center;
      min-width:${selected ? 32 : 28}px;height:${selected ? 32 : 28}px;padding:0 4px;border-radius:50%;
      background:#2B6CB0;border:${selected ? 3 : 2}px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,0.35)${glow};
      color:#fff;font:700 12px/1 -apple-system,sans-serif;cursor:pointer;
    ">${bikesAvailable}</div>`
}

export function busStopHtml(title: string, selected = false): string {
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  return `
    <div title="${escapeAttr(title)}" style="
      display:flex;align-items:center;justify-content:center;
      width:${selected ? 26 : 22}px;height:${selected ? 26 : 22}px;border-radius:50%;
      background:#FFC72C;border:${selected ? 3 : 2}px solid ${ring};box-shadow:0 2px 5px rgba(0,0,0,0.35)${glow};cursor:pointer;
    ">${BUS_SVG}</div>`
}

export function trainStopHtml(color: string, title: string, selected = false): string {
  // Station name rides along under the icon — stations are landmarks, and
  // people need to see at a glance which one is which. The train glyph
  // pairs with the bus marker's bus glyph so the two read as one language.
  // The circle keeps the line's brand color when selected; only the ring
  // goes lime, matching the dock/borrow selected treatment.
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer">
      <div title="${escapeAttr(title)}" style="
        display:flex;align-items:center;justify-content:center;
        width:28px;height:28px;border-radius:50%;
        background:${color};border:${selected ? 3 : 2.5}px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,0.4)${glow};
      ">${TRAIN_SVG}</div>
      <div style="
        max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        background:rgba(25,26,46,0.92);border:1px solid rgba(255,255,255,0.18);
        border-radius:99px;padding:2px 8px;
        color:#fff;font:700 10.5px/1.3 -apple-system,sans-serif;
      ">${escapeHtml(title)}</div>
    </div>`
}

// Phosphor Bicycle — dark so it reads on the gold borrow/rent pin
const BICYCLE_SVG = '<svg width="14" height="14" viewBox="0 0 256 256" fill="#191A2E"><path d="M208,112a47.81,47.81,0,0,0-16.93,3.09L165.93,72H192a8,8,0,0,1,8,8,8,8,0,0,0,16,0,24,24,0,0,0-24-24H152a8,8,0,0,0-6.91,12l11.65,20H99.26L82.91,60A8,8,0,0,0,76,56H48a8,8,0,0,0,0,16H71.41L85.12,95.51,69.41,119.1a48,48,0,1,0,13.32,8.89l11.81-17.72L125.6,164a8,8,0,0,0,13.84-8l-30.07-51.57h47.11l11.78,20.2A48,48,0,1,0,208,112ZM80,160a32,32,0,1,1-20.21-29.74l-16.45,24.67a8,8,0,0,0,13.32,8.88l16.44-24.66A31.87,31.87,0,0,1,80,160Zm128,32a32,32,0,0,1-15.62-59.91l11.71,20.08a8,8,0,1,0,13.82-8.06l-11.72-20.09A32,32,0,1,1,208,192Z"/></svg>'

/** Gold circle for CargoB hubs / Community Pedal Power pickups — bikes you
 *  can borrow or rent without owning one. A short label rides underneath so
 *  it's clear at a glance WHY there's a bike there. */
export function borrowRentHtml(title: string, label: string, selected = false): string {
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer">
      <div title="${escapeAttr(title)}" style="
        display:flex;align-items:center;justify-content:center;
        width:${selected ? 28 : 24}px;height:${selected ? 28 : 24}px;border-radius:50%;
        background:#EDB93C;border:${selected ? 3 : 2}px solid ${ring};box-shadow:0 2px 5px rgba(0,0,0,0.35)${glow};
      ">${BICYCLE_SVG}</div>
      <div style="
        max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        background:rgba(25,26,46,0.92);border:1px solid rgba(255,255,255,0.18);
        border-radius:99px;padding:2px 7px;
        color:#fff;font:700 9.5px/1.3 -apple-system,sans-serif;
      ">${escapeHtml(label)}</div>
    </div>`
}

const FLAG_SVG = '<svg width="13" height="13" viewBox="0 0 256 256" fill="#191A2E"><path d="M42.76,50A8,8,0,0,0,40,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,16.4,8.11,34.06,16.85,53,16.85,13.93,0,28.54-4.75,43.82-18a8,8,0,0,0,2.76-6V56A8,8,0,0,0,218.76,50c-28,24.23-51.72,12.49-79.21-1.12C111.07,34.76,78.78,18.79,42.76,50Z"/></svg>'

/** Destination flag for route maps — white so it can't be confused with the
 *  lime you-are-here dot, name label riding along underneath. */
export function destinationPinHtml(name: string): string {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:default">
      <div title="${escapeAttr(name)}" style="
        display:flex;align-items:center;justify-content:center;
        width:26px;height:26px;border-radius:50%;
        background:#fff;border:2.5px solid #191A2E;box-shadow:0 2px 6px rgba(0,0,0,0.4);
      ">${FLAG_SVG}</div>
      <div style="
        max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        background:rgba(25,26,46,0.92);border:1px solid rgba(255,255,255,0.18);
        border-radius:99px;padding:2px 8px;
        color:#fff;font:700 10.5px/1.3 -apple-system,sans-serif;
      ">${escapeHtml(name)}</div>
    </div>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}
