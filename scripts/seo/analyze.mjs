#!/usr/bin/env node
/**
 * Analyze the committed Search Console pulls for the SEO/AEO routine.
 *
 *   node scripts/seo/analyze.mjs            # full report
 *   node scripts/seo/analyze.mjs --section baselines|weeks|clusters|pages|cohort|trigger|growth|queries
 *   node scripts/seo/analyze.mjs --section cohort --class /events,/shift/roams
 *
 * WHY THIS FILE EXISTS. Every run of the routine used to recompute baselines and
 * replay cluster bucketing through a series of ad-hoc `node -e '...'` one-liners.
 * That is arbitrary code execution as far as the permission system is concerned,
 * so it can never be allowlisted, and it prompted on every single call. A
 * transcript scan on 2026-09-09 found ~7,400 tool calls across 50 sessions with
 * the top commands almost all wrapped in compound shell or inline interpreters.
 *
 * One committed script with fixed arguments is allowlistable as
 * `Bash(node scripts/seo/analyze.mjs:*)`, reviewable in git, and reproducible —
 * three things an inline blob is not. Add analysis here rather than inlining it.
 *
 * Read-only: opens files under seo/, writes nothing, makes no network calls.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GSC = path.join(REPO, 'seo', 'data', 'gsc')
const PORTFOLIO = path.join(REPO, 'seo', 'keyword-portfolio.json')

const argOf = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const SECTION = argOf('section', 'all')
const want = (s) => SECTION === 'all' || SECTION === s

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const pct = (a, b) => (b === 0 ? 'n/a' : `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toFixed(0)}%`)
const mean = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0)

/* ── The current series ──────────────────────────────────────────────────────
 * seo/data/gsc/ holds two overlapping series. Only files containing
 * `site_totals` are true no-dimension totals on Saturday-to-Friday windows; the
 * 2026-08-20 backfill files lack it, use Monday-ending windows, and understate
 * clicks ~4x. Mixing them double-counts. See seo/methodology.md.
 */
function loadSeries() {
  const out = []
  for (const f of fs.readdirSync(GSC)) {
    if (!/^weekly-.*\.json$/.test(f)) continue
    const j = readJson(path.join(GSC, f))
    if (!j.site_totals) continue // superseded backfill — excluded on purpose
    out.push({ file: f, start: j.range.startDate, end: j.range.endDate, j })
  }
  out.sort((a, b) => (a.end < b.end ? -1 : 1))
  let prevEnd = null
  const overlaps = []
  for (const s of out) {
    if (prevEnd && s.start <= prevEnd) overlaps.push(`${s.file} starts ${s.start} but previous ends ${prevEnd}`)
    prevEnd = s.end
  }
  return { series: out, overlaps }
}

const { series, overlaps } = loadSeries()
if (!series.length) {
  console.error('No weekly files with site_totals found. Run pull-gsc.mjs first.')
  process.exit(1)
}
const latest = series[series.length - 1]

console.log(`SEO analysis — ${series.length} weekly files with site_totals`)
console.log(`Latest window: ${latest.start} -> ${latest.end}  (${latest.file})`)
if (overlaps.length) {
  console.log('\n!! OVERLAPPING RANGES — baselines are NOT trustworthy:')
  for (const o of overlaps) console.log('   ' + o)
} else {
  console.log('Contiguity: OK (no overlapping ranges)')
}

/* ── Weekly table ─────────────────────────────────────────────────────────── */
if (want('weeks')) {
  console.log('\n=== TRUE WEEKLY SITE TOTALS (last 13) ===')
  console.log('week_end     clicks  impressions   CTR    avg_pos')
  for (const s of series.slice(-13).reverse()) {
    const t = s.j.site_totals
    console.log(
      `${s.end}  ${String(t.clicks).padStart(6)}  ${String(t.impressions).padStart(11)}  ${(t.ctr * 100).toFixed(2).padStart(5)}%  ${String(t.position).padStart(7)}`,
    )
  }
}

