import { z } from 'zod';
import { type Platform } from '../platform-overrides';

// Helper for percentages used in the bar widths — must be 0-100.
const pct = z.coerce.number().min(0).max(100);

export function leaderboardSchema(_platform: Platform) {
  return z.object({
    period: z.string().min(1).max(40),                         // "Apr 28 – May 3"
    rank_1_name: z.string().min(1).max(30),
    rank_1_value: z.string().min(1).max(12),                   // "4,218" — formatted upstream
    rank_2_name: z.string().min(1).max(30),
    rank_2_value: z.string().min(1).max(12),
    // 0-100 — the rank-1 bar is hardcoded to 100% in the template;
    // these are the relative widths for ranks 2 and 3.
    rank_2_pct: pct,
    rank_3_name: z.string().min(1).max(30),
    rank_3_value: z.string().min(1).max(12),
    rank_3_pct: pct,
    community_total: z.string().min(1).max(15),                // "10,213"
  });
}
