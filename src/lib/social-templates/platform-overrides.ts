/**
 * Per-platform variations applied to all templates.
 *
 * The HTML templates use `data-platform="..."` on the root element +
 * `data-show="..."` on individual elements; CSS rules in each template
 * scope what's visible. This module is the source of truth for the
 * config the API layer enforces (text length limits, default ratios).
 *
 * Per addendum spec §6.
 */

export type Platform = 'instagram' | 'facebook' | 'linkedin' | 'bluesky';

export const PLATFORMS = {
  instagram: { logo: 'shift', showGSI: false, showCTA: false, defaultRatio: '1:1' },
  facebook:  { logo: 'shift+gsi', showGSI: true,  showCTA: true,  defaultRatio: '1.91:1' },
  linkedin:  { logo: 'gsi-lead', showGSI: true,  showCTA: true,  defaultRatio: '1.91:1' },
  bluesky:   { logo: 'shift', showGSI: false, showCTA: false, defaultRatio: '1:1' },
} as const;

export function isValidPlatform(s: string): s is Platform {
  return s in PLATFORMS;
}

/**
 * Per-platform text length floors that the API layer enforces BEFORE
 * spinning up Playwright. The AI drafter is also told these limits via
 * the system prompt, but the schema is the actual gate. Per addendum §6.4.
 */
export const TEXT_LIMITS: Record<Platform, {
  nudge_headline: number;
  nudge_body: number;
  body_text: number;
}> = {
  instagram: { nudge_headline: 50, nudge_body: 120, body_text: 100 },
  facebook:  { nudge_headline: 60, nudge_body: 180, body_text: 150 },
  linkedin:  { nudge_headline: 70, nudge_body: 220, body_text: 200 },
  bluesky:   { nudge_headline: 50, nudge_body: 120, body_text: 100 },
};
