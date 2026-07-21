import { z } from 'zod';
import { type Platform } from '../platform-overrides';

const checkpointSchema = z.object({
  label: z.string().min(1).max(80),
  lat: z.number(),
  lng: z.number(),
  required: z.boolean(),
  sequence_order: z.number(),
});

export function roamMapSchema(_platform: Platform) {
  return z.object({
    name: z.string().min(1).max(60),                                     // roam name
    region: z.string().max(60).nullable().optional(),                    // e.g. "Marblehead · Swampscott"
    eyebrow: z.string().max(24).default('Roam'),                         // "Featured roam" for featured roams
    reward_badge: z.string().max(60).nullable().optional(),              // "Earn the X badge"
    reward_sweeps: z.string().max(70).nullable().optional(),             // "Every trip enters the Y sweepstakes"
    badge: z.string().url(),                                             // badge glyph SVG
    badgeAccent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#BAF14D'),
    // Checkpoints + route are consumed server-side (render.ts) into the
    // map layer + stop list; the drafter never fills these — social-draft
    // precomputes them from the DB.
    checkpoints: z.array(checkpointSchema).min(1).max(30),
    route: z.array(z.tuple([z.number(), z.number()])).nullable().optional(), // GeoJSON [lng,lat]
  });
}
