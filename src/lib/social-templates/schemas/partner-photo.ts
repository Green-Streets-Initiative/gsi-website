import { z } from 'zod';
import { type Platform } from '../platform-overrides';

export function partnerPhotoSchema(_platform: Platform) {
  return z.object({
    photo: z.string().url(),                                      // hero photo (partner atmosphere)
    logoSrc: z.string().url().nullable().optional(),               // partner logo; null → monogram
    partner: z.string().min(1).max(60),                           // partner name
    perk: z.string().min(1).max(80),                              // offer text (rendered large)
    neighborhood: z.string().max(60).optional(),                  // e.g. "Inman Square, Cambridge"
    unlock: z.string().max(30).default('Mover'),                  // tier name (never "points")
  });
}
