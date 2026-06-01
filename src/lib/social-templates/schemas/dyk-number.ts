import { z } from 'zod';
import { type Platform } from '../platform-overrides';

export function dykNumberSchema(_platform: Platform) {
  return z.object({
    eyebrow: z.string().max(40).default('Did you know?'),
    stat: z.string().min(1).max(12),                              // giant hero number, e.g. "62%"
    statement: z.string().min(1).max(200),                        // body below the stat
    clarifier: z.string().max(120).optional(),                    // optional supporting line
    source: z.string().max(120).optional(),                       // attribution, e.g. "Source · MassDOT"
    org: z.enum(['gsi', 'shift']).default('gsi'),                 // footer lockup
    photo: z.boolean().default(false),                            // toggle full-bleed bg photo
    photoSrc: z.string().url().optional(),                        // bg image when photo=true
  });
}
