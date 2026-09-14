#!/usr/bin/env node
/**
 * Health + AEO surface checks for the SEO/AEO routine.
 *
 *   node scripts/seo/health-check.mjs
 *   node scripts/seo/health-check.mjs --json     # machine-readable
 *
 * Replaces the compound `curl … | grep … && shasum …` chains the routine used
 * to run. Those could not be allowlisted (each was a different one-off string),
 * so every check prompted. This is one fixed command, allowlistable as
 * `Bash(node scripts/seo/health-check.mjs:*)`.
 *
 * Read-only: issues plain GETs against the public site and writes nothing.
 * Compare the output against `.seo-state.json.health` — this script deliberately
 * does not read or write that file, so it can never launder a drift into a pass.
 */
import crypto from 'node:crypto'

const SITE = 'https://www.gogreenstreets.org'
const JSON_OUT = process.argv.includes('--json')

// Pages whose title, canonical and structured data the routine checks each run.
const PAGES = [
  '/commute-advisor',
  '/nearby',
  '/shift-your-semester/mit',
  '/guides/how-far-is-a-ten-minute-drive-on-foot',
  '/shift/towns/cambridge-ma',
]

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' })
  return { status: res.status, body: await res.text() }
}

const result = { checkedAt: new Date().toISOString(), surfaces: {}, pages: {} }

/* ── sitemap.xml ──────────────────────────────────────────────────────────── */
try {
  const { status, body } = await get(`${SITE}/sitemap.xml`)
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  // Page-class counts are the useful fingerprint: a whole section vanishing on
  // a DB blip shows here, where a total count barely moves.
  // Group two segments deep under /shift. Grouping on the first segment only
  // hid /shift/roams inside /shift — and /shift is "covered" by llms.txt via its
  // town section, so the twelve best-converting pages on the site could be
  // absent from llms.txt while the gap check below reported all clear
  // (found by hand 2026-09-14, the same way the campus gap was found).
  const NESTED_PARENTS = new Set(['shift'])
  const classes = {}
  for (const l of locs) {
    const seg = l.replace(SITE, '').split('?')[0].split('/').filter(Boolean)
    const k = !seg.length
      ? '(home)'
      : NESTED_PARENTS.has(seg[0]) && seg.length > 1
        ? `${seg[0]}/${seg[1]}`
        : seg[0]
    classes[k] = (classes[k] || 0) + 1
  }
  result.surfaces.sitemap = { status, locCount: locs.length, classes }
} catch (e) {
  result.surfaces.sitemap = { error: e.message }
}

/* ── robots.txt ───────────────────────────────────────────────────────────── */
try {
  const { status, body } = await get(`${SITE}/robots.txt`)
  result.surfaces.robots = { status, sha256: sha(body), lines: body.split('\n').length }
} catch (e) {
  result.surfaces.robots = { error: e.message }
}

/* ── llms.txt ─────────────────────────────────────────────────────────────── */
// Generated per request, so its hash changes whenever content publishes. The
// link and section counts are the meaningful drift signals; the hash is noise.
try {
  const { status, body } = await get(`${SITE}/llms.txt`)
  const sections = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1])
  const links = (body.match(/^- \[/gm) || []).length
  result.surfaces.llms = { status, sha256: sha(body), lines: body.split('\n').length, linkCount: links, sectionCount: sections.length, sections }
} catch (e) {
  result.surfaces.llms = { error: e.message }
}

/* ── key pages ────────────────────────────────────────────────────────────── */
for (const p of PAGES) {
  try {
    const { status, body } = await get(SITE + p)
    const title = (body.match(/<title>([^<]*)<\/title>/) || [])[1] || null
    const canonical = (body.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || null
    const types = {}
    for (const m of body.matchAll(/"@type":"([A-Za-z]+)"/g)) types[m[1]] = (types[m[1]] || 0) + 1
    result.pages[p] = { status, title, canonical, canonicalOk: canonical === SITE + p, jsonLdTypes: types }
  } catch (e) {
    result.pages[p] = { error: e.message }
  }
}

/* ── llms.txt vs sitemap coverage ─────────────────────────────────────────── */
// The gap that hid the campus pages: a page class published in the sitemap but
// absent from the file answer engines read.
try {
  const llms = result.surfaces.llms
  const sm = result.surfaces.sitemap
  if (llms?.sections && sm?.classes) {
    const { body } = await get(`${SITE}/llms.txt`)
    const missing = Object.entries(sm.classes)
      .filter(([cls, n]) => n >= 3 && !body.includes(`${SITE}/${cls}`))
      .map(([cls, n]) => ({ class: '/' + cls, sitemapUrls: n }))
    result.surfaces.llmsCoverageGaps = missing
  }
} catch { /* non-fatal */ }

/* ── output ───────────────────────────────────────────────────────────────── */
if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2))
} else {
  const s = result.surfaces
  console.log(`Health check — ${result.checkedAt}\n`)
  console.log(`sitemap.xml   ${s.sitemap.status ?? 'ERR'}  ${s.sitemap.locCount ?? ''} <loc>`)
  if (s.sitemap.classes)
    console.log(`              classes: ${Object.entries(s.sitemap.classes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ')}`)
  console.log(`robots.txt    ${s.robots.status ?? 'ERR'}  sha ${(s.robots.sha256 || '').slice(0, 12)}…`)
  console.log(`llms.txt      ${s.llms.status ?? 'ERR'}  ${s.llms.linkCount} links  ${s.llms.sectionCount} sections  sha ${(s.llms.sha256 || '').slice(0, 12)}…`)
  if (s.llms.sections) console.log(`              sections: ${s.llms.sections.join(' | ')}`)
  if (s.llmsCoverageGaps?.length) {
    console.log('\n  !! PAGE CLASSES IN SITEMAP BUT NOT IN LLMS.TXT:')
    for (const g of s.llmsCoverageGaps) console.log(`     ${g.class}  (${g.sitemapUrls} urls)`)
  }
  console.log('\nKey pages:')
  for (const [p, r] of Object.entries(result.pages)) {
    if (r.error) { console.log(`  ${p}\n     ERROR ${r.error}`); continue }
    const types = Object.entries(r.jsonLdTypes).map(([k, v]) => (v > 1 ? `${k}×${v}` : k)).join(', ') || 'none'
    console.log(`  ${p}`)
    console.log(`     ${r.status}  canonical ${r.canonicalOk ? 'ok' : 'MISMATCH: ' + r.canonical}`)
    console.log(`     title: ${r.title}`)
    console.log(`     json-ld: ${types}`)
  }
  console.log('\nCompare against .seo-state.json.health — this script does not read it.')
}
