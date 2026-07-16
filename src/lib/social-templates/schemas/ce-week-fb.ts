import { z } from 'zod';
import { type Platform } from '../platform-overrides';

const ceEventSchema = z.object({
  title: z.string().min(1).max(120),
  weekday: z.string().max(3),
  day_num: z.string().max(2),
  time: z.string().max(20),
  city: z.string().max(60),
  type_label: z.string().max(30),
  event_type: z.string().max(30),
  more_count: z.coerce.number().int().min(0).optional(),
});

export function ceWeekFbSchema(_platform: Platform) {
  return z.object({
    week_range: z.string().max(30),
    events: z.array(ceEventSchema).min(1).max(4),
  });
}
