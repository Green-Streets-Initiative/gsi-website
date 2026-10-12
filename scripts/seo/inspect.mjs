#!/usr/bin/env node
// Ad-hoc lookups the SEO routine used to do with grep/curl/sed, as one
// committed script so a single allow rule (`Bash(node scripts/seo/:*)`) covers
// them and an unattended run never stops on a permission prompt.
//
//   node scripts/seo/inspect.mjs queries <regex> [--file weekly-YYYY-MM-DD.json]
//   node scripts/seo/inspect.mjs pages <regex>   [--file ...]
//   node scripts/seo/inspect.mjs meta <path>          live title / description / canonical / JSON-LD types
//   node scripts/seo/inspect.mjs listed <text> [...]  is each string in sitemap.xml, llms.txt and /guides?
//
// <regex> is case-insensitive. Default file is the newest weekly GSC file
// containing site_totals.

import fs from 'node:fs'
import path from 'node:path'

const SITE = 'https://www.gogreenstreets.org'
const GSC_DIR = path.join(process.cwd(), 'seo/data/gsc')

const [cmd, ...rest] = process.argv.slice(2)
const fileFlag = rest.indexOf('--file')
const fileArg = fileFlag >= 0 ? rest[fileFlag + 1] : null
const args = fileFlag >= 0 ? rest.filter((_, i) => i !== fileFlag && i !== fileFlag + 1) : rest

function newestWeekly() {
  const files = fs
    .readdirSync(GSC_DIR)
    .filter((f) => /^weekly-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(GSC_DIR, f), 'utf8'))
    if (j.site_totals) return f
  }
  throw new Error('no weekly file with site_totals')
}

// Walk the whole file and collect every row carrying `key`; the same query can
// appear under a cluster and in a top list, so keep the row with the most
// impressions.
function collect(json, key) {
  const best = new Map()
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v && typeof v === 'object') {
      if (typeof v[key] === 'string' && typeof v.impressions === 'number') {
        const prev = best.get(v[key])
        if (!prev || v.impressions > prev.impressions) best.set(v[key], v)
      }
      Object.values(v).forEach(walk)
    }
  }
  walk(json)
  return [...best.values()]
}

function rows(key, pattern) {
  const file = fileArg ?? newestWeekly()
  const json = JSON.parse(fs.readFileSync(path.join(GSC_DIR, file), 'utf8'))
  const re = new RegExp(pattern ?? '.', 'i')
  const hits = collect(json, key)
    .filter((r) => re.test(r[key]))
    .sort((a, b) => b.impressions - a.impressions)
  console.log(`${file} — ${hits.length} ${key} rows matching /${pattern}/i`)
  let ti = 0
  let tc = 0
  for (const r of hits) {
    ti += r.impressions
    tc += r.clicks ?? 0
    const label = key === 'page' ? r.page.replace(SITE, '') || '/' : r.query
    console.log(
      `${String(r.impressions).padStart(6)} impr ${String(r.clicks ?? 0).padStart(4)} clk  pos ${(r.position ?? 0).toFixed(1).padStart(5)}  ${label}`,
    )
  }
  console.log(`total ${ti} impr, ${tc} clicks`)
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'gsi-seo-routine' } })
  return { status: res.status, text: await res.text() }
}

async function meta(p) {
  const url = p.startsWith('http') ? p : `${SITE}${p.startsWith('/') ? p : `/${p}`}`
  const { status, text } = await fetchText(url)
  const pick = (re) => (text.match(re) || [])[1] ?? '(none)'
  console.log(`${url}  ${status}`)
  console.log(`title:       ${pick(/<title>([^<]*)<\/title>/)}`)
  console.log(`description: ${pick(/<meta name="description" content="([^"]*)"/)}`)
  console.log(`canonical:   ${pick(/<link rel="canonical" href="([^"]*)"/)}`)
  const types = {}
  for (const m of text.matchAll(/"@type":"([A-Za-z]+)"/g)) types[m[1]] = (types[m[1]] ?? 0) + 1
  console.log(`json-ld:     ${Object.entries(types).map(([t, n]) => (n > 1 ? `${t}×${n}` : t)).join(', ') || '(none)'}`)
}

async function listed(needles) {
  const surfaces = ['/sitemap.xml', '/llms.txt', '/guides']
  const bodies = {}
  for (const s of surfaces) bodies[s] = (await fetchText(`${SITE}${s}`)).text
  for (const n of needles) {
    console.log(`${n}: ${surfaces.map((s) => `${s} ${bodies[s].includes(n) ? 'yes' : 'NO'}`).join('  ')}`)
  }
}

try {
  if (cmd === 'queries') rows('query', args[0])
  else if (cmd === 'pages') rows('page', args[0])
  else if (cmd === 'meta') await meta(args[0] ?? '/')
  else if (cmd === 'listed') await listed(args)
  else {
    console.error('usage: inspect.mjs queries|pages <regex> [--file f] | meta <path> | listed <text>...')
    process.exit(2)
  }
} catch (e) {
  console.error(`inspect failed: ${e.message}`)
  process.exit(1)
}
