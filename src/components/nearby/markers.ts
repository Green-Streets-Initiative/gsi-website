import { SHUTTLE_COLOR } from '@/lib/nearby/shuttle-agencies'

/**
 * Marker HTML factories for the /nearby snapshot maps. Rendered as MapLibre
 * DOM markers so the Bluebikes pins can carry live availability counts.
 * Color language: lime = you / protected paths, Bluebikes blue = docks,
 * MBTA yellow = bus stops, official line colors = rail stations.
 */

const BUS_SVG = '<svg width="13" height="13" viewBox="0 0 256 256" fill="#191A2E"><path d="M184,28H72A36,36,0,0,0,36,64V208a20,20,0,0,0,20,20H84a20,20,0,0,0,20-20V192h48v16a20,20,0,0,0,20,20h28a20,20,0,0,0,20-20V64A36,36,0,0,0,184,28ZM60,168V112H196v56ZM72,52H184a12,12,0,0,1,12,12V88H60V64A12,12,0,0,1,72,52Zm8,152H60V192H80Zm96,0V192h20v12Zm-68-64a16,16,0,1,1-16-16A16,16,0,0,1,108,140Zm72,0a16,16,0,1,1-16-16A16,16,0,0,1,180,140Z"/></svg>'

// Phosphor Train — white so it reads on any official line color
const TRAIN_SVG = '<svg width="15" height="15" viewBox="0 0 256 256" fill="#fff"><path d="M184,24H72A32,32,0,0,0,40,56V184a32,32,0,0,0,32,32h8L65.6,235.2a8,8,0,1,0,12.8,9.6L100,216h56l21.6,28.8a8,8,0,1,0,12.8-9.6L176,216h8a32,32,0,0,0,32-32V56A32,32,0,0,0,184,24ZM56,120V80h64v40Zm80-40h64v40H136ZM72,40H184a16,16,0,0,1,16,16v8H56V56A16,16,0,0,1,72,40ZM184,200H72a16,16,0,0,1-16-16V136H200v48A16,16,0,0,1,184,200ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm88,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z"/></svg>'

/**
 * The name pill that rides with a stop marker.
 *
 * Absolutely positioned ABOVE the icon, for two reasons. It used to sit below
 * in a flex column, which meant the pill covered whatever stop happened to be
 * south of this one — visible the moment three stops share a block. And
 * because the column's own centre was the marker's anchor, the icon never sat
 * exactly on its coordinate; taking the pill out of the layout puts it there.
 */
function labelPill(name: string, accent = false): string {
  return `<div style="
    position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:4px;
    max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    background:rgba(25,26,46,0.92);border:1px solid ${accent ? 'rgba(186,241,77,0.45)' : 'rgba(255,255,255,0.18)'};
    border-radius:99px;padding:2px 8px;pointer-events:none;
    color:#fff;font:700 10.5px/1.3 -apple-system,sans-serif;
  ">${escapeHtml(name)}</div>`
}

/** Wrapper that keeps the icon centred on the coordinate with the pill above. */
function pinWithLabel(icon: string, label: string): string {
  return `<div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer">${icon}${label}</div>`
}

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

/** `endpoint` marks a dock a bike route starts or ends at: the pin counts
 *  what matters there (bikes at the start, open docks at the end) and says
 *  so in a pill, so it reads at city zoom among the grayed-out rest. */
export function bluebikeHtml(bikesAvailable: number, ebikes: number, name: string, selected = false,
  endpoint?: { count: number; label: string }): string {
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  const stats = endpoint ? endpoint.label : dockStatsText(bikesAvailable, ebikes)
  const dot = `
    <div title="${escapeAttr(name)} — Bluebikes dock, ${escapeAttr(stats)}" style="
      display:flex;align-items:center;justify-content:center;
      min-width:${selected ? 32 : 28}px;height:${selected ? 32 : 28}px;padding:0 4px;border-radius:50%;
      background:#2B6CB0;border:${selected ? 3 : 2}px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,0.35)${glow};
      color:#fff;font:700 12px/1 -apple-system,sans-serif;cursor:pointer;
    ">${endpoint ? endpoint.count : bikesAvailable}</div>`
  return endpoint ? pinWithLabel(dot, labelPill(endpoint.label, selected)) : dot
}

/** `name` labels the pin while it's selected. Rail stations carry their names
 *  permanently — they're landmarks — but labeling every bus dot would bury the
 *  map, and leaving them all bare makes a stop tapped in the list impossible
 *  to find among identical yellow dots. Labeling the picked one does both. */
export function busStopHtml(title: string, selected = false, name?: string): string {
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  const dot = `
    <div title="${escapeAttr(title)}" style="
      display:flex;align-items:center;justify-content:center;
      width:${selected ? 26 : 22}px;height:${selected ? 26 : 22}px;border-radius:50%;
      background:#FFC72C;border:${selected ? 3 : 2}px solid ${ring};box-shadow:0 2px 5px rgba(0,0,0,0.35)${glow};cursor:pointer;
    ">${BUS_SVG}</div>`
  if (!selected || !name) return dot
  return pinWithLabel(dot, labelPill(name, true))
}

