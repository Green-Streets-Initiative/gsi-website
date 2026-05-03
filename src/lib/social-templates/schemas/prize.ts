import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';

export function prizeSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  return z.object({
    prize_tag: z.string().min(1).max(30).default('🎉 GIVEAWAY'),
    prize_headline: z.string().min(1).max(70),                 // "Win a $50 Landry's gift card"
    partner_logo: z.string().url(),                            // funder logo
    partner_name: z.string().min(1).max(40),
    partner_location: z.string().min(1).max(40),
    how_to_win: z.string().min(1).max(limits.body_text),       // drafted from prize rules
    deadline: z.string().min(1).max(40),                       // "Ends May 31"
    legal_line: z.string().max(80).default('No purchase necessary · Rules apply'),
    cta_text: z.string().max(40).optional(),
  });
}
