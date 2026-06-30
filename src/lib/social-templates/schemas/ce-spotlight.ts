import { z } from 'zod';
import { type Platform } from '../platform-overrides';

export function ceSpotlightSchema(_platform: Platform) {
  return z.object({
    title: z.string().min(1).max(80),
    date_long: z.string().max(40),
    time_range: z.string().max(40),
    venue_city: z.string().max(80),
    event_type: z.string().max(30),
    image_url: z.string().url().nullable().optional(),
  });
}
