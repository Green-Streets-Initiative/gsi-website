import 'server-only';
import { chromium } from 'playwright-core';
import sparticuzChromium from '@sparticuz/chromium';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { ASPECT_RATIOS, type AspectRatio } from './aspect-ratios';
import { type Platform } from './platform-overrides';
import { phosphorIcon } from './icons';
import { getTemplateFile } from './default-ratios';
import { expandArrayVars } from './array-renderers';
import { createServerSupabaseClient } from '../supabase-server';

/**
 * Render a social-image template to PNG and upload to Supabase Storage.
 *
 * Returns the public URL + final dimensions. Throws on any error;
 * caller (the API route) maps to a JSON error response.
 *
 * Cold start ~3-5s on Vercel due to Chromium boot. Warm renders ~1-2s.
 * Function memory should be 1024MB+ (configured at the route level).
 */
export interface RenderInput {
  template: string;       // base template id (e.g. "quote-stat"); the
                          // renderer maps to `<id>.html` or `<id>-ig.html`
                          // via getTemplateFile() based on platform
  platform: Platform;
  ratio: AspectRatio;
  // Vars may include arrays of objects (secondary_stats, forecast_days,
  // alternatives) for the enriched IG variants — the renderer
  // pre-renders those into HTML strings via expandArrayVars().
  vars: Record<string, unknown>;
}

export interface RenderResult {
  image_url: string;
  storage_path: string;
  width: number;
  height: number;
  template: string;
  platform: Platform;
  ratio: AspectRatio;
}

export async function renderSocialImage(input: RenderInput): Promise<RenderResult> {
  const dims = ASPECT_RATIOS[input.ratio];

  // 1. Load template HTML — getTemplateFile() picks the IG-enriched
  //    variant for quote-stat / weather / mbta on Instagram, or the
  //    standard file otherwise.
  const templateFilename = getTemplateFile(input.template, input.platform);
  const templatePath = join(
    process.cwd(),
    'src',
    'lib',
    'social-templates',
    'templates',
    templateFilename,
  );
  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateFilename}`);
  }
  let html = readFileSync(templatePath, 'utf-8');

  // 2. Inject system variables (always available regardless of vars[])
  html = html
    .replace(/\{\{__width__\}\}/g, String(dims.width))
    .replace(/\{\{__height__\}\}/g, String(dims.height))
    .replace(/\{\{__platform__\}\}/g, input.platform)
    .replace(/\{\{__ratio__\}\}/g, input.ratio);

  // 3a. Pre-render array vars (secondary_stats, forecast_days,
  //     alternatives) into HTML strings keyed as `<name>_html`.
  //     Returns a flat string-only record; the original array key is
  //     dropped from the result so the substitution loop below skips it.
  const flatVars = expandArrayVars(input.vars);

  // 3b. Inject the (now-flat) user variables. Three paths:
  //     - Keys ending in `_html` are pre-rendered HTML from step 3a.
  //       Inject RAW (no escaping); the helpers already escaped any
  //       user-supplied text inside.
  //     - Keys ending in `_icon` are Phosphor icon NAMES. Resolve to
  //       inline SVG via phosphorIcon() and inject RAW.
  //     - All other keys are user text — HTML-escape and inject.
  for (const [key, raw] of Object.entries(flatVars)) {
    const isHtmlBlock = /_html$/.test(key);
    const isIconField = /_icon$/.test(key);
    const replacement = isHtmlBlock
      ? raw
      : isIconField
      ? phosphorIcon(raw)
      : raw
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
    html = html.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g'), replacement);
  }

  // 4. Strip any unused {{var}} placeholders (so they don't render in the
  //    image as literal "{{foo}}" text). Empty string is safer than
  //    leaving a placeholder visible.
  html = html.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');

  // 5. Launch Chromium. On Vercel use @sparticuz/chromium; locally use
  //    a system Chrome path if PLAYWRIGHT_LOCAL_CHROMIUM_PATH is set,
  //    or fall back to whatever sparticuzChromium gives us.
  const isVercel = !!process.env.VERCEL;
  const localChromiumPath = process.env.PLAYWRIGHT_LOCAL_CHROMIUM_PATH;

  const browser = await chromium.launch({
    args: isVercel
      ? sparticuzChromium.args
      : ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: isVercel
      ? await sparticuzChromium.executablePath()
      : (localChromiumPath || (await sparticuzChromium.executablePath())),
    headless: true,
  });

  let storage_path: string;
  let publicUrl: string;

  try {
    const page = await browser.newPage({
      viewport: { width: dims.width, height: dims.height },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 15_000 });

    // Wait for fonts (Bricolage Grotesque) to load. Without this, the
    // screenshot can include the Arial Black fallback. The 5s floor
    // covers slow Google Fonts responses.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300); // small buffer for any pending image decodes

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: dims.width, height: dims.height },
    });

    // 6. Upload to Supabase Storage
    const supabase = createServerSupabaseClient();
    const filename = buildFilename(input);
    storage_path = filename;

    const { error: uploadErr } = await supabase.storage
      .from('social-images')
      .upload(filename, screenshot, {
        contentType: 'image/png',
        upsert: false,
      });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: urlData } = supabase.storage
      .from('social-images')
      .getPublicUrl(filename);
    publicUrl = urlData.publicUrl;
  } finally {
    await browser.close();
  }

  return {
    image_url: publicUrl,
    storage_path,
    width: dims.width,
    height: dims.height,
    template: input.template,
    platform: input.platform,
    ratio: input.ratio,
  };
}

function buildFilename(input: RenderInput): string {
  const safeRatio = input.ratio.replace(':', 'x');
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const rand = randomBytes(3).toString('hex');
  return `${input.template}-${safeRatio}-${input.platform}-${date}-${rand}.png`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