export function trainStopHtml(color: string, title: string, selected = false): string {
  // Station name rides along under the icon — stations are landmarks, and
  // people need to see at a glance which one is which. The train glyph
  // pairs with the bus marker's bus glyph so the two read as one language.
  // The circle keeps the line's brand color when selected; only the ring
  // goes lime, matching the dock/borrow selected treatment.
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  return pinWithLabel(
    `<div title="${escapeAttr(title)}" style="
        display:flex;align-items:center;justify-content:center;
        width:28px;height:28px;border-radius:50%;
        background:${color};border:${selected ? 3 : 2.5}px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,0.4)${glow};
      ">${TRAIN_SVG}</div>`,
    labelPill(title, selected),
  )
}

// Phosphor Boat (regular) — white so it reads on the MBTA ferry teal
const FERRY_SVG = '<svg width="15" height="15" viewBox="0 0 256 256" fill="#fff"><path d="M221.06,110.59,208,106.23V56a16,16,0,0,0-16-16H136V24a8,8,0,0,0-16,0V40H64A16,16,0,0,0,48,56v50.23l-13.06,4.36A16,16,0,0,0,24,125.77V152c0,61.54,97.89,86.72,102.06,87.76a8,8,0,0,0,3.88,0C134.11,238.72,232,213.54,232,152V125.77A16,16,0,0,0,221.06,110.59ZM64,56H192v44.9L130.53,80.41a8,8,0,0,0-5.06,0L64,100.9Zm152,96c0,24.91-23.68,43-43.55,53.83A228.13,228.13,0,0,1,128,223.72,226.85,226.85,0,0,1,83.81,206C47.6,186.35,40,165.79,40,152V125.77L120,99.1V168a8,8,0,0,0,16,0V99.1l80,26.67Z"/></svg>'

export function ferryStopHtml(title: string, selected = false): string {
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  return pinWithLabel(
    `<div title="${escapeAttr(title)}" style="
        display:flex;align-items:center;justify-content:center;
        width:28px;height:28px;border-radius:50%;
        background:#008EAA;border:${selected ? 3 : 2.5}px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,0.4)${glow};
      ">${FERRY_SVG}</div>`,
    labelPill(title, selected),
  )
}

// Phosphor Bicycle — dark so it reads on the gold borrow/rent pin
// Phosphor Bus (regular, white fill) — shuttle/TMA stops get a purple dot
const SHUTTLE_BUS_SVG = '<svg width="13" height="13" viewBox="0 0 256 256" fill="#fff"><path d="M184,28H72A36,36,0,0,0,36,64V208a20,20,0,0,0,20,20H84a20,20,0,0,0,20-20V192h48v16a20,20,0,0,0,20,20h28a20,20,0,0,0,20-20V64A36,36,0,0,0,184,28ZM60,168V112H196v56ZM72,52H184a12,12,0,0,1,12,12V88H60V64A12,12,0,0,1,72,52Zm8,152H60V192H80Zm96,0V192h20v12Zm-68-64a16,16,0,1,1-16-16A16,16,0,0,1,108,140Zm72,0a16,16,0,1,1-16-16A16,16,0,0,1,180,140Z"/></svg>'

export function shuttleStopHtml(title: string, agencyLabel: string, selected = false): string {
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  return pinWithLabel(
    `<div title="${escapeAttr(title)}" style="
        display:flex;align-items:center;justify-content:center;
        width:${selected ? 26 : 24}px;height:${selected ? 26 : 24}px;border-radius:50%;
        background:${SHUTTLE_COLOR};border:${selected ? 3 : 2}px solid ${ring};box-shadow:0 2px 5px rgba(0,0,0,0.35)${glow};
      ">${SHUTTLE_BUS_SVG}</div>`,
    // A shuttle's pill names its operator, not the stop — "EZRide" is the
    // thing a newcomer needs to recognize.
    labelPill(selected ? title : agencyLabel, selected),
  )
}

/** A shuttle on the move (live, Brandeis): a pill in the route's color with
 *  a lime ring, the page's "live" color, and the route's name, so two
 *  shuttles on one campus can be told apart at a glance. Same look as the
 *  app's Around You map. */
export function shuttleVehicleHtml(name: string, color: string): string {
  return vehicleHtml(name, color, '#fff', 'bus')
}

/** Any moving vehicle (2026-11-06): shuttles, MBTA trains and buses. Same
 *  pill, in the line's own colors (dark text on the MBTA's yellow bus). */
