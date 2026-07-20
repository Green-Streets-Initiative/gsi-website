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
import { expandArrayVars, renderCeSpotlightHero, renderCeTypeTile } from './array-renderers';
import { renderRoamMapLayer, renderRoamStopList, type RoamMapCheckpoint } from './roam-map';
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

  // 2b. Pre-process nullable logo fields — generate monogram HTML
  //     when logoSrc / donorLogo is empty, or <img> when present.
  //     Injected raw via the `_html` suffix convention.
  preprocessLogoPlate(input.vars, 'logoSrc', 'partner');
  preprocessDonorLogo(input.vars, 'donorLogo', 'donor');
  if (['partner_block', 'partner_photo'].includes(input.template)) {
    preprocessPartnerLocation(input.vars);
  }

  if (input.template === 'ce_spotlight') {
    preprocessCeSpotlight(input.vars);
  }

  if (input.template === 'roam_map') {
    preprocessRoamMap(input.vars);
  }

  // 3a. Pre-render array vars (secondary_stats, forecast_days,
  //     alternatives, items) into HTML strings keyed as `<name>_html`.
  //     Returns a flat string-only record; the original array key is
  //     dropped from the result so the substitution loop below skips it.
  //     Template id disambiguates generic keys like `items`.
  const flatVars = expandArrayVars(input.vars, input.template);

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

  async function launchBrowser() {
    return chromium.launch({
      args: isVercel
        ? sparticuzChromium.args
        : ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: isVercel
        ? await sparticuzChromium.executablePath()
        : (localChromiumPath || (await sparticuzChromium.executablePath())),
      headless: true,
    });
  }

  async function captureScreenshot(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<Buffer> {
    const page = await browser.newPage({
      viewport: { width: dims.width, height: dims.height },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10_000 });

    await page.evaluate(() => Promise.all([
      document.fonts.ready,
      ...Array.from(document.images)
        .filter((img) => !img.complete)
        .map((img) => new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        })),
    ]));
    try { await page.waitForTimeout(200); } catch { /* context may be closing */ }

    return page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: dims.width, height: dims.height },
    });
  }

  let storage_path: string;
  let publicUrl: string;

  // Chromium on Vercel can die mid-render ("Target page, context or
  // browser has been closed") due to /tmp contention or cold-start
  // recycling. One retry with a fresh browser handles it.
  let screenshot: Buffer;
  let browser = await launchBrowser();
  try {
    screenshot = await captureScreenshot(browser);
  } catch (firstErr) {
    await browser.close().catch(() => {});
    if (isVercel && firstErr instanceof Error && firstErr.message.includes('has been closed')) {
      console.warn('[render] browser died, retrying with fresh instance');
      browser = await launchBrowser();
      screenshot = await captureScreenshot(browser);
    } else {
      throw firstErr;
    }
  } finally {
    await browser.close().catch(() => {});
  }

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

/**
 * Pre-process a nullable logo field into a `logo_plate_html` variable.
 * When the logo URL is present, produces an <img> tag on a white plate.
 * When absent, produces a monogram <span> from the first letter of
 * the `nameKey` field. The template uses `{{logo_plate_html}}` (raw
 * injection via the `_html` suffix).
 */
function preprocessLogoPlate(
  vars: Record<string, unknown>,
  logoKey: string,
  nameKey: string,
): void {
  const logoSrc = vars[logoKey];
  if (logoSrc && typeof logoSrc === 'string' && logoSrc.trim()) {
    vars['logo_plate_html'] =
      `<div style="width:168px;height:168px;border-radius:28px;background:#fff;display:flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 4px 24px rgba(0,0,0,0.12)">` +
      `<img src="${escapeHtmlAttr(logoSrc)}" alt="" style="max-width:88%;max-height:88%;object-fit:contain" />` +
      `</div>`;
  } else {
    const name = typeof vars[nameKey] === 'string' ? (vars[nameKey] as string) : '';
    const initial = name.charAt(0).toUpperCase() || '?';
    vars['logo_plate_html'] =
      `<div style="width:168px;height:168px;border-radius:28px;background:#fff;display:flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 4px 24px rgba(0,0,0,0.12)">` +
      `<span style="font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:84px;color:#191A2E;letter-spacing:-0.04em;line-height:1">${initial}</span>` +
      `</div>`;
  }
  // Remove the original key so it doesn't get substituted as a string
  delete vars[logoKey];
}

/**
 * Pre-process a nullable donor logo field into `donor_logo_html`.
 * When present, shows the logo on a white chip. When absent, shows
 * the donor name as plain meta text.
 */
function preprocessDonorLogo(
  vars: Record<string, unknown>,
  logoKey: string,
  nameKey: string,
): void {
  const logoSrc = vars[logoKey];
  const name = typeof vars[nameKey] === 'string' ? (vars[nameKey] as string) : '';
  if (logoSrc && typeof logoSrc === 'string' && logoSrc.trim()) {
    vars['donor_logo_html'] =
      `<span style="background:#fff;border-radius:8px;padding:8px 16px;display:inline-flex;align-items:center">` +
      `<img src="${escapeHtmlAttr(logoSrc)}" alt="${escapeHtmlAttr(name)}" style="height:28px;display:block" />` +
      `</span>`;
  } else {
    vars['donor_logo_html'] =
      `<span class="sx-meta">${escapeHtmlAttr(name)}</span>`;
  }
  delete vars[logoKey];
}

/**
 * Pre-process partner location fields into `location_html`.
 * When neighborhood is present, renders the full `.sx-loc` div with the
 * appropriate icon (map-pin for physical, globe-simple for online).
 * When absent, produces empty string — no orphan pin icon.
 */
function preprocessPartnerLocation(vars: Record<string, unknown>): void {
  const neighborhood = typeof vars['neighborhood'] === 'string' ? vars['neighborhood'].trim() : '';
  const iconName = typeof vars['locationIcon'] === 'string' ? vars['locationIcon'] : 'map-pin';

  if (neighborhood) {
    const iconSvg = phosphorIcon(iconName, { width: '36', height: '36' });
    vars['location_html'] =
      `<div class="sx-loc">` +
      `${iconSvg} ` +
      `${escapeHtmlAttr(neighborhood)}` +
      `</div>`;
  } else {
    vars['location_html'] = '';
  }

  delete vars['neighborhood'];
  delete vars['locationIcon'];
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function preprocessCeSpotlight(vars: Record<string, unknown>): void {
  const imageUrl = typeof vars['image_url'] === 'string' ? vars['image_url'] : null;
  vars['hero_html'] = renderCeSpotlightHero(imageUrl);
  delete vars['image_url'];

  const eventType = typeof vars['event_type'] === 'string' ? vars['event_type'] : '';
  vars['type_tile_html'] = renderCeTypeTile(eventType);
  delete vars['event_type'];
}

// Build the roam map layer + numbered stop list from checkpoints/route,
// then drop those array vars so the generic substitution loop skips them.
// Map region is 1080×760 to match roam_map.html.
function preprocessRoamMap(vars: Record<string, unknown>): void {
  const checkpoints = (Array.isArray(vars['checkpoints']) ? vars['checkpoints'] : []) as RoamMapCheckpoint[];
  const route = (Array.isArray(vars['route']) ? vars['route'] : null) as [number, number][] | null;
  const accent = typeof vars['badgeAccent'] === 'string' ? (vars['badgeAccent'] as string) : '#BAF14D';

  vars['map_html'] = renderRoamMapLayer({ checkpoints, route, width: 1080, height: 760, accent });
  vars['stops_html'] = renderRoamStopList(checkpoints);
  delete vars['checkpoints'];
  delete vars['route'];
}
