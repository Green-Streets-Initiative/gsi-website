import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';

export function roamSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  return z.object({
    photo: z.string().url(),                                   // roams.unsplash_url, full-bleed
    roam_tag: z.string().min(1).max(30).default('ROAM FRIDAY'),
    roam_name: z.string().min(1).max(50),
    distance: z.string().min(1).max(12),                       // "2.4 mi"
    mode_icon: z.string().min(1).max(4),                       // emoji
    route_label: z.string().min(1).max(50),                    // "Davis Sq → Union Sq"
    description: z.string().min(1).max(limits.body_text),
    xp_value: z.string().min(1).max(12),                       // "+150 XP"
    cta_text: z.string().max(40).optional(),
  });
}
