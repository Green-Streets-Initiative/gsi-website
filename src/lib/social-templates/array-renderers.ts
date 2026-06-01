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