/* ── Baselines ────────────────────────────────────────────────────────────── */
if (want('baselines')) {
  const st = (x) => x.j.site_totals
  const qd = (x) => x.j.totals
  const cur = latest.j.site_totals
  // Comparison baselines EXCLUDE the current week, so "vs 4-wk" answers
  // "against what came before", not "against a mean I am inside of".
  const p4 = series.slice(-5, -1)
  const p12 = series.slice(-13, -1)
  const t4 = series.slice(-4)
  const t4prior = series.slice(-8, -4)

  console.log('\n=== LEDGER ===')
  console.log(`This week:  clicks ${cur.clicks}   impressions ${cur.impressions}   CTR ${(cur.ctr * 100).toFixed(2)}%   pos ${cur.position}`)
  if (p4.length === 4)
    console.log(`  vs 4-wk:  clicks ${mean(p4, (x) => st(x).clicks).toFixed(2)} (${pct(cur.clicks, mean(p4, (x) => st(x).clicks))})   impressions ${mean(p4, (x) => st(x).impressions).toFixed(1)} (${pct(cur.impressions, mean(p4, (x) => st(x).impressions))})`)
  if (p12.length === 12)
    console.log(`  vs 12-wk: clicks ${mean(p12, (x) => st(x).clicks).toFixed(2)} (${pct(cur.clicks, mean(p12, (x) => st(x).clicks))})   impressions ${mean(p12, (x) => st(x).impressions).toFixed(1)} (${pct(cur.impressions, mean(p12, (x) => st(x).impressions))})`)

  console.log('\n=== STATE BASELINE CACHE (includes this week) ===')
  console.log(`  clicks_4wk       ${mean(t4, (x) => st(x).clicks).toFixed(2)}`)
  console.log(`  clicks_12wk      ${mean(series.slice(-12), (x) => st(x).clicks).toFixed(2)}`)
  console.log(`  impressions_4wk  ${mean(t4, (x) => st(x).impressions).toFixed(1)}`)
  console.log(`  impressions_12wk ${mean(series.slice(-12), (x) => st(x).impressions).toFixed(1)}`)
  console.log(`  clicks_4wk_querydim      ${mean(t4, (x) => qd(x).clicks).toFixed(2)}`)
  console.log(`  impressions_4wk_querydim ${mean(t4, (x) => qd(x).impressions).toFixed(1)}`)

  if (t4prior.length === 4) {
    const a = mean(t4, (x) => st(x).clicks)
    const b = mean(t4prior, (x) => st(x).clicks)
    console.log('\n=== 4-WK vs PRIOR 4-WK (context; the trigger itself is non-brand, see clusters) ===')
    console.log(`  clicks      ${a.toFixed(2)}/wk vs ${b.toFixed(2)}/wk  ${pct(a, b)}`)
    const ai = mean(t4, (x) => st(x).impressions)
    const bi = mean(t4prior, (x) => st(x).impressions)
    console.log(`  impressions ${ai.toFixed(1)}/wk vs ${bi.toFixed(1)}/wk  ${pct(ai, bi)}`)
  }
}

/* ── Cluster replay ───────────────────────────────────────────────────────── */
// Re-buckets the stored query rows against the CURRENT portfolio, so a
// portfolio edit takes effect without waiting for the next pull.
function replay(j) {
  const portfolio = readJson(PORTFOLIO)
  const clusters = portfolio.clusters.map((c) => ({
    id: c.id,
    res: (c.gsc_patterns || []).map((p) => new RegExp(p, 'i')),
  }))
  const rows = []
  for (const c of j.clusters || []) for (const q of c.top_queries || []) rows.push(q)
  for (const q of j.unmatched_top_queries || []) rows.push(q)

  const agg = new Map()
  const unmatched = []
  for (const r of rows) {
    const hit = clusters.find((c) => c.res.some((re) => re.test((r.query || '').toLowerCase())))
    if (!hit) { unmatched.push(r); continue }
    const a = agg.get(hit.id) || { impressions: 0, clicks: 0, posW: 0 }
    a.impressions += r.impressions
    a.clicks += r.clicks
    a.posW += r.position * r.impressions
    agg.set(hit.id, a)
  }
  const sampled = rows.reduce((s, r) => s + r.impressions, 0)
  const unmatchedImpr = unmatched.reduce((s, r) => s + r.impressions, 0)
  // The stagnation trigger's basis: everything except brand, plus unmatched.
  let nonBrand = unmatchedImpr
  for (const [id, a] of agg) if (id !== 'brand-navigational') nonBrand += a.impressions
  return { agg, unmatched, sampled, unmatchedImpr, nonBrand }
}

