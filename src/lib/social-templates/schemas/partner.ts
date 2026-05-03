import { z } from 'zod';
import { type Platform } from '../platform-overrides';
import { ALLOWED_ICONS } from '../icons';

export function partnerSchema(_platform: Platform) {
  return z.object({
    partner_logo: z.string().url(),                            // partners.logo_url
    partner_photo: z.string().url(),                           // partners.photo_url (atmosphere band)
    partner_name: z.string().min(1).max(40),
    partner_type: z.string().min(1).max(30).default('REWARDS PARTNER'),
    location: z.string().min(1).max(40),                       // "Natick, MA"
    location_icon: z.enum(ALLOWED_ICONS).default('map-pin'),   // Phosphor icon next to the location text
    offer_text: z.string().min(1).max(50),                     // "10% off tune-ups"
    offer_qualifier: z.string().min(1).max(40),                // "for Shift users"
    cta_text: z.string().max(40).optional(),
  });
}
