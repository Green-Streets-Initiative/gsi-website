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
 * Unrecognized array keys are passed through untouched (the renderer
 * will then fall back to its default behavior — likely producing a
 * stringified object that the template won't render).
 */
export function expandArrayVars(
  vars: Record<string, unknown>,
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
