import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright-core';
import sparticuzChromium from '@sparticuz/chromium';

/**
 * POST /api/render-page
 *
 * Load a public web page in headless Chromium and return what a browser
 * would see: final URL, title, main text, main HTML, and the links in it.
 *
 * Why: some event calendars sit behind bot challenges that reject every
 * plain HTTP client (BU's calendar is fronted by an AWS WAF JavaScript
 * challenge — a 202 "enable JavaScript" stub to anything that isn't a real
 * browser, including Anthropic's server-side web_fetch). Headless Chrome
 * runs the challenge script and gets the real page. The Supabase
 * sync-community-events function calls this for sources whose config sets
 * `fetch_via: "render"`.
 *
 * Auth: shared secret in `Authorization: Bearer <INTERNAL_RENDER_API_KEY>`
 * (same key as /api/render-social-image).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const INTERNAL_API_KEY = process.env.INTERNAL_RENDER_API_KEY ?? '';

const MAX_TEXT_CHARS = 60_000;
const MAX_HTML_CHARS = 250_000;
const MAX_LINKS = 500;
const DEFAULT_SETTLE_MS = 2_500;
const MAX_SETTLE_MS = 8_000;
const NAV_TIMEOUT_MS = 30_000;

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// AWS WAF's challenge stub (and similar) — the page we must wait past.
const CHALLENGE_RE = /verify that you'?re not a robot|enable javascript and then reload|challenge-platform|cf-challenge/i;

function isPublicHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
  // IP literals (v4/v6) are refused outright — internal networks live there.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return null;
  return u;
}

interface PageCapture {
  title: string;
  text: string;
  html: string;
  links: Array<{ href: string; text: string }>;
  challenge: boolean;
}

export async function POST(req: NextRequest) {
  if (!INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'INTERNAL_RENDER_API_KEY not configured' }, { status: 500 });
  }
  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (provided !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { url?: string; wait_ms?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const target = typeof body.url === 'string' ? isPublicHttpUrl(body.url) : null;
  if (!target) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', details: ['url must be a public http(s) URL'] }, { status: 400 });
  }
  const settleMs = Math.min(
    MAX_SETTLE_MS,
    Math.max(0, typeof body.wait_ms === 'number' ? body.wait_ms : DEFAULT_SETTLE_MS),
  );

  const startedAt = Date.now();
  const isVercel = !!process.env.VERCEL;
  const localChromiumPath = process.env.PLAYWRIGHT_LOCAL_CHROMIUM_PATH;

  const browser = await chromium.launch({
    args: isVercel ? sparticuzChromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: isVercel
      ? await sparticuzChromium.executablePath()
      : localChromiumPath || (await sparticuzChromium.executablePath()),
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent: DESKTOP_UA,
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
    });
    const page = await context.newPage();
    // Images and media are dead weight for text extraction.
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'media' || type === 'font') return route.abort();
      return route.continue();
    });

    const response = await page.goto(target.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    });
    let status = response?.status() ?? 0;
    await page.waitForTimeout(settleMs);

    const capture = async (): Promise<PageCapture> =>
      page.evaluate(
        ({ maxText, maxHtml, maxLinks, challengeSource }) => {
          const challengeRe = new RegExp(challengeSource, 'i');
          const root =
            document.querySelector('main') ??
            document.querySelector('article') ??
            document.body;
          const text = (root?.innerText ?? '').replace(/[ \t]+\n/g, '\n').trim();
          const links: Array<{ href: string; text: string }> = [];
          const seen = new Set<string>();
          for (const a of Array.from((root ?? document).querySelectorAll('a[href]'))) {
            const href = (a as HTMLAnchorElement).href;
            if (!/^https?:/.test(href) || seen.has(href)) continue;
            seen.add(href);
            links.push({ href, text: (a.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) });
            if (links.length >= maxLinks) break;
          }
          return {
            title: document.title,
            text: text.slice(0, maxText),
            html: (root?.outerHTML ?? '').slice(0, maxHtml),
            links,
            challenge: challengeRe.test(document.body?.innerText ?? '') && text.length < 600,
          };
        },
        {
          maxText: MAX_TEXT_CHARS,
          maxHtml: MAX_HTML_CHARS,
          maxLinks: MAX_LINKS,
          challengeSource: CHALLENGE_RE.source,
        },
      );

    let result = await capture();

    // A challenge interstitial usually redirects itself once its script
    // finishes; if it hasn't, give it one more settle window and one reload.
    if (result.challenge) {
      await page.waitForTimeout(settleMs);
      result = await capture();
      if (result.challenge) {
        const again = await page.goto(target.toString(), {
          waitUntil: 'domcontentloaded',
          timeout: NAV_TIMEOUT_MS,
        });
        status = again?.status() ?? status;
        await page.waitForTimeout(settleMs);
        result = await capture();
      }
    }

    return NextResponse.json({
      final_url: page.url(),
      status,
      title: result.title,
      text: result.text,
      html: result.html,
      links: result.links,
      challenge_unresolved: result.challenge,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'RENDER_FAILED', details: (err as Error).message },
      { status: 502 },
    );
  } finally {
    await browser.close().catch(() => undefined);
  }
}
