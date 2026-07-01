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
});

export function ceFbCarouselWeekSchema(_platform: Platform) {
  return z.object({
    week_label: z.string().max(20),
    week_range: z.string().max(30),
    count_label: z.string().max(20),
    slide_no: z.string().max(4),
    total_slides: z.string().max(4),
    events: z.array(ceEventSchema).min(1).max(10),
  });
}
