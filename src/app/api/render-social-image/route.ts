import { NextRequest, NextResponse } from 'next/server';
import { renderSocialImage } from '@/lib/social-templates/render';
import { getSchemaForTemplate, TEMPLATE_IDS } from '@/lib/social-templates/schemas';
import { isValidPlatform, type Platform } from '@/lib/social-templates/platform-overrides';
import { isValidAspectRatio, type AspectRatio } from '@/lib/social-templates/aspect-ratios';

/**
 * POST /api/render-social-image
 *
 * Render a social image template to PNG and upload to Supabase Storage.
 * Returns the public URL + dimensions.
 *
 * Auth: shared secret in `Authorization: Bearer <INTERNAL_RENDER_API_KEY>`.
 * Callers in Phase 1 are (a) the social-publish Supabase edge function and
 * (b) ad-hoc Keith preview requests during development.
 */

// Vercel function config — Playwright + Chromium needs more memory and
// time than a typical API route. nodejs runtime (NOT edge) is required
// because Chromium can't run in V8 isolates.
export const runtime = 'nodejs';
export const maxDuration = 60;        // hard ceiling; typical render ~3-8s
export const dynamic = 'force-dynamic';

const INTERNAL_API_KEY = process.env.INTERNAL_RENDER_API_KEY ?? '';

function authError(): NextResponse {
  return NextResponse.json(
    { error: 'UNAUTHORIZED' },
    { status: 401 },
  );
}

function badRequest(error: string, details?: unknown): NextResponse {
  return NextResponse.json(
    { error, ...(details !== undefined ? { details } : {}) },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────
  if (!INTERNAL_API_KEY) {
    return NextResponse.json(
      { error: 'INTERNAL_RENDER_API_KEY not configured' },
      { status: 500 },
    );
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const provided = authHeader.replace(/^Bearer\s+/i, '');
  if (provided !== INTERNAL_API_KEY) return authError();

  // ── Parse body ────────────────────────────────────────────────────
  let body: {
    template?: string;
    platform?: string;
    ratio?: string;
    vars?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('INVALID_JSON');
  }

  const { template, platform, ratio, vars } = body;

  if (!template || typeof template !== 'string') {
    return badRequest('VALIDATION_FAILED', ['template is required']);
  }
  if (!platform || !isValidPlatform(platform)) {
    return badRequest('VALIDATION_FAILED', [
      'platform must be one of: instagram, facebook, linkedin, bluesky',
    ]);
  }
  if (!ratio || !isValidAspectRatio(ratio)) {
    return badRequest('VALIDATION_FAILED', [
      'ratio must be one of: 1:1, 4:5, 1.91:1, 9:16',
    ]);
  }
  if (!vars || typeof vars !== 'object') {
    return badRequest('VALIDATION_FAILED', ['vars must be an object']);
  }

  // ── Validate per-template variable shape ──────────────────────────
  const schemaFactory = getSchemaForTemplate(template);
  if (!schemaFactory) {
    return badRequest('VALIDATION_FAILED', [
      `template "${template}" is not registered`,
    ]);
  }
  const parse = schemaFactory(platform as Platform).safeParse(vars);
  if (!parse.success) {
    const issues = parse.error.issues.map(
      (i) => `vars.${i.path.join('.')}: ${i.message}`,
    );
    return badRequest('VALIDATION_FAILED', issues);
  }

  // ── Render ────────────────────────────────────────────────────────
  try {
    const result = await renderSocialImage({
      template,
      platform: platform as Platform,
      ratio: ratio as AspectRatio,
      vars: parse.data as Record<string, string>,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown render error';
    console.error('[render-social-image] render failed:', err);
    return NextResponse.json(
      { error: 'RENDER_FAILED', details: message },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'render-social-image',
      methods: ['POST'],
      templates: TEMPLATE_IDS,
      platforms: ['instagram', 'facebook', 'linkedin', 'bluesky'],
      ratios: ['1:1', '4:5', '1.91:1', '9:16'],
    },
    { status: 200 },
  );
}