if (want('clusters')) {
  for (const [label, j] of [['WEEK ' + latest.end, latest.j], ...monthlyIfAny()]) {
    const r = replay(j)
    console.log(`\n=== CLUSTERS — ${label} (sampled ${r.sampled} impressions) ===`)
    const rows = [...r.agg.entries()].sort((a, b) => b[1].impressions - a[1].impressions)
    for (const [id, a] of rows)
      console.log(`  ${id.padEnd(24)} impr ${String(a.impressions).padStart(5)}  clicks ${String(a.clicks).padStart(3)}  pos ${(a.posW / a.impressions).toFixed(1)}`)
    const cov = ((1 - r.unmatchedImpr / r.sampled) * 100).toFixed(0)
    console.log(`  ${'coverage'.padEnd(24)} ${cov}%   unmatched ${r.unmatchedImpr}`)
    console.log(`  ${'NON-BRAND (trigger)'.padEnd(24)} ${r.nonBrand}   <- stagnation trigger basis`)
  }
}

function monthlyIfAny() {
  const files = fs.readdirSync(GSC).filter((f) => /^monthly-.*\.json$/.test(f)).sort()
  if (!files.length) return []
  const f = files[files.length - 1]
  return [[`28-DAY ${f}`, readJson(path.join(GSC, f))]]
}

/* ── Pages ────────────────────────────────────────────────────────────────── */
if (want('pages')) {
  const pages = latest.j.top_pages || []
  console.log(`\n=== TOP PAGES — week ${latest.end} ===`)
  for (const p of pages.slice(0, 20))
    console.log(`  ${String(p.impressions).padStart(5)} impr  ${String(p.clicks).padStart(3)} clk  pos ${String((p.position || 0).toFixed(1)).padStart(5)}  ${(p.page || '').replace('https://www.gogreenstreets.org', '')}`)

  // Page-class rollup. Catches a whole section growing or collapsing, which a
  // per-URL list buries — this is how the campus pages were found.
  // Group two segments deep under /shift, matching scripts/seo/health-check.mjs.
  // On the first segment alone, /shift/roams — the best-converting page class on
  // the site — was invisible inside /shift, so the rollup built to catch a
  // section growing could not report the section that was growing fastest.
  const NESTED_PARENTS = new Set(['shift'])
  const classOf = (u) => {
    const p = (u || '').replace('https://www.gogreenstreets.org', '').split('?')[0]
    const seg = p.split('/').filter(Boolean)
    if (!seg.length) return '/(home)'
    return NESTED_PARENTS.has(seg[0]) && seg.length > 1 ? `/${seg[0]}/${seg[1]}` : '/' + seg[0]
  }
  const byClass = new Map()
  for (const p of pages) {
    const k = classOf(p.page)
    const a = byClass.get(k) || { impressions: 0, clicks: 0, n: 0 }
    a.impressions += p.impressions
    a.clicks += p.clicks
    a.n++
    byClass.set(k, a)
  }
  const total = pages.reduce((s, p) => s + p.impressions, 0)
  console.log(`\n=== PAGE-CLASS ROLLUP — week ${latest.end} ===`)
  for (const [k, a] of [...byClass.entries()].sort((x, y) => y[1].impressions - x[1].impressions))
    console.log(`  ${k.padEnd(22)} ${String(a.impressions).padStart(5)} impr  ${String(a.clicks).padStart(3)} clk  ${String(a.n).padStart(3)} urls  ${((a.impressions / total) * 100).toFixed(0)}%`)

  const utm = pages.filter((p) => (p.page || '').includes('utm_'))
  if (utm.length)
    console.log(`\n  UTM-parameterized rows still indexed: ${utm.length}, ${utm.reduce((s, p) => s + p.impressions, 0)} impressions`)
}

/* ── Fixed cohort, week over week ─────────────────────────────────────────────
 * Class totals mix two effects: pages newly indexed, and pages Google already
 * had doing better or worse. Experiments on titles/snippets (exp-2026-09-5) and
 * discovery (exp-2026-09-6) must be read on the pages present in BOTH weeks.
 * Also prints each week's row count and floor, because a page missing from a
 * truncated table is not a page with zero impressions (see 2026-09-21 notes).
 */
