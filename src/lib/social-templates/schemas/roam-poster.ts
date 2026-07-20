import { z } from 'zod';
import { type Platform } from '../platform-overrides';

export function roamPosterSchema(_platform: Platform) {
  return z.object({
    photo: z.string().url(),                                      // full-bleed trail photo
    name: z.string().min(1).max(60),                              // roam name
    region: z.string().max(60).nullable().optional(),                        // e.g. "Falmouth · Cape Cod"
    blurb: z.string().max(300).nullable().optional(),                        // roam description
    badge: z.string().url(),                                      // badge glyph SVG from badge-images bucket
    // Badge accent = the real per-roam color the Shift app uses for this
    // badge (roams.badge_accent, sourced from RoamBadge.tsx). Rings the
    // stamp so social matches the app. Defaults to lime for backward compat.
    badgeAccent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#BAF14D'),
    photoAttribution: z.string().max(120).nullable().optional(),             // photo credit line
    // Legacy arc-text fields — the stamp no longer renders them. Kept
    // optional so old drafts still validate.
    badgeTop: z.string().max(20).nullable().optional(),
    badgeRegion: z.string().max(20).nullable().optional(),
  });
}
