/**
 * Output pixel dimensions per supported aspect ratio.
 * Per addendum spec §5.
 */

export const ASPECT_RATIOS = {
  '1:1': { width: 1080, height: 1080 },     // IG feed default
  '4:5': { width: 1080, height: 1350 },     // IG tall (more engagement)
  '1.91:1': { width: 1200, height: 628 },   // LinkedIn, Facebook link preview
  '9:16': { width: 1080, height: 1920 },    // Stories (Phase 2)
} as const;

export type AspectRatio = keyof typeof ASPECT_RATIOS;

export function isValidAspectRatio(s: string): s is AspectRatio {
  return s in ASPECT_RATIOS;
}
