import { z } from 'zod';
import { type Platform } from '../platform-overrides';

export function dykEditorialSchema(_platform: Platform) {
  return z.object({
    eyebrow: z.string().max(40).default('Did you know?'),
    pre: z.string().min(1).max(200),                              // lead-in text before the highlighted stat
    statHl: z.string().min(1).max(20),                            // lime-highlighted inline stat
    post: z.string().min(1).max(300),                             // text after the highlighted stat
    reframe: z.string().max(200).nullable().optional(),                      // warm CTA in forest-tint block
    source: z.string().max(120).nullable().optional(),
    org: z.enum(['gsi', 'shift']).default('gsi'),
    photo: z.boolean().default(false),
    photoSrc: z.string().url().nullable().optional(),
  });
}
