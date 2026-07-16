import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSchemaForTemplate, TEMPLATE_IDS } from '@/lib/social-templates/schemas';
import { isValidPlatform, type Platform } from '@/lib/social-templates/platform-overrides';

/**
 * GET /api/social-template-fields?template=<id>&platform=<p>
 *
 * Returns the JSON Schema for a template's image_variables, derived
 * directly from the zod schema in src/lib/social-templates/schemas/.
 * This makes the zod schemas the single source of truth for the field
 * contract — the Shift edge functions (drafter, revise, save) fetch
 * this instead of keeping their own hand-copied field lists.
 *
 * ?template=all returns just the list of registered template ids.
 *
 * Auth: same shared secret as the render endpoint
 * (`Authorization: Bearer <INTERNAL_RENDER_API_KEY>`).
 */

export const dynamic = 'force-dynamic';

const INTERNAL_API_KEY = process.env.INTERNAL_RENDER_API_KEY ?? '';

export async function GET(req: NextRequest) {
  if (!INTERNAL_API_KEY) {
    return NextResponse.json(
      { error: 'INTERNAL_RENDER_API_KEY not configured' },
      { status: 500 },
    );
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const provided = authHeader.replace(/^Bearer\s+/i, '');
  if (provided !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const template = req.nextUrl.searchParams.get('template') ?? '';
  const platformParam = req.nextUrl.searchParams.get('platform') ?? 'instagram';

  if (!template || template === 'all') {
    return NextResponse.json({ templates: TEMPLATE_IDS });
  }
  if (!isValidPlatform(platformParam)) {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', details: ['platform must be one of: instagram, facebook, linkedin, bluesky'] },
      { status: 400 },
    );
  }

  const factory = getSchemaForTemplate(template);
  if (!factory) {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', details: [`template "${template}" is not registered`] },
      { status: 404 },
    );
  }

  const schema = factory(platformParam as Platform);
  let jsonSchema: unknown;
  try {
    jsonSchema = z.toJSONSchema(schema as z.ZodType, {
      io: 'input',
      unrepresentable: 'any',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'SCHEMA_EXPORT_FAILED', details: [err instanceof Error ? err.message : 'unknown'] },
      { status: 500 },
    );
  }

  return NextResponse.json({
    template,
    platform: platformParam,
    json_schema: jsonSchema,
  });
}
