import 'server-only';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Phosphor icon resolver — converts a Phosphor icon name (e.g.
 * "bicycle", "sun", "map-pin") into an inline SVG string suitable
 * for direct injection into a rendered template.
 *
 * The drafter outputs icon NAMES (no emojis — see social-prompt.ts
 * hard prohibitions). The renderer recognizes any var key ending in
 * `_icon`, runs it through phosphorIcon(), and injects the SVG raw
 * (NOT HTML-escaped) into the template at the matching placeholder.
 *
 * Phosphor SVGs ship with `viewBox="0 0 256 256" fill="currentColor"`
 * so they inherit color from the parent's CSS `color` property.
 * This module sets `width="1em" height="1em"` so they scale with the
 * parent's font-size — sizing is controlled by setting font-size on
 * the wrapping element in each template.
 */

// Whitelist of icons we explicitly support. Drafter and template
// authors can only pick from this set; unknown names render as empty
// (graceful degradation rather than a crash). Extend as needed.
export const ALLOWED_ICONS = [
  // Active-transport modes
  'bicycle',
  'person-simple-walk',
  'train',
  'train-simple',
  'bus',                // dual-layout MBTA enriched alternatives

  // Weather conditions
  'sun',
  'sun-horizon',
  'cloud',
  'cloud-sun',
  'cloud-rain',
  'cloud-snow',
  'cloud-fog',          // dual-layout weather enriched forecast
  'cloud-lightning',    // dual-layout weather enriched forecast
  'lightning',
  'snowflake',
  'moon',
  'wind',
  'leaf',               // fall / September campaigns

  // Geography / location
  'map-pin',
  'map-pin-line',
  'map-trifold',        // dual-layout MBTA enriched (Bluebikes / station map alt)
  'navigation-arrow',

  // Prize / sponsor / recognition
  'confetti',
  'gift',
  'trophy',
  'star',
  'plant',
  'sparkle',
  'medal',

  // Stats / data (dual-layout quote-stat enriched)
  'currency-dollar',
  'trend-up',

  // Alerts / status
  'warning',
  'warning-circle',
  'info',

  // Misc utility
  'arrow-right',
] as const;

export type IconName = (typeof ALLOWED_ICONS)[number];

export function isAllowedIcon(name: string): name is IconName {
  return (ALLOWED_ICONS as readonly string[]).includes(name);
}

// Lazy-loaded cache so we don't pay file I/O for icons we don't render.
const iconCache = new Map<string, string>();

function loadRawSvg(name: string): string | null {
  if (iconCache.has(name)) return iconCache.get(name)!;

  const path = join(
    process.cwd(),
    'node_modules',
    '@phosphor-icons',
    'core',
    'assets',
    'regular',
    `${name}.svg`,
  );
  if (!existsSync(path)) return null;

  const raw = readFileSync(path, 'utf-8');
  iconCache.set(name, raw);
  return raw;
}

interface IconOpts {
  width?: string;
  height?: string;
  className?: string;
  /**
   * Vertical-align value used when the icon is inline with text.
   * Default `-0.125em` lifts the SVG slightly so it sits on the
   * text baseline cleanly. Set to `'baseline'` to disable.
   */
  verticalAlign?: string;
}

/**
 * Resolve a Phosphor icon name to an inline SVG string. Returns
 * empty string if the name is unknown — the template just renders
 * without the icon rather than crashing.
 *
 * Default sizing is `1em × 1em` so the icon scales with the parent's
 * `font-size`. To make a 48px icon, set `font-size: 48px` on the
 * containing element. To override, pass `width` / `height` directly.
 */
export function phosphorIcon(name: string, opts: IconOpts = {}): string {
  if (!isAllowedIcon(name)) return '';
  const raw = loadRawSvg(name);
  if (!raw) return '';

  const width = opts.width ?? '1em';
  const height = opts.height ?? '1em';
  const verticalAlign = opts.verticalAlign ?? '-0.125em';
  const cls = opts.className ? ` class="${opts.className}"` : '';
  const style = ` style="vertical-align:${verticalAlign}"`;

  // Replace Phosphor's opening <svg ...> with one that includes our
  // sizing + alignment attributes. Phosphor preserves the path
  // contents so this is just an opening-tag rewrite.
  return raw.replace(
    /<svg[^>]*>/,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="${width}" height="${height}"${cls}${style}>`,
  );
}
