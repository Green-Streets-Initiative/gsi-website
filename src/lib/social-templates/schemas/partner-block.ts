import { z } from 'zod';
import { type Platform } from '../platform-overrides';

export function partnerBlockSchema(_platform: Platform) {
  return z.object({
    logoSrc: z.string().url().nullable().optional(),
    partner: z.string().min(1).max(60),
    perk: z.string().min(1).max(80),
    category: z.string().max(40).nullable().optional(),                      // e.g. "Bike shop"
    neighborhood: z.string().max(60).nullable().optional(),
    locationIcon: z.enum(['map-pin', 'globe-simple']).default('map-pin').optional(),
    unlock: z.string().max(30).default('Mover'),
  });
}
