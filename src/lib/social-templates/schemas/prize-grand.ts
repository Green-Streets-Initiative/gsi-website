import { z } from 'zod';
import { type Platform } from '../platform-overrides';

export function prizeGrandSchema(_platform: Platform) {
  return z.object({
    image: z.string().url(),                                      // product shot (transparent/clean bg)
    prize: z.string().min(1).max(80),                             // prize name
    sub: z.string().max(100).optional(),                          // subtitle, e.g. "+ a 3-piece accessory bundle"
    value: z.string().max(30).optional(),                         // e.g. "~$2,000 value"
    donor: z.string().max(40).optional(),                         // donor name (text fallback)
    donorLogo: z.string().url().nullable().optional(),             // donor logo on white chip
    mechanic: z.string().max(60).default('1 entry per active trip'),
    dates: z.string().max(40).default('June 15 – August 15'),
  });
}
