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

export function bluebikeHtml(bikesAvailable: number, name: string): string {
  return `
    <div title="${escapeAttr(name)} — ${bikesAvailable} bikes available" style="
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}
