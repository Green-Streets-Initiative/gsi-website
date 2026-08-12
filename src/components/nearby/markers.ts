/**
 * Marker HTML factories for the /nearby snapshot maps. Rendered as MapLibre
 * DOM markers so the Bluebikes pins can carry live availability counts.
 * Color language: lime = you / protected paths, Bluebikes blue = docks,
 * MBTA yellow = bus stops, official line colors = rail stations.
 */

const BUS_SVG = '<svg width="13" height="13" viewBox="0 0 256 256" fill="#191A2E"><path d="M184,28H72A36,36,0,0,0,36,64V208a20,20,0,0,0,20,20H84a20,20,0,0,0,20-20V192h48v16a20,20,0,0,0,20,20h28a20,20,0,0,0,20-20V64A36,36,0,0,0,184,28ZM60,168V112H196v56ZM72,52H184a12,12,0,0,1,12,12V88H60V64A12,12,0,0,1,72,52Zm8,152H60V192H80Zm96,0V192h20v12Zm-68-64a16,16,0,1,1-16-16A16,16,0,0,1,108,140Zm72,0a16,16,0,1,1-16-16A16,16,0,0,1,180,140Z"/></svg>'

export function userDotHtml(): string {
  return `<div style="width:18px;height:18px;border-radius:50%;background:#BAF14D;border:3px solid #191A2E;box-shadow:0 0 0 2px #BAF14D,0 0 14px rgba(186,241,77,0.55)" title="Your location"></div>`
}

/** GBFS num_bikes_available INCLUDES e-bikes — split it for display. */
export function dockCounts(bikesAvailable: number, ebikes: number) {
  return { classic: Math.max(0, bikesAvailable - ebikes), ebikes }
}

/** "3 classic · 2 e-bikes" (or the zero-classic variant) — one wording everywhere. */
export function dockStatsText(bikesAvailable: number, ebikes: number): string {
  const { classic } = dockCounts(bikesAvailable, ebikes)
  if (classic === 0 && ebikes > 0) return `no classic bikes right now — ${ebikes} e-bike${ebikes === 1 ? '' : 's'}`
  return `${classic} classic · ${ebikes} e-bike${ebikes === 1 ? '' : 's'}`
}

export function bluebikeHtml(bikesAvailable: number, ebikes: number, name: string): string {
  return `
    <div title="${escapeAttr(name)} — Bluebikes dock, ${escapeAttr(dockStatsText(bikesAvailable, ebikes))}" style="
      display:flex;align-items:center;justify-content:center;
      min-width:28px;height:28px;padding:0 4px;border-radius:50%;
      background:#2B6CB0;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);
      color:#fff;font:700 12px/1 -apple-system,sans-serif;cursor:default;
    ">${bikesAvailable}</div>`
}

export function busStopHtml(title: string): string {
  return `
    <div title="${escapeAttr(title)}" style="
      display:flex;align-items:center;justify-content:center;
      width:22px;height:22px;border-radius:50%;
      background:#FFC72C;border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.35);cursor:default;
    ">${BUS_SVG}</div>`
}

export function trainStopHtml(color: string, title: string): string {
  return `
    <div title="${escapeAttr(title)}" style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:50%;
      background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);
      color:#fff;font:800 13px/1 -apple-system,sans-serif;cursor:default;
    ">T</div>`
}

export function protectedPathFlagHtml(name: string | null): string {
  return `
    <div title="${escapeAttr(name ?? 'Protected bike route')}" style="
      display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:99px;
      background:#191A2E;border:1.5px solid #BAF14D;box-shadow:0 2px 8px rgba(0,0,0,0.45);
      color:#BAF14D;font:700 11px/1 -apple-system,sans-serif;white-space:nowrap;cursor:default;
    "><span style="width:7px;height:7px;border-radius:50%;background:#BAF14D"></span>${escapeHtml(name ?? 'Protected route')}</div>`
}

