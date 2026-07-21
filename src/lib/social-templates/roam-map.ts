/**
 * roam-map — server-side static map renderer for the roam_map social card.
 *
 * The card renders in headless Chromium (Playwright). Rather than run a
 * live WebGL map there (unreliable under @sparticuz/chromium), we build a
 * plain static map: a mosaic of Carto raster basemap tiles (free, no API
 * key — the same "voyager" style the website map uses) as absolutely
 * positioned <img>s, with the route drawn as an SVG polyline and the
 * checkpoints as HTML markers on top. Because the tiles are ordinary
 * <img> elements, the render pipeline's existing image-load wait covers
 * them — no map-ready signal needed.
 */

const TILE = 256; // CSS px per tile (we request @2x images for crispness)

export interface RoamMapCheckpoint {
  label: string;
  lat: number;
  lng: number;
  required: boolean;
  sequence_order: number;
}

type LngLat = [number, number]; // GeoJSON order: [lng, lat]

function project(lat: number, lng: number, z: number): { x: number; y: number } {
  const scale = TILE * Math.pow(2, z);
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Downsample a dense polyline to at most `max` points, keeping endpoints. */
function downsample(points: LngLat[], max: number): LngLat[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: LngLat[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

/**
 * Build the map layer HTML (tiles + route + markers) sized to fit the
 * given map viewport in CSS px. `accent` colors the numbered pins.
 */
export function renderRoamMapLayer(opts: {
  checkpoints: RoamMapCheckpoint[];
  route: LngLat[] | null;
  width: number;
  height: number;
  accent: string;
}): string {
  const { checkpoints, route, width, height, accent } = opts;

  // 1. Frame to the actual trail — the route line plus the required
  //    (numbered) stops. Bonus stops are off-route detours; including
  //    them in the bounds zooms the map out and leaves dead margin, so
  //    they're excluded from framing (still drawn if they fall in view).
  const framePoints: LngLat[] = [
    ...(route ?? []),
    ...checkpoints.filter((c) => c.required).map((c) => [c.lng, c.lat] as LngLat),
  ];
  if (framePoints.length === 0) {
    // Fall back to all checkpoints if there's no route/required set.
    framePoints.push(...checkpoints.map((c) => [c.lng, c.lat] as LngLat));
  }
  if (framePoints.length === 0) {
    return `<div style="width:${width}px;height:${height}px;background:#20223A"></div>`;
  }

  let minLng = framePoints[0][0], maxLng = framePoints[0][0];
  let minLat = framePoints[0][1], maxLat = framePoints[0][1];
  for (const [lng, lat] of framePoints) {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  // 2. Pick the highest zoom at which the framed span fits with padding.
  const padFactor = 0.92; // tight framing → more map detail, less dead margin
  let zoom = 3;
  for (let z = 18; z >= 3; z--) {
    const a = project(maxLat, minLng, z);
    const b = project(minLat, maxLng, z);
    if (Math.abs(b.x - a.x) <= width * padFactor && Math.abs(b.y - a.y) <= height * padFactor) {
      zoom = z;
      break;
    }
  }

  // 3. Viewport origin (world px of the map's top-left corner).
  const center = project(centerLat, centerLng, zoom);
  const originX = center.x - width / 2;
  const originY = center.y - height / 2;

  // 4. Tile mosaic. @2x tiles for retina crispness, displayed at TILE px.
  const maxTile = Math.pow(2, zoom) - 1;
  const tiles: string[] = [];
  const firstTx = Math.floor(originX / TILE);
  const lastTx = Math.floor((originX + width) / TILE);
  const firstTy = Math.floor(originY / TILE);
  const lastTy = Math.floor((originY + height) / TILE);
  for (let tx = firstTx; tx <= lastTx; tx++) {
    for (let ty = firstTy; ty <= lastTy; ty++) {
      if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue;
      const left = tx * TILE - originX;
      const top = ty * TILE - originY;
      const url = `https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}@2x.png`;
      tiles.push(
        `<img src="${url}" width="${TILE}" height="${TILE}" style="position:absolute;left:${left}px;top:${top}px" crossorigin="anonymous" />`,
      );
    }
  }

  // 5. Route polyline (downsampled) as SVG over the tiles.
  let routeSvg = '';
  if (route && route.length >= 2) {
    const pts = downsample(route, 400)
      .map(([lng, lat]) => {
        const p = project(lat, lng, zoom);
        return `${(p.x - originX).toFixed(1)},${(p.y - originY).toFixed(1)}`;
      })
      .join(' ');
    routeSvg =
      `<svg width="${width}" height="${height}" style="position:absolute;left:0;top:0;pointer-events:none">` +
      `<polyline points="${pts}" fill="none" stroke="#2966E5" stroke-width="16" stroke-opacity="0.2" stroke-linejoin="round" stroke-linecap="round" />` +
      `<polyline points="${pts}" fill="none" stroke="#2966E5" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />` +
      `</svg>`;
  }

  // 6. Markers: required stops numbered in the accent color; bonus stops
  //    a small gold-ringed dot. Numbers follow required-stop order.
  // Nudge numbered pins that would land on top of an already-placed one
  // (adjacent real-world stops, e.g. a museum next to a memorial) so no
  // number disappears under another.
  const placed: { x: number; y: number }[] = [];
  function deCollide(x: number, y: number): { x: number; y: number } {
    let px = x, py = y;
    for (let guard = 0; guard < 12; guard++) {
      const hit = placed.find((q) => Math.hypot(q.x - px, q.y - py) < 46);
      if (!hit) break;
      px += 34; py += 20; // step down-right until clear
    }
    return { x: px, y: py };
  }
  const markers: string[] = [];
  let n = 0;
  for (const c of checkpoints) {
    const p = project(c.lat, c.lng, zoom);
    let left = p.x - originX;
    let top = p.y - originY;
    if (left < -40 || left > width + 40 || top < -40 || top > height + 40) continue;
    if (c.required) {
      const nudged = deCollide(left, top);
      left = nudged.x; top = nudged.y;
      placed.push({ x: left, y: top });
      n += 1;
      markers.push(
        `<div style="position:absolute;left:${left}px;top:${top}px;transform:translate(-50%,-50%);` +
          `width:48px;height:48px;border-radius:50%;background:${accent};border:4px solid #191A2E;` +
          `display:flex;align-items:center;justify-content:center;` +
          `font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:800;font-size:24px;color:#191A2E;` +
          `box-shadow:0 3px 10px rgba(0,0,0,0.45)">${n}</div>`,
      );
    } else {
      markers.push(
        `<div style="position:absolute;left:${left}px;top:${top}px;transform:translate(-50%,-50%);` +
          `width:26px;height:26px;border-radius:50%;background:#242538;border:5px solid #EDB93C;` +
          `box-shadow:0 2px 8px rgba(0,0,0,0.45)"></div>`,
      );
    }
  }

  return (
    `<div style="position:absolute;inset:0;width:${width}px;height:${height}px;overflow:hidden;background:#EDECE6">` +
    tiles.join('') +
    routeSvg +
    markers.join('') +
    `</div>`
  );
}

/**
 * Numbered stop-name list for the card's content panel (required stops
 * only, in order). Bonus stops are summarized as a count.
 */
export function renderRoamStopList(checkpoints: RoamMapCheckpoint[]): string {
  const required = checkpoints.filter((c) => c.required);
  const rows = required
    .map(
      (c, i) =>
        `<div style="display:flex;align-items:center;gap:18px;padding:10px 0">` +
        `<span style="flex:0 0 44px;width:44px;height:44px;border-radius:50%;background:rgba(186,241,77,0.16);` +
        `display:flex;align-items:center;justify-content:center;` +
        `font-family:'Bricolage Grotesque',serif;font-weight:800;font-size:22px;color:#BAF14D">${i + 1}</span>` +
        `<span style="font-family:'Bricolage Grotesque',serif;font-weight:600;font-size:32px;letter-spacing:-0.01em;` +
        `color:#E8E8EE;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.label)}</span>` +
        `</div>`,
    )
    .join('');
  return rows;
}
