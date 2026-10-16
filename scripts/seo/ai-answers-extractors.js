// AI answer sample: in-page extractors for the monthly run (seo/methodology.md,
// "AI answer sample"). Each runs inside the Browser pane via javascript_tool
// after the question is on screen; each returns one JSON line for
// seo/data/ai-answers/<date>.json. Logged out, no account, no CAPTCHA solving:
// if Google shows its "unusual traffic" page, stop Google and come back later.
//
// Pacing that worked on 2026-10-16: Google, one query per ~15 s (it blocked
// after ~36 back-to-back queries and cleared within ~40 min); ChatGPT and
// Gemini, back to back. Keep each extractor under the tool's 45 s limit.

// Which names count. GSI = Green Streets Initiative, the site, or Walk/Ride Day.
const ORGS = {
  GSI: /green streets|gogreenstreets|walk ?ride day/i,
  Shift: /\bShift\b[^.\n]{0,30}\bapp\b|\bapp\b[^.\n]{0,20}\bShift\b/,
  MassBike: /massbike/i, BCU: /cyclists union/i, LivableStreets: /livable ?streets/i,
  WalkBoston: /walk ?boston/i, Bluebikes: /blue ?bikes/i, MBTA: /\bMBTA\b/,
  TransitApp: /transit app|transitapp/i, GoogleMaps: /google maps/i, Citymapper: /citymapper/i,
  Strava: /strava/i, MassDOT: /massdot/i, MassCommute: /mass ?commute|mass ?rides/i,
  TMA: /\bTMA\b|transportation management/i, BostonGov: /boston\.gov|boston bikes|city of boston/i,
  Reddit: /reddit|r\/boston/i, Waze: /waze/i, EbikeRebate: /masscec|mor-?ev|e-?bike (rebate|incentive)/i,
  ABetterCity: /a better city/i,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Source chips render as a name line followed by "+N".
const chips = (t) => {
  const L = t.split('\n').map((s) => s.trim());
  return [...new Set(L.filter((s, i) => /^\+ ?\d+$/.test(L[i + 1] || '')))];
};

// Google: open google.com/search?q=<question>&hl=en&gl=us, take a small
// screenshot (the AI Overview only renders while the pane is painted), then run.
export async function google() {
  let h = null;
  for (let k = 0; k < 6 && !h; k++) {
    h = [...document.querySelectorAll('h1,h2,div,span')]
      .find((e) => e.childElementCount <= 2 && e.innerText?.trim() === 'AI Overview');
    if (!h) await sleep(700);
  }
  const up = () => { let c = h; for (let i = 0; i < 14 && c; i++) { if (c.innerText.length > 600) break; c = c.parentElement; } return c; };
  let c = up();
  for (let k = 0; k < 25 && h && (!c || c.innerText.replace(/\s+/g, ' ').length < 500); k++) { await sleep(1000); c = up(); }
  const t = c ? c.innerText : '';
  const organic = [...document.querySelectorAll('a h3')].slice(0, 10)
    .map((x) => (x.closest('a').querySelector('cite')?.innerText || '').replace(/^https:\/\/(www\.)?/, '').split(' ')[0]);
  return JSON.stringify({
    e: 'google', q: new URLSearchParams(location.search).get('q'), aio: !!h,
    gsi: ORGS.GSI.test(t), rank: organic.findIndex((s) => /gogreenstreets/i.test(s)) + 1,
    srcs: chips(t).slice(0, 10), orgs: Object.keys(ORGS).filter((k) => ORGS[k].test(t)),
    top: organic.slice(0, 5), first: t.replace('AI Overview', '').trim().slice(0, 140),
  });
}

// ChatGPT: open chatgpt.com (logged out; the composer autofocuses), type the
// question, press Return, then run. Re-run if done is false.
export async function chatgpt() {
  let prev = -1, st = 0, done = false;
  await sleep(1000);
  for (let i = 0; i < 26; i++) {
    await sleep(1500);
    const t = document.querySelector('main')?.innerText || '';
    const seg = t.split('You said:').pop();
    const busy = !!document.querySelector('[data-testid="stop-button"],button[aria-label^="Stop"]');
    if (seg.includes('ChatGPT said') && !busy && t.length === prev) { if (++st >= 2) { done = true; break; } } else st = 0;
    prev = t.length;
  }
  const seg = document.querySelector('main').innerText.split('You said:').pop();
  const t = (seg.split('ChatGPT said:')[1] || '').split('ChatGPT is AI')[0];
  const links = [...new Set([...document.querySelectorAll('main a[href]')].map((a) => a.href)
    .filter((h) => /utm_source=chatgpt/.test(h)).map((h) => new URL(h).hostname.replace(/^www\./, '')))];
  return JSON.stringify({
    e: 'chatgpt', done, q: seg.split('ChatGPT said')[0].trim(), gsi: ORGS.GSI.test(t),
    orgs: Object.keys(ORGS).filter((k) => ORGS[k].test(t)), srcs: chips(t).slice(0, 8), links,
    first: t.trim().slice(0, 140),
  });
}

// Gemini: open gemini.google.com/app (logged out), click the prompt box, type,
// press Return, then run. Re-run if done is false.
export async function gemini() {
  const last = () => { const rs = [...document.querySelectorAll('model-response')]; return rs[rs.length - 1]; };
  let prev = -1, st = 0, done = false;
  await sleep(1500);
  for (let i = 0; i < 22; i++) {
    await sleep(1500);
    const t = last()?.innerText || '';
    const busy = !!document.querySelector('button[aria-label*="Stop" i]');
    if (t.length > 80 && !busy && t.length === prev) { if (++st >= 2) { done = true; break; } } else st = 0;
    prev = t.length;
  }
  const t = last()?.innerText || '';
  const L = t.split('\n').map((s) => s.trim());
  // Gemini also shows a bare source name between paragraphs, with no "+N".
  const srcs = [...new Set(L.filter((s, i) => s && s.length < 45 && !/[.:?!]$/.test(s)
    && (/^\+ ?\d+$/.test(L[i + 1] || '') || (i > 0 && /[.!?]$/.test(L[i - 1] || '') && L[i + 1] === ''))))]
    .filter((s) => !/^\+/.test(s));
  return JSON.stringify({
    e: 'gemini', done, gsi: ORGS.GSI.test(t), orgs: Object.keys(ORGS).filter((k) => ORGS[k].test(t)),
    srcs: srcs.slice(0, 8), first: t.replace(/^Gemini said\s*/, '').trim().slice(0, 140),
  });
}
