import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';

export function sponsorSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  return z.object({
    campaign_name: z.string().min(1).max(60),                  // "Shift Your Summer 2026"
    campaign_icon: z.string().min(1).max(4),                   // emoji
    // Tier strings come from a lookup map upstream — could extend to
    // z.enum(['COMMUNITY SPONSOR','CHAMPION SPONSOR','PRESENTING SPONSOR'])
    // but leaving open in case more tiers are added.
    tier_label: z.string().min(1).max(30),
    tier_icon: z.string().min(1).max(4),                       // 🌱 / ⭐ / 🏆
    tier_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),         // hex
    sponsor_logo: z.string().url(),                            // sponsors.logo_url
    sponsor_name: z.string().min(1).max(50),
    impact_text: z.string().min(1).max(limits.nudge_body),     // drafted; FACTUAL only
    cta_text: z.string().max(40).optional(),
  });
}
