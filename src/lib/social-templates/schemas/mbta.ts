import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';
import { ALLOWED_ICONS } from '../icons';

/**
 * MBTA Alert schema. On Instagram (the enriched 4:5 variant), the
 * extra fields are required: `alternatives` (2-3 cards), `current_temp`,
 * `current_condition`, and `current_condition_icon`. On other platforms
 * (the compact 1.91:1 horizontal-split variant) the base fields suffice.
 */

const alternativeItem = z.object({
  icon: z.enum(ALLOWED_ICONS),                     // Phosphor: bicycle / bus / map-trifold / person-simple-walk / train
  mode: z.string().min(1).max(20),                 // "Bike" / "Walk + Bus" / "Bluebikes"
  detail: z.string().min(1).max(50),               // "Community Path runs parallel"
  time: z.string().min(1).max(40),                 // "~18 min Harvard → Alewife"
  highlight: z.boolean().optional(),               // true on the recommended option (visually highlighted)
  iconColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export function mbtaSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  const base = z.object({
    line_name: z.string().min(1).max(40),                      // "Red Line"
    line_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),         // "#DA291C"
    line_text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
    alert_type: z.string().min(1).max(40),                     // "SLOW ZONE"
    alert_detail: z.string().min(1).max(160),
    suggestion_headline: z.string().min(1).max(limits.nudge_headline),
    suggestion_body: z.string().min(1).max(limits.nudge_body),
    alt_mode_icon: z.enum(ALLOWED_ICONS),                      // Phosphor for the compact variant
    cta_text: z.string().max(40).optional(),
  });

  if (platform === 'instagram') {
    // Enriched variant — mbta-ig.html
    return base.extend({
      alternatives:           z.array(alternativeItem).min(2).max(3),
      current_temp:           z.string().min(1).max(8),         // "58°"
      current_condition:      z.string().min(1).max(20),        // "Dry"
      current_condition_icon: z.enum(ALLOWED_ICONS).default('sun'),
    });
  }

  return base;
}
