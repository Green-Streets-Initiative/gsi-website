import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';
import { ALLOWED_ICONS } from '../icons';

/**
 * Quote/Stat schema. On Instagram (the enriched 4:5 variant), the
 * extra fields are required: `secondary_stats` (3 cards), `trend_text`,
 * `trend_detail`, and `trend_icon`. On other platforms (the compact
 * 1.91:1 horizontal-split variant) the base fields are sufficient and
 * the enriched fields are ignored if supplied.
 */

const secondaryStatItem = z.object({
  value: z.string().min(1).max(15),               // "2,340"
  // Per the no-adversarial-cars brand rule, labels must NOT include
  // "vs driving" / "vs. driving" framing — even though the JSX
  // example used it. Use neutral labels like "money saved" or
  // "lbs CO₂ avoided" instead.
  label: z.string().min(1).max(28),
  icon: z.enum(ALLOWED_ICONS),                    // Phosphor icon name
  iconColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export function quoteStatSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  const base = z.object({
    category_tag:    z.string().min(1).max(40),    // "DID YOU KNOW"
    headline_number: z.string().min(1).max(20),    // "12,847"
    headline_unit:   z.string().min(1).max(40),    // "active trips"
    body_text:       z.string().min(1).max(limits.body_text),
    source_label:    z.string().min(1).max(60),    // "Shift Live Data · May 2026"
    cta_text:        z.string().max(40).optional(),
  });

  if (platform === 'instagram') {
    // Enriched variant — quote-stat-ig.html
    return base.extend({
      secondary_stats: z.array(secondaryStatItem).length(3),
      trend_text:      z.string().min(1).max(50),
      trend_detail:    z.string().min(1).max(60),
      trend_icon:      z.enum(ALLOWED_ICONS).default('trend-up'),
    });
  }

  return base;
}