if (want('cohort')) {
  const prev = series[series.length - 2]
  if (prev) {
    const strip = (u) => (u || '').replace('https://www.gogreenstreets.org', '')
    const table = (j) => new Map((j.top_pages || []).map((p) => [strip(p.page), p]))
    const a = table(prev.j)
    const b = table(latest.j)
    const floor = (m) => Math.min(...[...m.values()].map((p) => p.impressions))
    console.log(`\n=== FIXED COHORT — ${prev.end} -> ${latest.end} ===`)
    console.log(`  page table: ${a.size} rows (floor ${floor(a)} impr) -> ${b.size} rows (floor ${floor(b)} impr)`)
    const classes = (argOf('class', '/events,/shift/roams,/shift/towns,/shift-your-semester,/guides')).split(',')
    const sum = (rows) => rows.reduce((s, p) => ({ i: s.i + p.impressions, c: s.c + p.clicks }), { i: 0, c: 0 })
    const ctr = (s) => (s.i ? ((s.c / s.i) * 100).toFixed(2) + '%' : 'n/a')
    for (const cls of classes) {
      const inCls = (k) => k === cls || k.startsWith(cls + '/')
      const both = [...b.keys()].filter((k) => inCls(k) && a.has(k))
      const fresh = [...b.keys()].filter((k) => inCls(k) && !a.has(k))
      const gone = [...a.keys()].filter((k) => inCls(k) && !b.has(k))
      const before = sum(both.map((k) => a.get(k)))
      const after = sum(both.map((k) => b.get(k)))
      const n = sum(fresh.map((k) => b.get(k)))
      const g = sum(gone.map((k) => a.get(k)))
      console.log(`  ${cls}`)
      console.log(`    cohort ${String(both.length).padStart(3)} pages  impr ${before.i} -> ${after.i} (${pct(after.i, before.i)})  clicks ${before.c} -> ${after.c}  CTR ${ctr(before)} -> ${ctr(after)}`)
      console.log(`    new    ${String(fresh.length).padStart(3)} pages  impr ${n.i}  clicks ${n.c}  CTR ${ctr(n)}`)
      console.log(`    gone   ${String(gone.length).padStart(3)} pages  impr ${g.i}  clicks ${g.c}  (last week)`)
    }
  }
}

/* ── Stagnation trigger series ────────────────────────────────────────────────
 * Replays every current-series week against the CURRENT portfolio and prints
 * the non-brand discovery impressions, then trailing-4 vs prior-4 — the exact
 * comparison seo/methodology.md specifies. Replaying keeps the series on one
 * portfolio, so a pattern edit cannot look like a traffic change.
 */
if (want('trigger')) {
  console.log('\n=== STAGNATION TRIGGER — non-brand discovery impressions (replayed on current portfolio) ===')
  const vals = series.slice(-8).map((s) => ({ end: s.end, v: replay(s.j).nonBrand }))
  for (const x of vals) console.log(`  ${x.end}  ${String(x.v).padStart(5)}`)
  if (vals.length === 8) {
    const t4 = mean(vals.slice(-4), (x) => x.v)
    const p4 = mean(vals.slice(0, 4), (x) => x.v)
    console.log(`  trailing 4 wk ${t4.toFixed(1)}/wk vs prior 4 wk ${p4.toFixed(1)}/wk  ${pct(t4, p4)}`)
  }
}

/* ── Growth funnel by channel ─────────────────────────────────────────────────
 * The routine is accountable for growth, not traffic alone: search impressions
 * -> clicks -> sessions -> activated (used a tool) -> app intent (clicked toward
 * the Shift app). Sessions and outcomes come from the newest PostHog pull
 * (channels_by_week); Ad Grants account numbers come from the newest snapshot
 * the ad-grants-review routine writes to ads/ad-grants-state.json (Wednesdays),
 * so this section never touches the Ads account itself.
 */
