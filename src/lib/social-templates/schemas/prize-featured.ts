import { z } from 'zod';
import { type Platform } from '../platform-overrides';

const featuredItemSchema = z.object({
  name: z.string().min(1).max(60),
  donor: z.string().min(1).max(40),
  img: z.string().url(),
  qty: z.string().max(10).optional(),                             // e.g. "×8"
});

export function prizeFeaturedSchema(_platform: Platform) {
  return z.object({
    headline: z.string().max(60).default('More ways to win'),
    items: z.array(featuredItemSchema).length(6),                  // exactly 6 items for the 2×3 grid
    mechanic: z.string().max(60).default('1 entry per active trip'),
    dates: z.string().max(40).default('June 15 – August 15'),
  });
}
