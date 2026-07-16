/**
 * Per-template HTML rendering helpers for array-shaped variables.
 *
 * The base renderer handles string substitution. For the enriched
 * IG templates (quote-stat-ig, weather-ig, mbta-ig), some variables
 * arrive as arrays of objects (3 secondary stats, 3 forecast days,
 * 2-3 alternative-mode cards). This module turns each array into a
 * single HTML string that the renderer substitutes at the matching
 * `{{key}}` placeholder.
 *
 * Each helper:
 *   - Calls `phosphorIcon(item.icon)` for inline SVGs (so icons render
 *     with the brand-token color via CSS `currentColor`).
 *   - Uses inline styles to avoid coupling to CSS class hierarchies in
 *     the host template — these helpers are template-aware but
 *     intentionally self-contained.
 *   - HTML-escapes user-supplied text via the `escapeHtml` helper.
 */

import { phosphorIcon, isAllowedIcon } from './icons';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── quote-stat-ig: secondary stats row ──────────────────────────────────

export interface SecondaryStat {
  value: string;
  label: string;
  icon: string;        // Phosphor icon name
  iconColor?: string;  // hex; defaults to brand green
}

export function renderSecondaryStats(items: SecondaryStat[]): string {
  return items
    .map((s) => {
      const color = s.iconColor || '#BAF14D';
      const icon = isAllowedIcon(s.icon)
        ? phosphorIcon(s.icon, { width: '1em', height: '1em' })
        : '';
      return `
        <div class="stat-card" style="color: ${color}">
          <div class="stat-icon">${icon}</div>
          <div class="stat-value">${escapeHtml(s.value)}</div>
          <div class="stat-label">${escapeHtml(s.label)}</div>
        </div>
      `;
    })
    .join('');
}

// ── weather-ig: 3-day forecast cards ────────────────────────────────────

export interface ForecastDay {
  day: string;         // "TUE"
  icon: string;        // Phosphor icon name
  high: string;        // "72°"
  low: string;         // "55°"
  iconColor?: string;
}

export function renderForecastDays(items: ForecastDay[]): string {
  return items
    .map((d) => {
      const color = d.iconColor || '#E8E8EE';
      const icon = isAllowedIcon(d.icon)
        ? phosphorIcon(d.icon, { width: '1em', height: '1em' })
        : '';
      return `
        <div class="forecast-card">
          <div class="forecast-day">${escapeHtml(d.day)}</div>
          <div class="forecast-icon" style="color: ${color}">${icon}</div>
          <div class="forecast-high">${escapeHtml(d.high)}</div>
          <div class="forecast-low">${escapeHtml(d.low)}</div>
        </div>
      `;
    })
    .join('');
}

// ── mbta-ig: alternative mode cards ─────────────────────────────────────

export interface MbtaAlternative {
  icon: string;        // Phosphor icon name
  mode: string;        // "Bike" / "Walk + Bus" / "Bluebikes"
  detail: string;      // "Community Path runs parallel"
  time: string;        // "~18 min Harvard → Alewife"
  highlight?: boolean; // first card visually highlighted (recommended)
  iconColor?: string;
}

export function renderAlternatives(items: MbtaAlternative[]): string {
  return items
    .map((a) => {
      // Highlighted card uses subtle green-tinted bg + green border,
      // matching the JSX prototype's `${B.green}08` / `${B.green}20`.
      const highlightClass = a.highlight ? ' alt-card--highlight' : '';
      const color =
        a.iconColor || (a.highlight ? '#BAF14D' : 'rgba(255,255,255,0.7)');
      const icon = isAllowedIcon(a.icon)
        ? phosphorIcon(a.icon, { width: '1em', height: '1em' })
        : '';
      return `
        <div class="alt-card${highlightClass}">
          <div class="alt-icon" style="color: ${color}">${icon}</div>
          <div class="alt-content">
            <div class="alt-header">
              <span class="alt-mode">${escapeHtml(a.mode)}</span>
              <span class="alt-time">${escapeHtml(a.time)}</span>
            </div>
            <div class="alt-detail">${escapeHtml(a.detail)}</div>
          </div>
        </div>
      `;
    })
    .join('');
}

// ── Social card templates v2: prize_featured, prize_pool, roam_collection ──

export interface FeaturedPrize {
  name: string;
  donor: string;
  img: string;
  qty?: string;   // e.g. "×8"
}

