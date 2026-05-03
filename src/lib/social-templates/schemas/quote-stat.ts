import { z } from 'zod';
import { TEXT_LIMITS, type Platform } from '../platform-overrides';

export function quoteStatSchema(platform: Platform) {
  const limits = TEXT_LIMITS[platform];
  return z.object({
    category_tag:    z.string().min(1).max(40),         // e.g. "DID YOU KNOW"
    headline_number: z.string().min(1).max(20),         // e.g. "12,847"
    headline_unit:   z.string().min(1).max(40),         // e.g. "active trips"
    body_text:       z.string().min(1).max(limits.body_text),
    source_label:    z.string().min(1).max(60),         // e.g. "Shift Live Data · May 2026"
    cta_text:        z.string().max(40).optional(),     // only shown on FB/LI
  });
}
