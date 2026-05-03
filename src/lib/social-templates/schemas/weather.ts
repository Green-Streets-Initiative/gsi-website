import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';

export function weatherSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  return z.object({
    condition_icon:  z.string().min(1).max(4),          // emoji
    temperature:     z.string().min(1).max(8),          // "68°", "-12°"
    condition_label: z.string().min(1).max(40),         // "Clear & breezy"
    aqi_value:       z.string().min(1).max(5),          // "32"
    aqi_label: z.enum([
      'Good',
      'Moderate',
      'Unhealthy for Sensitive Groups',
      'Unhealthy',
      'Very Unhealthy',
      'Hazardous',
    ]),
    nudge_headline: z.string().min(1).max(limits.nudge_headline),
    nudge_body:     z.string().min(1).max(limits.nudge_body),
    cta_text:       z.string().max(40).optional(),      // only shown on FB/LI
  });
}
