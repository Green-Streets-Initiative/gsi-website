import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';
import { ALLOWED_ICONS } from '../icons';

export function sponsorSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  return z.object({
    campaign_name: z.string().min(1).max(60),                  // "Shift Your Summer 2026"
    campaign_icon: z.enum(ALLOWED_ICONS),                      // Phosphor icon (e.g. 'sun-horizon' for summer campaign)
    // Rendered as the second line of the headline ("Thank you to our /
    // Community Sponsor"), so this reads as prose — title case, not
    // shouty caps. Tier strings come from a lookup map upstream; left
    // open rather than an enum in case more tiers are added.
    tier_label: z.string().min(1).max(30),                     // "Community Sponsor" | "Champion Sponsor" | "Presenting Sponsor"
    tier_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),         // hex — tints the headline's tier line
    // Drives the eyebrow. Defaults to brand lime; use a seasonal accent
    // like #FFB74D (summer gold) or #FF7043 (autumn orange) when the
    // campaign has a seasonal feel.
    campaign_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#BAF14D'),
    sponsor_logo: z.string().url(),                            // sponsors.logo_url — rendered large in its own white tile
    sponsor_name: z.string().min(1).max(50),
    // Most sponsor logos are wordmarks that already carry the name, so
    // printing it again under the tile reads as a stutter. Set false in
    // that case; true only when the logo is a bare mark or monogram.
    show_name: z.boolean().default(false),
    impact_text: z.string().min(1).max(Math.min(limits.nudge_body, 110)),  // ONE sentence — the tile is the hero, not the copy
    // Optional proof strip — up to 3 campaign stats. All three cells are
    // independent; a cell renders only when both value and label are set,
    // and the whole strip collapses when none are.
    stat_1_value: z.string().max(12).nullable().optional(),    // e.g. "10,511"
    stat_1_label: z.string().max(14).nullable().optional(),    // e.g. "Trips"
    stat_2_value: z.string().max(12).nullable().optional(),
    stat_2_label: z.string().max(14).nullable().optional(),
    stat_3_value: z.string().max(12).nullable().optional(),
    stat_3_label: z.string().max(14).nullable().optional(),
    cta_text: z.string().max(40).nullable().optional(),
  });
}
