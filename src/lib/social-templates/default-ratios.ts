/**
 * Per-template, per-platform default aspect ratios.
 *
 * Each template has a "natural" canvas shape that fits its content.
 * Without this lookup, the API would default to 1:1 across the board,
 * which leaves text-light templates (quote-stat, weather, mbta) with
 * a 50%+ vertical void at IG. With per-template defaults, IG gets the
 * 4:5 enriched variants for those three; everything else picks the
 * shape that fills naturally.
 *
 * Spec: docs/specs/dual-layout-spec.md §"Default ratio routing"
 *
 * Usage:
 *   - The render API route applies `getDefaultRatio(template, platform)`
 *     when the caller doesn't pass an explicit `ratio`.
 *   - If the caller DOES pass `ratio`, that overrides the default.
 */

import type { AspectRatio } from './aspect-ratios';
import type { Platform } from './platform-overrides';

export const DEFAULT_RATIOS: Record<string, Record<Platform, AspectRatio>> = {
  // Text-light templates — IG gets the 4:5 enriched variant; others
  // get the 1.91:1 compact horizontal-split variant.
  'quote-stat': { instagram: '4:5', facebook: '1.91:1', linkedin: '1.91:1', bluesky: '1.91:1' },
  'weather':    { instagram: '4:5', facebook: '1.91:1', linkedin: '1.91:1', bluesky: '1.91:1' },
  'mbta':       { instagram: '4:5', facebook: '1.91:1', linkedin: '1.91:1', bluesky: '1.91:1' },

  // Photo-driven; tall ratios show more of the photo
  'roam':       { instagram: '4:5', facebook: '1.91:1', linkedin: '1.91:1', bluesky: '4:5' },

  // Already-dense templates — square fills naturally on IG/Bluesky;
  // wide for FB/LI feed previews
  'leaderboard': { instagram: '1:1', facebook: '1.91:1', linkedin: '1.91:1', bluesky: '1:1' },
  'partner':     { instagram: '1:1', facebook: '1.91:1', linkedin: '1.91:1', bluesky: '1:1' },
  'prize':       { instagram: '1:1', facebook: '1.91:1', linkedin: '1.91:1', bluesky: '1:1' },
  'sponsor':     { instagram: '1:1', facebook: '1.91:1', linkedin: '1.91:1', bluesky: '1:1' },
};

export function getDefaultRatio(template: string, platform: Platform): AspectRatio {
  return DEFAULT_RATIOS[template]?.[platform] ?? '1:1';
}

/**
 * Templates that have separate enriched HTML files for Instagram.
 * The render pipeline looks up `<template>-ig.html` for these on IG;
 * others use `<template>.html` regardless of platform.
 *
 * Spec: docs/specs/dual-layout-spec.md §"The solution"
 */
export const ENRICHED_TEMPLATES = ['quote-stat', 'weather', 'mbta'] as const;
export const ENRICHED_PLATFORMS = ['instagram'] as const;

export function getTemplateFile(template: string, platform: Platform): string {
  const isEnriched =
    (ENRICHED_TEMPLATES as readonly string[]).includes(template) &&
    (ENRICHED_PLATFORMS as readonly string[]).includes(platform);
  return isEnriched ? `${template}-ig.html` : `${template}.html`;
}

/**
 * True if this (template, platform) combination uses the enriched
 * variant. Used by the route handler to pick the right Zod schema
 * variant (which requires the enriched fields when true).
 */
export function isEnrichedRender(template: string, platform: Platform): boolean {
  return (
    (ENRICHED_TEMPLATES as readonly string[]).includes(template) &&
    (ENRICHED_PLATFORMS as readonly string[]).includes(platform)
  );
}
