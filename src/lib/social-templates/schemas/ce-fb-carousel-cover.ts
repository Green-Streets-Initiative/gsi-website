import { z } from 'zod';
import { type Platform } from '../platform-overrides';

export function ceFbCarouselCoverSchema(_platform: Platform) {
  return z.object({
    month_name: z.string().max(20),
    year: z.string().max(4),
    event_count: z.string().max(10),
    total_slides: z.string().max(4),
  });
}
