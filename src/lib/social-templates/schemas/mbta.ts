import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';

export function mbtaSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  return z.object({
    line_name: z.string().min(1).max(40),                      // "Red Line"
    line_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),         // "#DA291C"
    // Brightened text variant of the line color (for the alert pill label
    // which sits on dark navy). Caller looks it up from a static map; if
    // missing, white is the safe fallback applied by the template.
    line_text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
    alert_type: z.string().min(1).max(40),                     // "SLOW ZONE", "DELAY", "SHUTTLE"
    alert_detail: z.string().min(1).max(160),                  // truncated to fit
    suggestion_headline: z.string().min(1).max(limits.nudge_headline),
    suggestion_body: z.string().min(1).max(limits.nudge_body),
    alt_mode_icon: z.string().min(1).max(4),                   // emoji: 🚲, 🚶, 🚇
    cta_text: z.string().max(40).optional(),
  });
}
