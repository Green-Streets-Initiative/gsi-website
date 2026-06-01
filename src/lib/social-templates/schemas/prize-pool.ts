import { z } from 'zod';
import { type Platform } from '../platform-overrides';

const poolItemSchema = z.object({
  name: z.string().min(1).max(40),                                // keep short — tight tiles
  donor: z.string().min(1).max(30),
  qty: z.string().max(10).optional(),
});

export function prizePoolSchema(_platform: Platform) {
  return z.object({
    total: z.string().max(20).default('$5,000+'),                 // aggregate value hero stat
    items: z.array(poolItemSchema).min(1).max(25),
    mechanic: z.string().max(60).default('1 entry per active trip'),
    dates: z.string().max(40).default('June 15 – August 15'),
  });
}