export function vehicleHtml(name: string, color: string, textColor: string, kind: 'bus' | 'train'): string {
  const hex = /^#[0-9a-f]{6}$/i
  const bg = hex.test(color) ? color : SHUTTLE_COLOR
  const fg = hex.test(textColor) ? textColor : '#fff'
  const icon = (kind === 'train' ? TRAIN_SVG : SHUTTLE_BUS_SVG)
    .replace(/width="\d+" height="\d+"/, 'width="12" height="12"')
    .replace(/fill="#[0-9a-fA-F]{3,6}"/, `fill="${fg}"`)
  // A dark pill ringed in the line's color, so a moving bus never reads as a
  // solid bus-stop dot (Keith 2026-11-06). Same look as the app's ShuttleVehiclePin.
  return `<div title="${escapeAttr(name)}" style="
      display:inline-flex;align-items:center;gap:4px;height:26px;max-width:140px;padding:0 9px 0 2px;
      border-radius:13px;background:#191A2E;border:2px solid ${bg};
      box-shadow:0 2px 6px rgba(0,0,0,0.45);color:#fff;font:700 11px/1 system-ui,sans-serif;
      white-space:nowrap;pointer-events:none;
    "><span style="display:inline-flex;align-items:center;justify-content:center;flex:none;width:18px;height:18px;border-radius:50%;background:${bg}">${icon}</span><span style="overflow:hidden;text-overflow:ellipsis">${escapeAttr(name)}</span></div>`
}

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

// Phosphor Wrench (regular) — dark so it reads on the teal repair pin
const WRENCH_SVG = '<svg width="14" height="14" viewBox="0 0 256 256" fill="#191A2E"><path d="M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69ZM160,152a56.14,56.14,0,0,1-27.07-7,8,8,0,0,0-9.92,1.77L67.11,211.51a16,16,0,0,1-22.62-22.62L109.18,133a8,8,0,0,0,1.77-9.93,56,56,0,0,1,58.36-82.31l-31.2,33.81a8,8,0,0,0-1.94,7.1L141.83,108a8,8,0,0,0,6.14,6.14l26.35,5.66a8,8,0,0,0,7.1-1.94l33.81-31.2A56.06,56.06,0,0,1,160,152Z"/></svg>'

/** Teal circle + wrench for community repair co-ops ("Fix your bike") —
 *  the app's MapPinCircle(Colors.teal, Wrench). The place name rides
 *  underneath like a station's: a co-op is a landmark you ride to, and
 *  "Somerville Bike Kitchen" is the thing worth reading at a glance. */
export function repairHtml(title: string, selected = false): string {
  const ring = selected ? '#BAF14D' : '#fff'
  const glow = selected ? ',0 0 12px rgba(186,241,77,0.6)' : ''
  return pinWithLabel(
    `<div title="${escapeAttr(title)}" style="
        display:flex;align-items:center;justify-content:center;
        width:${selected ? 28 : 24}px;height:${selected ? 28 : 24}px;border-radius:50%;
        background:#5FD4BD;border:${selected ? 3 : 2}px solid ${ring};box-shadow:0 2px 5px rgba(0,0,0,0.35)${glow};
      ">${WRENCH_SVG}</div>`,
    labelPill(title, selected),
  )
}

// Phosphor Gift (regular) — dark on the white perk pin, as in the app
const GIFT_SVG = '<svg width="13" height="13" viewBox="0 0 256 256" fill="#191A2E"><path d="M216,72H180.92c.39-.33.79-.65,1.17-1A29.53,29.53,0,0,0,192,49.57,32.62,32.62,0,0,0,158.44,16,29.53,29.53,0,0,0,137,25.91a54.94,54.94,0,0,0-9,14.48,54.94,54.94,0,0,0-9-14.48A29.53,29.53,0,0,0,97.56,16,32.62,32.62,0,0,0,64,49.57,29.53,29.53,0,0,0,73.91,71c.38.33.78.65,1.17,1H40A16,16,0,0,0,24,88v32a16,16,0,0,0,16,16v64a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V136a16,16,0,0,0,16-16V88A16,16,0,0,0,216,72ZM149,36.51a13.69,13.69,0,0,1,10-4.5h.49A16.62,16.62,0,0,1,176,49.08a13.69,13.69,0,0,1-4.5,10c-9.49,8.4-25.24,11.36-35,12.4C137.7,60.89,141,45.5,149,36.51Zm-64.09.36A16.63,16.63,0,0,1,96.59,32h.49a13.69,13.69,0,0,1,10,4.5c8.39,9.48,11.35,25.2,12.39,34.92-9.72-1-25.44-4-34.92-12.39a13.69,13.69,0,0,1-4.5-10A16.6,16.6,0,0,1,84.87,36.87ZM40,88h80v32H40Zm16,48h64v64H56Zm144,64H136V136h64Zm16-80H136V88h80v32Z"/></svg>'

/** White circle + gift for a Bicycle Benefits member (the app's perk pin).
 *  `label` names it on a planned route, where only the one or two on the way
 *  show; the nearby set stays bare so ten pills don't bury the map. */
export function perkPinHtml(title: string, label?: string): string {
  const dot = `<div title="${escapeAttr(title)}" style="
      display:flex;align-items:center;justify-content:center;
      width:24px;height:24px;border-radius:50%;
      background:#fff;border:2px solid #191A2E;box-shadow:0 2px 5px rgba(0,0,0,0.35);
    ">${GIFT_SVG}</div>`
  return label ? pinWithLabel(dot, labelPill(label)) : dot
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
