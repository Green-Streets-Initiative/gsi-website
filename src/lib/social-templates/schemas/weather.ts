import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';
import { ALLOWED_ICONS } from '../icons';

/**
 * Weather schema. On Instagram (the enriched 4:5 variant), the
 * extra fields are required: `forecast_days` (3 cards), `wind_direction`,
 * `wind_speed`, and `wind_icon`. On other platforms (the compact
 * 1.91:1 horizontal-split variant) the base fields are sufficient.
 */

const forecastItem = z.object({
  day:  z.string().min(1).max(4),                  // "TUE"
  icon: z.enum(ALLOWED_ICONS),                     // Phosphor icon: sun / cloud-sun / cloud-rain / cloud-snow / cloud-fog / cloud-lightning
  high: z.string().min(1).max(8),                  // "72°"
  low:  z.string().min(1).max(8),                  // "55°"
  iconColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export function weatherSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  const base = z.object({
    condition_icon:  z.enum(ALLOWED_ICONS),        // current-conditions Phosphor name
    temperature:     z.string().min(1).max(8),
    condition_label: z.string().min(1).max(40),
    aqi_value:       z.string().min(1).max(5),
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
    cta_text:       z.string().max(40).optional(),
  });

  if (platform === 'instagram') {
    // Enriched variant — weather-ig.html
    return base.extend({
      forecast_days:  z.array(forecastItem).length(3),
      wind_direction: z.string().min(1).max(4),    // "W" / "NNE"
      wind_speed:     z.string().min(1).max(12),   // "8 mph"
      wind_icon:      z.enum(ALLOWED_ICONS).default('wind'),
    });
  }

  return base;
}
