import { z } from 'zod';
import { type Platform } from '../platform-overrides';

export function roamPosterSchema(_platform: Platform) {
  return z.object({
    photo: z.string().url(),                                      // full-bleed trail photo
    name: z.string().min(1).max(60),                              // roam name
    region: z.string().max(60).nullable().optional(),                        // e.g. "Falmouth · Cape Cod"
    blurb: z.string().max(300).nullable().optional(),                        // roam description
    badge: z.string().url(),                                      // badge glyph SVG from badge-images bucket
    badgeTop: z.string().max(20).default('SHIFT ROAM'),           // top arc text on badge stamp
    badgeRegion: z.string().max(20).nullable().optional(),                   // bottom arc text (e.g. "CAPE COD")
  });
}