export function renderFeaturedPrizes(items: FeaturedPrize[]): string {
  return items
    .map((p) => `
      <div class="sx-tile" style="position:relative;padding:16px;justify-content:flex-start;min-height:0;overflow:hidden">
        ${p.qty ? `<span class="sx-qty" style="position:absolute;top:24px;right:24px;z-index:2">${escapeHtml(p.qty)}</span>` : ''}
        <div style="flex:1 1 auto;background:#fff;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:16px;min-height:0">
          <img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" style="max-width:100%;max-height:100%;object-fit:contain" />
        </div>
        <div style="padding:16px 8px 4px">
          <div class="sx-title" style="font-size:30px;line-height:1.1">${escapeHtml(p.name)}</div>
          <div class="sx-meta" style="margin-top:8px">${escapeHtml(p.donor)}</div>
        </div>
      </div>
    `)
    .join('');
}

export interface PoolPrize {
  name: string;
  donor: string;
  qty?: string;
}

export function renderPoolPrizes(items: PoolPrize[]): string {
  return items
    .map((p) => `
      <div class="sx-tile" style="padding:18px 20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <span class="sx-title" style="font-size:25px;line-height:1.1">${escapeHtml(p.name)}</span>
          ${p.qty ? `<span class="sx-qty" style="font-size:17px;padding:2px 10px">${escapeHtml(p.qty)}</span>` : ''}
        </div>
        <div class="sx-meta" style="font-size:17px;margin-top:8px">${escapeHtml(p.donor)}</div>
      </div>
    `)
    .join('');
}

export interface CollectionRoam {
  name: string;
  img: string;
}

export function renderCollectionRoams(items: CollectionRoam[], total: number): string {
  const shown = items.slice(0, 5);
  const remaining = total - shown.length;

  const tiles = shown
    .map((r) => `
      <div style="position:relative;border-radius:16px;overflow:hidden;min-height:0">
        <img src="${escapeHtml(r.img)}" alt="${escapeHtml(r.name)}"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(21,22,42,0) 38%,rgba(21,22,42,0.92) 100%)"></div>
        <div style="position:absolute;left:18px;right:18px;bottom:16px;font-family:var(--display);font-weight:700;font-size:26px;line-height:1.04;letter-spacing:-0.02em;color:var(--soft-white)">${escapeHtml(r.name)}</div>
      </div>
    `)
    .join('');

  const moreTile = `
    <div style="position:relative;border-radius:16px;overflow:hidden;min-height:0;background:var(--navy-2);border:2px dashed rgba(186,241,77,0.4);display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div style="font-family:var(--display);font-weight:800;font-size:64px;line-height:0.9;letter-spacing:-0.04em;color:var(--lime)">+${remaining}</div>
      <div class="sx-meta" style="margin-top:8px">more roams</div>
    </div>
  `;

  return tiles + moreTile;
}

// ── Community events: shared types + icon SVGs ─────────────────────────

const CE_ICONS: Record<string, string> = {
  bike: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  footprints: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>',
  bus: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  party: '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
};

