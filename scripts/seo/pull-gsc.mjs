#!/usr/bin/env node
/**
 * Pull Google Search Console data for the SEO/AEO routine.
 *
 * Usage:
 *   node scripts/seo/pull-gsc.mjs --mode check      # verify auth + property
 *   node scripts/seo/pull-gsc.mjs --mode weekly     # 7-day window vs prior 7
 *   node scripts/seo/pull-gsc.mjs --mode monthly    # 28-day vs prior 28 + trend
 *   node scripts/seo/pull-gsc.mjs --mode backfill   # last 16 weekly files
 *
 * Auth: a Google service-account JSON key, kept OUTSIDE the repo. Path from
 * $GSC_KEY_FILE, default ~/.config/gsi-seo/gsc-service-account.json. The
 * service account must be added as a user on the Search Console property.
 *
 * Output: small JSON aggregates under seo/data/gsc/ (committed — git history is
 * the time series; the routine recomputes baselines from these files).
 *
 * Exits non-zero with a one-line reason on any auth/config failure so the
 * routine can email the blocker and stop.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { JWT } from 'google-auth-library'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DATA_DIR = path.join(REPO_ROOT, 'seo', 'data', 'gsc')
const CONFIG_PATH = path.join(REPO_ROOT, 'seo', 'gsc-config.json')
const PORTFOLIO_PATH = path.join(REPO_ROOT, 'seo', 'keyword-portfolio.json')
// Reuses the existing GSI service-account key (shift-plg@shift-490216), which
// is already a user on the gogreenstreets.org Search Console property. Override
// with $GSC_KEY_FILE to point at a different key.
const KEY_FILE =
  process.env.GSC_KEY_FILE || path.join(os.homedir(), '.config', 'gsc', 'shift-plg.json')

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const API = 'https://searchconsole.googleapis.com/webmasters/v3/sites'

function die(msg) {
  console.error(`GSC pull failed: ${msg}`)
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

// ---- dates (GSC data lags ~3 days; always use fully-settled days) ----
function isoDaysAgo(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
// A window of `len` days ending `endLag` days before today.
function window(endLag, len) {
  return { startDate: isoDaysAgo(endLag + len - 1), endDate: isoDaysAgo(endLag) }
}

function loadJson(p, label) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    die(`could not read ${label} at ${p} (${e.message})`)
  }
}

async function makeClient() {
  if (!fs.existsSync(KEY_FILE)) {
    die(`service-account key not found at ${KEY_FILE}. Run the GSC setup (see seo/methodology.md).`)
  }
  const key = loadJson(KEY_FILE, 'service-account key')
  if (!key.client_email || !key.private_key) die('key file is missing client_email/private_key')
  const client = new JWT({ email: key.client_email, key: key.private_key, scopes: [SCOPE] })
  try {
    await client.authorize()
  } catch (e) {
    die(`could not authenticate (${e.message})`)
  }
  return client
}

async function query(client, siteUrl, body) {
  const url = `${API}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const res = await client.request({ url, method: 'POST', data: body })
  return res.data.rows || []
}

// ---- aggregation ----
function compileClusters(portfolio) {
  return portfolio.clusters.map((c) => ({
    id: c.id,
    priority: c.priority,
    regexes: (c.gsc_patterns || []).map((p) => new RegExp(p, 'i')),
  }))
}

function bucket(rows, clusters) {
  const agg = new Map() // id -> {clicks, impressions, posWeighted, imprForPos, queries:[]}
  for (const c of clusters) agg.set(c.id, { clicks: 0, impressions: 0, posWeighted: 0, imprForPos: 0, queries: [] })
  const unmatched = []
  for (const row of rows) {
    const q = (row.keys?.[0] || '').toLowerCase()
    const hit = clusters.find((c) => c.regexes.some((re) => re.test(q)))
    const rec = { query: row.keys?.[0], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }
    if (hit) {
      const a = agg.get(hit.id)
      a.clicks += row.clicks
      a.impressions += row.impressions
      a.posWeighted += row.position * row.impressions
      a.imprForPos += row.impressions
      a.queries.push(rec)
    } else {
      unmatched.push(rec)
    }
  }
  const clusterOut = clusters.map((c) => {
    const a = agg.get(c.id)
    return {
      id: c.id,
      clicks: a.clicks,
      impressions: a.impressions,
      avg_position: a.imprForPos ? +(a.posWeighted / a.imprForPos).toFixed(1) : null,
      top_queries: a.queries.sort((x, y) => y.impressions - x.impressions).slice(0, 8),
    }
  })
  unmatched.sort((x, y) => y.impressions - x.impressions)
  return { clusterOut, unmatched }
}

function totals(rows) {
  let clicks = 0, impressions = 0, posW = 0
  for (const r of rows) { clicks += r.clicks; impressions += r.impressions; posW += r.position * r.impressions }
  return {
    clicks,
    impressions,
    ctr: impressions ? +(clicks / impressions).toFixed(4) : 0,
    position: impressions ? +(posW / impressions).toFixed(1) : null,
  }
}

function writeOut(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const p = path.join(DATA_DIR, name)
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
  console.log(`wrote ${path.relative(REPO_ROOT, p)}  (clicks ${data.totals?.clicks ?? '?'}, impressions ${data.totals?.impressions ?? '?'})`)
}

// ---- one weekly snapshot for a given end-lag ----
async function weeklySnapshot(client, siteUrl, clusters, endLag) {
  const cur = window(endLag, 7)
  const prior = window(endLag + 7, 7)
  const qCur = await query(client, siteUrl, { ...cur, dimensions: ['query'], rowLimit: 250 })
  const qPrior = await query(client, siteUrl, { ...prior, dimensions: ['query'], rowLimit: 250 })
  const pages = await query(client, siteUrl, { ...cur, dimensions: ['page'], rowLimit: 100 })
  const { clusterOut, unmatched } = bucket(qCur, clusters)
  const priorBucket = bucket(qPrior, clusters).clusterOut
  const priorById = new Map(priorBucket.map((c) => [c.id, c]))
  for (const c of clusterOut) {
    const p = priorById.get(c.id)
    c.prev_clicks = p ? p.clicks : 0
    c.prev_impressions = p ? p.impressions : 0
  }
  return {
    mode: 'weekly',
    range: cur,
    priorRange: prior,
    totals: totals(qCur),
    priorTotals: totals(qPrior),
    clusters: clusterOut,
    unmatched_top_queries: unmatched.slice(0, 30),
    top_pages: pages
      .map((r) => ({ page: r.keys?.[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 25),
  }
}

async function main() {
  const mode = arg('mode', 'weekly')
  const { siteUrl } = loadJson(CONFIG_PATH, 'gsc-config.json')
  if (!siteUrl) die('gsc-config.json has no siteUrl')
  const portfolio = loadJson(PORTFOLIO_PATH, 'keyword-portfolio.json')
  const clusters = compileClusters(portfolio)
  const client = await makeClient()

  if (mode === 'check') {
    const rows = await query(client, siteUrl, { ...window(3, 7), dimensions: ['query'], rowLimit: 5 })
    console.log(`OK: authenticated for ${siteUrl}. Sample rows returned: ${rows.length}.`)
    if (rows.length === 0) console.log('(0 rows can mean a brand-new property or a very quiet week — not necessarily an error.)')
    return
  }

  if (mode === 'weekly') {
    const snap = await weeklySnapshot(client, siteUrl, clusters, 3)
    writeOut(`weekly-${snap.range.endDate}.json`, snap)
    return
  }

  if (mode === 'backfill') {
    for (let k = 0; k < 16; k++) {
      const snap = await weeklySnapshot(client, siteUrl, clusters, 3 + 7 * k)
      writeOut(`weekly-${snap.range.endDate}.json`, snap)
    }
    return
  }

  if (mode === 'monthly') {
    const cur = window(3, 28)
    const prior = window(31, 28)
    const qCur = await query(client, siteUrl, { ...cur, dimensions: ['query'], rowLimit: 500 })
    const qPrior = await query(client, siteUrl, { ...prior, dimensions: ['query'], rowLimit: 500 })
    const pages = await query(client, siteUrl, { ...cur, dimensions: ['page'], rowLimit: 200 })
    const byDate = await query(client, siteUrl, { startDate: isoDaysAgo(368), endDate: isoDaysAgo(3), dimensions: ['date'], rowLimit: 400 })
    const byDevice = await query(client, siteUrl, { ...cur, dimensions: ['device'], rowLimit: 10 })
    const { clusterOut, unmatched } = bucket(qCur, clusters)
    const priorBucket = bucket(qPrior, clusters).clusterOut
    const priorById = new Map(priorBucket.map((c) => [c.id, c]))
    for (const c of clusterOut) {
      const p = priorById.get(c.id)
      c.prev_clicks = p ? p.clicks : 0
      c.prev_impressions = p ? p.impressions : 0
    }
    const ym = cur.endDate.slice(0, 7)
    writeOut(`monthly-${ym}.json`, {
      mode: 'monthly',
      range: cur,
      priorRange: prior,
      totals: totals(qCur),
      priorTotals: totals(qPrior),
      clusters: clusterOut,
      unmatched_top_queries: unmatched.slice(0, 50),
      top_pages: pages
        .map((r) => ({ page: r.keys?.[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 40),
      device_split: byDevice.map((r) => ({ device: r.keys?.[0], clicks: r.clicks, impressions: r.impressions })),
      daily_trend: byDate
        .map((r) => ({ date: r.keys?.[0], clicks: r.clicks, impressions: r.impressions }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    })
    return
  }

  die(`unknown --mode "${mode}" (use check | weekly | monthly | backfill)`)
}

main().catch((e) => die(e.message))