if (want('growth')) {
  const PH = path.join(REPO, 'seo', 'data', 'posthog')
  const phFiles = fs.existsSync(PH) ? fs.readdirSync(PH).filter((f) => /^weekly-.*\.json$/.test(f)).sort() : []
  const ph = phFiles.length ? readJson(path.join(PH, phFiles[phFiles.length - 1])) : null
  console.log('\n=== GROWTH FUNNEL BY CHANNEL (PostHog, Monday-start weeks) ===')
  if (!ph?.channels_by_week) {
    console.log('  no channels_by_week in the newest PostHog pull — re-run pull-posthog.mjs')
  } else {
    const weeks = (ph.weeks || []).map((w) => w.week_start) // complete weeks, newest first
    const CH = ['organic_search', 'paid_search', 'paid_other', 'answer_engine']
    const get = (wk, ch) => ph.channels_by_week[wk]?.[ch] || { sessions: 0, activated: 0, app_intent: 0 }
    const rate = (n, d) => (d ? ((n / d) * 100).toFixed(1) + '%' : '—')
    console.log(`  week of ${weeks[0]}            sessions  activated   app intent   intent rate   vs prior-4 sessions`)
    for (const ch of CH) {
      const c = get(weeks[0], ch)
      const p4 = mean(weeks.slice(1, 5), (wk) => get(wk, ch).sessions)
      console.log(
        `  ${ch.padEnd(24)} ${String(c.sessions).padStart(8)}  ${String(c.activated).padStart(9)}  ${String(c.app_intent).padStart(11)}  ${rate(c.app_intent, c.sessions).padStart(12)}   ${p4.toFixed(1)} (${pct(c.sessions, p4)})`,
      )
    }
    const tot = CH.reduce((s, ch) => s + get(weeks[0], ch).app_intent, 0)
    const p4tot = mean(weeks.slice(1, 5), (wk) => CH.reduce((s, ch) => s + get(wk, ch).app_intent, 0))
    console.log(`  NORTH STAR — app-intent sessions from search + answer + paid: ${tot}  (prior-4 mean ${p4tot.toFixed(1)}, ${pct(tot, p4tot)})`)
    const org4 = weeks.slice(0, 4).reduce((s, wk) => ({ n: s.n + get(wk, 'organic_search').sessions, a: s.a + get(wk, 'organic_search').app_intent }), { n: 0, a: 0 })
    console.log(`  organic 4-wk: ${org4.n} sessions -> ${org4.a} app intent (${rate(org4.a, org4.n)})`)
    if (ph.paid_landings_7d?.length) {
      const bySrc = new Map()
      for (const r of ph.paid_landings_7d) {
        const k = `${r.click_id}/${r.utm_campaign ?? '—'}`
        bySrc.set(k, (bySrc.get(k) || 0) + r.sessions)
      }
      console.log('  paid landings 7d by click-id/campaign: ' + [...bySrc].map(([k, v]) => `${k} ${v}`).join(', '))
    }
  }

  const ADS = path.join(REPO, 'ads', 'ad-grants-state.json')
  console.log('\n=== AD GRANTS (newest snapshot from ads/ad-grants-state.json) ===')
  if (!fs.existsSync(ADS)) {
    console.log('  no ads/ad-grants-state.json')
  } else {
    const ads = readJson(ADS)
    const s = (ads.snapshots || []).slice(-1)[0]
    if (!s) console.log('  no snapshots yet')
    else {
      console.log(`  as of ${s.date}  window ${s.window}  (source: ${s.source})`)
      console.log(`  impressions ${s.impressions}  clicks ${s.clicks}  CTR ${s.ctr_pct}%  cost $${s.cost}  conversions ${s.conversions}`)
      for (const [name, c] of Object.entries(s.by_campaign || {}))
        console.log(`    ${name.padEnd(34)} impr ${String(c.impressions).padStart(5)}  clicks ${String(c.clicks).padStart(4)}`)
      if (s.verdict) console.log(`  verdict: ${s.verdict}`)
      if (s.search_terms?.length) {
        console.log('  top paid search terms (keyword research for organic):')
        for (const t of s.search_terms.slice(0, 15))
          console.log(`    ${String(t.impressions).padStart(5)} impr  ${String(t.clicks).padStart(3)} clk  ${t.term}`)
      } else console.log('  no search_terms in the snapshot yet (ad-grants-review records them from 2026-09-30)')
      const open = (ads.open_items || []).filter((o) => !/^done|shipped/i.test(o.status || ''))
      if (open.length) console.log(`  open Ad Grants items: ${open.map((o) => o.id).join(', ')}`)
    }
  }
}

/* ── Unmatched queries ────────────────────────────────────────────────────── */
if (want('queries')) {
  for (const [label, j] of [['WEEK ' + latest.end, latest.j], ...monthlyIfAny()]) {
    const r = replay(j)
    console.log(`\n=== UNMATCHED QUERIES — ${label} ===`)
    console.log('  (recurring entries here are portfolio candidates for the monthly deep-dive)')
    for (const q of r.unmatched.sort((a, b) => b.impressions - a.impressions).slice(0, 25))
      console.log(`  ${String(q.impressions).padStart(4)} impr  pos ${String((q.position || 0).toFixed(1)).padStart(5)}  ${q.query}`)
  }
}