function ceIcon(name: string, size: number, strokeWidth: number, color: string): string {
  const paths = CE_ICONS[name] || CE_ICONS['calendar'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:0 0 auto">${paths}</svg>`;
}

const CE_TYPE_META: Record<string, { icon: string; color: string }> = {
  group_ride:     { icon: 'bike',       color: '#BAF14D' },
  guided_ride:    { icon: 'bike',       color: '#BAF14D' },
  other_cycling:  { icon: 'bike',       color: '#BAF14D' },
  bike_repair:    { icon: 'wrench',     color: '#BAF14D' },
  bike_rodeo:     { icon: 'bike',       color: '#BAF14D' },
  bike_bus:       { icon: 'bike',       color: '#BAF14D' },
  class:          { icon: 'calendar',   color: '#BAF14D' },
  ebike_demo:     { icon: 'zap',        color: '#9BE06B' },
  cargo_bike_demo:{ icon: 'package',    color: '#4A82F0' },
  walking_tour:   { icon: 'footprints', color: '#5BD6C0' },
  transit_buddy:  { icon: 'bus',        color: '#4A82F0' },
  civic_action:   { icon: 'megaphone',  color: '#F5C04A' },
  open_streets:   { icon: 'megaphone',  color: '#F5C04A' },
  festival:       { icon: 'party',      color: '#FF8A65' },
};

function ceTypeMeta(eventType: string): { icon: string; color: string } {
  return CE_TYPE_META[eventType] || { icon: 'calendar', color: '#fff' };
}

function ceTint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface CeEvent {
  title: string;
  weekday: string;
  day_num: string;
  time: string;
  city: string;
  type_label: string;
  event_type: string;
  // How many additional events of this type fall in the range but aren't
  // shown on the card ("+N more"). Omitted or 0 = no suffix.
  more_count?: number | string;
}

// Rendered as a second line under the type label (the subtitle column is
// too narrow — a suffix there wraps mid-phrase). Parent span is uppercase
// with letter-spacing, so both are reset here.
function ceMoreBadge(ev: CeEvent, fontSize: number): string {
  const more = Number(ev.more_count ?? 0);
  if (!Number.isFinite(more) || more < 1) return '';
  return `<br><span style="font-size:${fontSize}px;font-weight:600;letter-spacing:0;text-transform:none;color:#BAF14D">+${more}&nbsp;more</span>`;
}

// ── ce_week / ce_carousel_week: event rows (IG square / portrait) ──────

export function renderCeWeekEvents(events: CeEvent[]): string {
  return events.slice(0, 4).map((ev) => {
    const meta = ceTypeMeta(ev.event_type);
    return `
      <div style="display:flex;align-items:center;gap:28px;padding:12px 0;border-top:2px solid rgba(255,255,255,0.1)">
        <div style="flex:0 0 128px;text-align:center">
          <div style="font-family:'Source Sans 3',system-ui,sans-serif;font-size:22px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#BAF14D">${escapeHtml(ev.weekday)}</div>
          <div style="font-family:'Bricolage Grotesque',serif;font-size:58px;font-weight:800;line-height:1;color:#fff">${escapeHtml(ev.day_num)}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Bricolage Grotesque',serif;font-weight:700;font-size:34px;line-height:1.12;letter-spacing:-0.02em;color:#fff;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2">${escapeHtml(ev.title)}</div>
          <div style="font-size:24px;color:rgba(255,255,255,0.6);margin-top:6px">${escapeHtml(ev.time)} · ${escapeHtml(ev.city)}</div>
        </div>
        <div style="flex:0 0 auto;display:flex;align-items:center;gap:18px">
          <span style="width:140px;font-size:20px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${meta.color};text-align:right;line-height:1.08">${escapeHtml(ev.type_label)}${ceMoreBadge(ev, 18)}</span>
          <div style="flex:0 0 96px;width:96px;height:96px;border-radius:22px;display:flex;align-items:center;justify-content:center;background:${ceTint(meta.color, 0.16)}">
            ${ceIcon(meta.icon, 44, 2, meta.color)}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── ce_week_fb: event rows (FB landscape, smaller) ─────────────────────

export function renderCeWeekFbEvents(events: CeEvent[]): string {
  return events.slice(0, 4).map((ev) => {
    const meta = ceTypeMeta(ev.event_type);
    return `
      <div style="display:flex;align-items:center;gap:20px;padding:16px 0;border-bottom:2px solid rgba(255,255,255,0.09)">
        <div style="flex:0 0 96px;text-align:center">
          <div style="font-family:'Source Sans 3',system-ui,sans-serif;font-size:18px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#BAF14D">${escapeHtml(ev.weekday)}</div>
          <div style="font-family:'Bricolage Grotesque',serif;font-size:44px;font-weight:800;line-height:1;color:#fff">${escapeHtml(ev.day_num)}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Bricolage Grotesque',serif;font-weight:700;font-size:28px;line-height:1.1;letter-spacing:-0.02em;color:#fff;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2">${escapeHtml(ev.title)}</div>
          <div style="font-size:21px;color:rgba(255,255,255,0.6);margin-top:4px">${escapeHtml(ev.time)} · ${escapeHtml(ev.city)}</div>
        </div>
        <div style="flex:0 0 auto;display:flex;align-items:center;gap:14px">
          <span style="width:96px;font-size:15px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${meta.color};text-align:right;line-height:1.08">${escapeHtml(ev.type_label)}${ceMoreBadge(ev, 14)}</span>
          <div style="flex:0 0 72px;width:72px;height:72px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:${ceTint(meta.color, 0.16)}">
            ${ceIcon(meta.icon, 34, 2, meta.color)}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── ce_carousel_week: event rows (portrait, medium size) ───────────────

export function renderCeCarouselEvents(events: CeEvent[]): string {
  return events.map((ev) => {
    const meta = ceTypeMeta(ev.event_type);
    return `
      <div style="display:flex;align-items:center;gap:24px;padding:24px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <div style="flex:0 0 104px;text-align:center">
          <div style="font-family:'Source Sans 3',system-ui,sans-serif;font-size:18px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#BAF14D">${escapeHtml(ev.weekday)}</div>
          <div style="font-family:'Bricolage Grotesque',serif;font-size:48px;font-weight:800;line-height:1;color:#fff">${escapeHtml(ev.day_num)}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Bricolage Grotesque',serif;font-weight:700;font-size:32px;line-height:1.12;letter-spacing:-0.02em;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(ev.title)}</div>
          <div style="font-size:23px;color:rgba(255,255,255,0.6);margin-top:5px">${escapeHtml(ev.time)} · ${escapeHtml(ev.city)}</div>
        </div>
        <div style="flex:0 0 auto;display:flex;align-items:center;gap:14px">
          <span style="width:108px;font-size:16px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${meta.color};text-align:right;line-height:1.08">${escapeHtml(ev.type_label)}</span>
          <div style="flex:0 0 72px;width:72px;height:72px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:${ceTint(meta.color, 0.16)}">
            ${ceIcon(meta.icon, 34, 2, meta.color)}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── ce_fb_carousel_week: event rows (FB square, compact) ─────────────

export function renderCeFbCarouselEvents(events: CeEvent[]): string {
  return events.map((ev) => {
    const meta = ceTypeMeta(ev.event_type);
    return `
      <div style="display:flex;align-items:center;gap:22px;padding:20px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <div style="flex:0 0 100px;text-align:center">
          <div style="font-family:'Source Sans 3',system-ui,sans-serif;font-size:17px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#BAF14D">${escapeHtml(ev.weekday)}</div>
          <div style="font-family:'Bricolage Grotesque',serif;font-size:44px;font-weight:800;line-height:1;color:#fff">${escapeHtml(ev.day_num)}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Bricolage Grotesque',serif;font-weight:700;font-size:30px;line-height:1.12;letter-spacing:-0.02em;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(ev.title)}</div>
          <div style="font-size:22px;color:rgba(255,255,255,0.6);margin-top:4px">${escapeHtml(ev.time)} · ${escapeHtml(ev.city)}</div>
        </div>
        <div style="flex:0 0 auto;display:flex;align-items:center;gap:14px">
          <span style="width:108px;font-size:16px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${meta.color};text-align:right;line-height:1.08">${escapeHtml(ev.type_label)}</span>
          <div style="flex:0 0 72px;width:72px;height:72px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:${ceTint(meta.color, 0.16)}">
            ${ceIcon(meta.icon, 34, 2, meta.color)}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── ce_spotlight: hero image section ───────────────────────────────────

export function renderCeSpotlightHero(imageUrl: string | null): string {
  if (imageUrl && imageUrl.trim()) {
    return `<img src="${escapeHtml(imageUrl)}" alt="" style="width:1080px;height:1180px;object-fit:cover;display:block" />`;
  }
  return `<div style="width:1080px;height:1180px;background:#1F2034;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-size:32px;font-weight:600">No flyer image</div>`;
}

// ── ce_spotlight: type icon tile ───────────────────────────────────────

export function renderCeTypeTile(eventType: string): string {
  const meta = ceTypeMeta(eventType);
  return `
    <div style="display:inline-flex;align-items:center;gap:16px;margin-bottom:22px">
      <span style="width:92px;height:92px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;background:${ceTint(meta.color, 0.18)}">
        ${ceIcon(meta.icon, 40, 2, meta.color)}
      </span>
      <span style="font-size:28px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${meta.color}">${escapeHtml(eventType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))}</span>
    </div>`;
}

// ── ce_month: calendar grid ────────────────────────────────────────────

export interface CeCalendarDay {
  day: string;
  in_month: boolean;
  has_event: boolean;
  dot_color: string;
}

export function renderCeCalendar(weeks: CeCalendarDay[][]): string {
  const headerRow = ['S','M','T','W','T','F','S'].map((d) =>
    `<div style="text-align:center;font-size:22px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.4)">${d}</div>`
  ).join('');

  const weekRows = weeks.map((wk) => {
    const cells = wk.map((c) => {
      const bg = c.in_month ? '#1F2034' : 'transparent';
      const border = c.has_event ? `2px solid ${ceTint(c.dot_color, 0.5)}` : '2px solid transparent';
      const textColor = c.in_month ? '#fff' : 'rgba(255,255,255,0.15)';
      const dot = c.has_event
        ? `<span style="width:14px;height:14px;border-radius:9999px;background:${c.dot_color}"></span>`
        : '';
      return `
        <div style="height:96px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:${bg};border:${border}">
          <span style="font-family:'Bricolage Grotesque',serif;font-weight:700;font-size:34px;color:${textColor}">${escapeHtml(c.day)}</span>
          ${dot}
        </div>`;
    }).join('');
    return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px">${cells}</div>`;
  }).join('');

  return `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px;margin-bottom:12px">${headerRow}</div>
    <div style="display:flex;flex-direction:column;gap:10px">${weekRows}</div>`;
}

// ── ce_month: type legend ──────────────────────────────────────────────

export interface CeLegendType {
  type_label: string;
  event_type: string;
  dates: string;
}

export function renderCeLegend(types: CeLegendType[], moreCount: number, monthAbbr: string): string {
  const rows = types.slice(0, 5).map((t) => {
    const meta = ceTypeMeta(t.event_type);
    return `
      <div style="display:flex;align-items:center;gap:16px;padding:12px 0;border-top:1px solid rgba(255,255,255,0.1)">
        <span style="flex:0 0 13px;width:13px;height:13px;border-radius:9999px;background:${meta.color}"></span>
        <span style="font-family:'Bricolage Grotesque',serif;font-weight:700;font-size:28px;letter-spacing:-0.02em;color:#fff;flex:0 0 240px;width:240px">${escapeHtml(t.type_label)}</span>
        <span style="font-family:'DM Mono',monospace;font-size:22px;color:rgba(255,255,255,0.65);white-space:nowrap">${escapeHtml(monthAbbr)} ${escapeHtml(t.dates)}</span>
      </div>`;
  }).join('');

  const more = moreCount > 0
    ? `<div style="padding:10px 0 0;border-top:1px solid rgba(255,255,255,0.1);font-size:22px;font-weight:600;color:rgba(255,255,255,0.4)">+ ${moreCount} more event types at the link</div>`
    : '';

  return rows + more;
}

// ── Top-level dispatcher ────────────────────────────────────────────────

/**
 * Pre-render array vars into HTML strings, returning a flat record
 * the base renderer can substitute via the normal {{key}} loop.
 *
 * The array key is mapped to a `_html` key (e.g. `secondary_stats` →
 * `secondary_stats_html`) so the template can reference the rendered
 * block at `{{secondary_stats_html}}`. The original array key is
 * stripped from the output so it doesn't get accidentally substituted
 * as `[object Object]`.
 *
 * `template` disambiguates generic array key names (e.g. `items` is
 * used by prize_featured, prize_pool, and roam_collection — each
 * needs a different renderer).
 */
export function expandArrayVars(
  vars: Record<string, unknown>,
  template = '',
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (Array.isArray(value)) {
      switch (key) {
        case 'secondary_stats':
          out[`${key}_html`] = renderSecondaryStats(value as SecondaryStat[]);
          continue;
        case 'forecast_days':
          out[`${key}_html`] = renderForecastDays(value as ForecastDay[]);
          continue;
        case 'alternatives':
          out[`${key}_html`] = renderAlternatives(value as MbtaAlternative[]);
          continue;
        case 'items':
          // Generic key — route by template id
          if (template === 'prize_featured') {
            out[`${key}_html`] = renderFeaturedPrizes(value as FeaturedPrize[]);
          } else if (template === 'prize_pool') {
            out[`${key}_html`] = renderPoolPrizes(value as PoolPrize[]);
          } else if (template === 'roam_collection') {
            // roam_collection needs `total` for the "+N more" tile;
            // pull it from the vars bag (it's a scalar sibling)
            const total = typeof vars['total'] === 'number' ? vars['total'] : value.length;
            out[`${key}_html`] = renderCollectionRoams(value as CollectionRoam[], total);
          }
          continue;
        case 'events':
          if (template === 'ce_week') {
            out[`${key}_html`] = renderCeWeekEvents(value as CeEvent[]);
          } else if (template === 'ce_week_fb') {
            out[`${key}_html`] = renderCeWeekFbEvents(value as CeEvent[]);
          } else if (template === 'ce_carousel_week') {
            out[`${key}_html`] = renderCeCarouselEvents(value as CeEvent[]);
          } else if (template === 'ce_fb_carousel_week') {
            out[`${key}_html`] = renderCeFbCarouselEvents(value as CeEvent[]);
          }
          continue;
        case 'calendar_weeks':
          out[`${key}_html`] = renderCeCalendar(value as CeCalendarDay[][]);
          continue;
        case 'legend_types': {
          const moreCount = typeof vars['legend_more_count'] === 'number' ? vars['legend_more_count'] as number : 0;
          const monthAbbr = typeof vars['month_abbr'] === 'string' ? vars['month_abbr'] as string : '';
          out[`${key}_html`] = renderCeLegend(value as CeLegendType[], moreCount, monthAbbr);
          continue;
        }
        default:
          // Unknown array key — drop it (don't pass through arrays as
          // strings, that produces "[object Object]" in the output).
          continue;
      }
    }
    out[key] = String(value);
  }
  return out;
}
