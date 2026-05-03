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
import { type Platform } from '../platform-overrides';

type SchemaFactory = (platform: Platform) => ZodTypeAny;

export const TEMPLATE_SCHEMAS: Record<string, SchemaFactory> = {
  'quote-stat': quoteStatSchema,
  weather: weatherSchema,
};

export function getSchemaForTemplate(template: string): SchemaFactory | null {
  return TEMPLATE_SCHEMAS[template] ?? null;
}

export { z };
