import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';
import { ALLOWED_ICONS } from '../icons';

export function sponsorSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  return z.object({
    campaign_name: z.string().min(1).max(60),                  // "Shift Your Summer 2026"
    campaign_icon: z.enum(ALLOWED_ICONS),                      // Phosphor icon (e.g. 'sun-horizon' for summer campaign)
    // Tier strings come from a lookup map upstream — could extend to
    // z.enum(['COMMUNITY SPONSOR','CHAMPION SPONSOR','PRESENTING SPONSOR'])
    // but leaving open in case more tiers are added.
    tier_label: z.string().min(1).max(30),
    tier_icon: z.enum(ALLOWED_ICONS),                          // Phosphor: 'plant' (community), 'star' (champion), 'trophy' (presenting)
    tier_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),         // hex
    // Drives the campaign badge tint + text + icon color. Defaults to
    // brand green; use seasonal accents like #FFB74D (summer gold) or
    // #FF7043 (autumn orange) when the campaign has a seasonal feel.
    campaign_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#BAF14D'),
    sponsor_logo: z.string().url(),                            // sponsors.logo_url
    sponsor_name: z.string().min(1).max(50),
    impact_text: z.string().min(1).max(limits.nudge_body),     // drafted; FACTUAL only
    cta_text: z.string().max(40).optional(),
  });
}