/* ── Tap-detail popups ── */

export interface PopupRoute {
  label: string
  color: string
  textColor: string
  /** Where this route goes: its two end points, e.g. "Spring Hill ↔ Kendall/MIT" */
  termini: string
  nextMin: number | null
}

/** Stop/station detail: name, each route with where it goes, next arrivals. */
export function stopPopupHtml(opts: {
  name: string
  walkMins: number
  routes: PopupRoute[]
  directionsHref: string
}): string {
  const routeRows = opts.routes.map(r => `
    <div style="display:flex;align-items:baseline;gap:7px;margin-top:7px">
      <span style="flex-shrink:0;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700;background:${r.color};color:${r.textColor}">${escapeHtml(r.label)}</span>
      <span style="min-width:0;font-size:12px;line-height:1.45;color:rgba(255,255,255,0.85)">
        ${escapeHtml(r.termini)}${r.nextMin !== null ? ` · <strong style="color:#BAF14D">next ${r.nextMin === 0 ? 'now' : `in ${r.nextMin} min`}</strong>` : ''}
      </span>
    </div>`).join('')

  return `
    <div style="font-weight:700;font-size:14px;color:#fff">${escapeHtml(opts.name)}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px">${opts.walkMins} min walk from you</div>
    ${routeRows}
    <a href="${escapeAttr(opts.directionsHref)}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;margin-top:9px;font-size:12px;font-weight:700;color:#BAF14D;text-decoration:none">Walk there →</a>`
}

/** Multi-route stop: chip picker — tapping a chip selects that corridor.
 *  Chips carry data-corridor-id; NearbyMap wires a delegated click listener. */
export function stopRoutePickerHtml(opts: {
  name: string
  walkMins: number
  choices: { corridorId: string; label: string; color: string; textColor: string; termini: string }[]
}): string {
  const chips = opts.choices.map(c => `
    <button type="button" data-corridor-id="${escapeAttr(c.corridorId)}" style="
      display:flex;align-items:center;gap:8px;width:100%;margin-top:7px;padding:7px 9px;
      background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:9px;
      cursor:pointer;text-align:left">
      <span style="flex-shrink:0;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;background:${c.color};color:${c.textColor};pointer-events:none">${escapeHtml(c.label)}</span>
      <span style="min-width:0;font-size:11.5px;line-height:1.4;color:rgba(255,255,255,0.85);pointer-events:none">${escapeHtml(c.termini)}</span>
    </button>`).join('')

  return `
    <div style="font-weight:700;font-size:14px;color:#fff">${escapeHtml(opts.name)}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px">${opts.walkMins} min walk from you · tap a route to see where it goes</div>
    ${chips}`
}

/** Bluebikes dock detail. */
export function dockPopupHtml(opts: {
  name: string
  bikes: number
  ebikes: number
  docksFree: number
  walkMins: number
  directionsHref: string
}): string {
  const { classic } = dockCounts(opts.bikes, opts.ebikes)
  const stats = classic === 0 && opts.ebikes > 0
    ? `no classic bikes right now — <strong style="color:#BAF14D">${opts.ebikes} e-bike${opts.ebikes === 1 ? '' : 's'}</strong>`
    : `<strong style="color:#BAF14D">${classic} classic</strong> · ${opts.ebikes} e-bike${opts.ebikes === 1 ? '' : 's'}`
  return `
    <div style="font-size:10px;font-weight:800;letter-spacing:0.1em;color:#7FB5FF">BLUEBIKES DOCK</div>
    <div style="font-weight:700;font-size:14px;color:#fff;margin-top:2px">${escapeHtml(opts.name)}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px">${opts.walkMins} min walk from you</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:6px">
      ${stats} · ${opts.docksFree} open docks
    </div>
    <a href="${escapeAttr(opts.directionsHref)}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;margin-top:9px;font-size:12px;font-weight:700;color:#BAF14D;text-decoration:none">Walk there →</a>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}
