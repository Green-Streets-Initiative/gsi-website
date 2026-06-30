import { z } from 'zod';
import { type Platform } from '../platform-overrides';

const calendarDaySchema = z.object({
  day: z.string().max(2),
  in_month: z.boolean(),
  has_event: z.boolean(),
  dot_color: z.string().max(20),
});

const legendTypeSchema = z.object({
  type_label: z.string().max(30),
  event_type: z.string().max(30),
  dates: z.string().max(60),
});

export function ceMonthSchema(_platform: Platform) {
  return z.object({
    month_name: z.string().max(20),
    month_abbr: z.string().max(3),
    event_count: z.string().max(10),
    calendar_weeks: z.array(z.array(calendarDaySchema).length(7)).min(4).max(6),
    legend_types: z.array(legendTypeSchema).min(0).max(5),
    legend_more_count: z.number().int().min(0).default(0),
  });
}
