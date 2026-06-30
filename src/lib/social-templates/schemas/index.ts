/**
 * Per-template Zod schemas. Indexed by template id so the API route can
 * validate request.vars against the right shape before spinning up
 * Playwright (cheaper to reject upfront than after a 6s render attempt).
 *
 * Each schema FACTORY takes the platform so we can apply per-platform
 * text length limits from platform-overrides.ts.
 */

import { z, type ZodTypeAny } from 'zod';
import { quoteStatSchema } from './quote-stat';
import { weatherSchema } from './weather';
import { mbtaSchema } from './mbta';
import { roamSchema } from './roam';
import { leaderboardSchema } from './leaderboard';
import { partnerSchema } from './partner';
import { prizeSchema } from './prize';
import { sponsorSchema } from './sponsor';
// v2 templates
import { dykNumberSchema } from './dyk-number';
import { dykEditorialSchema } from './dyk-editorial';
import { partnerPhotoSchema } from './partner-photo';
import { partnerBlockSchema } from './partner-block';
import { prizeGrandSchema } from './prize-grand';
import { prizeFeaturedSchema } from './prize-featured';
import { prizePoolSchema } from './prize-pool';
import { roamPosterSchema } from './roam-poster';
import { roamCollectionSchema } from './roam-collection';
import { ceWeekSchema } from './ce-week';
import { ceSpotlightSchema } from './ce-spotlight';
import { ceMonthSchema } from './ce-month';
import { ceWeekFbSchema } from './ce-week-fb';
import { ceCarouselCoverSchema } from './ce-carousel-cover';
import { ceCarouselWeekSchema } from './ce-carousel-week';
import { type Platform } from '../platform-overrides';

type SchemaFactory = (platform: Platform) => ZodTypeAny;

export const TEMPLATE_SCHEMAS: Record<string, SchemaFactory> = {
  'quote-stat': quoteStatSchema,
  weather: weatherSchema,
  mbta: mbtaSchema,
  roam: roamSchema,
  leaderboard: leaderboardSchema,
  partner: partnerSchema,
  prize: prizeSchema,
  sponsor: sponsorSchema,
  // v2 templates
  dyk_number: dykNumberSchema,
  dyk_editorial: dykEditorialSchema,
  partner_photo: partnerPhotoSchema,
  partner_block: partnerBlockSchema,
  prize_grand: prizeGrandSchema,
  prize_featured: prizeFeaturedSchema,
  prize_pool: prizePoolSchema,
  roam_poster: roamPosterSchema,
  roam_collection: roamCollectionSchema,
  // Community events templates
  ce_week: ceWeekSchema,
  ce_spotlight: ceSpotlightSchema,
  ce_month: ceMonthSchema,
  ce_week_fb: ceWeekFbSchema,
  ce_carousel_cover: ceCarouselCoverSchema,
  ce_carousel_week: ceCarouselWeekSchema,
};

export const TEMPLATE_IDS = Object.keys(TEMPLATE_SCHEMAS);

export function getSchemaForTemplate(template: string): SchemaFactory | null {
  return TEMPLATE_SCHEMAS[template] ?? null;
}

export { z };
