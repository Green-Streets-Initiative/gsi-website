#!/usr/bin/env node
/**
 * The one way to change src/lib/venue-facts.json (the prices, rules and event
 * trains on the /parking/<venue> pages). The weekly venue-parking-prices
 * routine calls it so it never edits files by hand; it checks the file after
 * every change and refuses anything that would break the pages.
 *
 *   node scripts/venues/facts.mjs show
 *   node scripts/venues/facts.mjs stale                      venues not confirmed in 45 days
 *   node scripts/venues/facts.mjs confirm <venue>            everything checked out today
 *   node scripts/venues/facts.mjs set <venue> <path> <text>  e.g. prices.1.amount '$75'
 *                                                            or notes.Stadium-side lots 'Prepaid only · $60'
 *   node scripts/venues/facts.mjs add-train <date> <event> <times> <onSale>
 *   node scripts/venues/facts.mjs drop-past-trains
 *   node scripts/venues/facts.mjs add-venue <venue> <file.json>  a new venue's block (with its base in src/lib/venues.ts)
 *   node scripts/venues/facts.mjs check-pdf <venue> <outdir> PDF sources too large for WebFetch (see below)
 *   node scripts/venues/facts.mjs pin-pdf <venue>            after reading a changed PDF and updating the page
 *
 * A source with a `pdf` block (White Stadium's signed transportation agreement,
 * 14 MB on Google Drive) is checked by fingerprint, not by reading it: check-pdf
 * downloads it, compares its SHA-256 with the copy last read (`pdf.sha256`), and
 * checks the page in `pdf.linkedFrom` still links it. SAME means the signed
 * document is byte for byte the one already confirmed. CHANGED writes its text
 * (pdftotext) to <outdir> so the lines can be read there; once they are checked
 * and the page updated, pin-pdf records the new fingerprint.
 *
 * A venue with no fan parking (White Stadium) uses `prices` for its three
 * answer tiles and adds `notice` (where the team plays now, with its source)
 * and `pending` (what the City or the team hasn't decided yet).
 *
 * `set` changes an existing text only (a typo in the path is an error, not a
 * new field). Dates are YYYY-MM-DD in Boston time.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FILE = fileURLToPath(new URL('../../src/lib/venue-facts.json', import.meta.url))
const STALE_DAYS = 45
const ISO = /^\d{4}-\d{2}-\d{2}$/
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const die = (msg) => {
  console.error(`facts: ${msg}`)
  process.exit(1)
}
const load = () => JSON.parse(readFileSync(FILE, 'utf8'))
const venueOf = (facts, slug) => facts[slug] ?? die(`no venue "${slug}" (have: ${venues(facts).join(', ')})`)
const venues = (facts) => Object.keys(facts).filter((k) => !k.startsWith('_'))

function check(facts) {
  for (const slug of venues(facts)) {
    const v = facts[slug]
    const where = (f) => `${slug}.${f}`
    if (!ISO.test(v.checked ?? '')) die(`${where('checked')} must be YYYY-MM-DD`)
    if (!Array.isArray(v.prices) || v.prices.length === 0 || v.prices.length > 3) die(`${where('prices')} needs 1 to 3 entries`)
    for (const p of v.prices) if (!p.label || !p.amount) die(`${where('prices')}: every price needs a label and an amount`)
    for (const t of v.trains?.trips ?? []) {
      if (!ISO.test(t.date) || !ISO.test(t.onSale) || !t.event || !t.times) die(`${where('trains.trips')}: bad trip ${JSON.stringify(t)}`)
    }
    if (!Array.isArray(v.verify) || v.verify.length === 0) die(`${where('verify')} needs at least one source`)
    for (const s of v.verify) if (!/^https:\/\//.test(s.url ?? '') || !Array.isArray(s.confirm) || !s.confirm.length) die(`${where('verify')}: every source needs an https url and lines to confirm`)
    for (const s of v.verify) if (s.pdf && (!/^[0-9a-f]{64}$/.test(s.pdf.sha256 ?? '') || !ISO.test(s.pdf.pinned ?? '') || (s.pdf.linkedFrom && !/^https:\/\//.test(s.pdf.linkedFrom)))) die(`${where('verify')}: a pdf block needs sha256, pinned (YYYY-MM-DD) and an https linkedFrom if any`)
    if (v.notice && (!v.notice.text || !/^https:\/\//.test(v.notice.source?.url ?? '') || !v.notice.source?.label)) die(`${where('notice')} needs text and a source with a label and url`)
    if (v.pending && (!Array.isArray(v.pending) || v.pending.some((p) => typeof p !== 'string' || !p))) die(`${where('pending')} must be a list of texts`)
  }
}

function save(facts) {
  check(facts)
  writeFileSync(FILE, `${JSON.stringify(facts, null, 2)}\n`)
}

const [cmd, ...args] = process.argv.slice(2)
const facts = load()
check(facts)

if (cmd === 'show' || !cmd) {
  for (const slug of venues(facts)) {
    const v = facts[slug]
    console.log(`\n${slug} (confirmed ${v.checked})`)
    for (const s of v.verify) {
      console.log(`  ${s.url}${s.pdf ? `  [large PDF: check with check-pdf ${slug}, not WebFetch]` : ''}`)
      for (const c of s.confirm) console.log(`    - ${c}`)
      if (s.season) console.log(`    season: ${s.season}`)
    }
  }
} else if (cmd === 'stale') {
  const now = Date.parse(today())
  const old = venues(facts).filter((s) => (now - Date.parse(facts[s].checked)) / 86_400_000 > STALE_DAYS)
  console.log(old.length ? old.join('\n') : 'none')
} else if (cmd === 'confirm') {
  venueOf(facts, args[0]).checked = today()
  save(facts)
  console.log(`${args[0]} confirmed ${today()}`)
} else if (cmd === 'set') {
  const [slug, path, ...rest] = args
  const text = rest.join(' ')
  if (!path || !text) die('usage: set <venue> <path> <text>')
  // The path splits on dots, except a notes key (a garage name) is everything after "notes.".
  const keys = path.startsWith('notes.') ? ['notes', path.slice(6)] : path.split('.')
  let node = venueOf(facts, slug)
  for (const k of keys.slice(0, -1)) node = node?.[k] ?? die(`no "${path}" in ${slug}`)
  const last = keys.at(-1)
  if (typeof node?.[last] !== 'string') die(`no text at "${path}" in ${slug} (set changes existing texts only)`)
  const before = node[last]
  node[last] = text
  save(facts)
  console.log(`${slug}.${path}: "${before}" -> "${text}"`)
} else if (cmd === 'add-train') {
  const [date, event, times, onSale] = args
  const trains = venueOf(facts, 'gillette-stadium').trains ?? die('gillette-stadium has no trains block')
  if (trains.trips.some((t) => t.date === date)) die(`a train on ${date} is already listed`)
  trains.trips.push({ date, event, times, onSale })
  trains.trips.sort((a, b) => a.date.localeCompare(b.date))
  save(facts)
  console.log(`added ${date} ${event}`)
} else if (cmd === 'drop-past-trains') {
  const trains = venueOf(facts, 'gillette-stadium').trains
  const before = trains.trips.length
  trains.trips = trains.trips.filter((t) => t.date >= today())
  save(facts)
  console.log(`dropped ${before - trains.trips.length}`)
} else if (cmd === 'add-venue') {
  const [slug, file] = args
  if (!/^[a-z0-9-]+$/.test(slug ?? '') || !file) die('usage: add-venue <venue> <file.json>')
  if (facts[slug]) die(`"${slug}" is already listed; change it with set or confirm`)
  facts[slug] = JSON.parse(readFileSync(file, 'utf8'))
  save(facts)
  console.log(`added ${slug} (confirmed ${facts[slug].checked})`)
} else if (cmd === 'check-pdf' || cmd === 'pin-pdf') {
  const [slug, outdir] = args
  if (!slug || (cmd === 'check-pdf' && !outdir)) die(`usage: ${cmd} <venue>${cmd === 'check-pdf' ? ' <outdir>' : ''}`)
  const sources = venueOf(facts, slug).verify.filter((s) => s.pdf)
  if (!sources.length) die(`${slug} has no pdf sources`)
  for (const s of sources) {
    const { bytes, sha256 } = await downloadPdf(s.url)
    if (cmd === 'pin-pdf') {
      console.log(`${s.url}: pinned ${sha256} (was ${s.pdf.sha256})`)
      s.pdf.sha256 = sha256
      s.pdf.pinned = today()
      continue
    }
    const linked = s.pdf.linkedFrom ? await linksTo(s.pdf.linkedFrom, s.url) : true
    if (!linked) console.log(`NOT LINKED: ${s.pdf.linkedFrom} no longer links ${s.url}. Look there for a new or amended version; don't confirm ${slug} this week.`)
    if (sha256 === s.pdf.sha256) {
      console.log(`SAME: ${s.url} is byte for byte the copy read on ${s.pdf.pinned}.${linked ? ' Its lines are confirmed.' : ''}`)
      continue
    }
    const { mkdirSync } = await import('node:fs')
    const { execFileSync } = await import('node:child_process')
    const { join } = await import('node:path')
    mkdirSync(outdir, { recursive: true })
    const base = join(outdir, `${slug}-${sources.indexOf(s) + 1}`)
    writeFileSync(`${base}.pdf`, bytes)
    try {
      execFileSync('pdftotext', ['-layout', `${base}.pdf`, `${base}.txt`])
      console.log(`CHANGED: ${s.url} differs from the copy read on ${s.pdf.pinned}. Its text is in ${base}.txt: read it (Read tool, search for each line) and check every line to confirm. When the page is right, run pin-pdf ${slug}.`)
    } catch {
      console.log(`CHANGED: ${s.url} differs from the copy read on ${s.pdf.pinned}, and pdftotext couldn't turn it into text (the PDF is at ${base}.pdf). Don't confirm ${slug} this week; put it in the email.`)
    }
  }
  if (cmd === 'pin-pdf') save(facts)
} else {
  die(`unknown command "${cmd}"`)
}

// Google Drive "view" links serve a web page; the uc?export=download form serves the file.
async function downloadPdf(url) {
  const id = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)?.[1]
  const res = await fetch(id ? `https://drive.google.com/uc?export=download&id=${id}` : url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) die(`${url}: download failed (${res.status})`)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.subarray(0, 5).toString() !== '%PDF-') die(`${url}: got a web page, not the PDF (the file may have been moved or made private)`)
  const { createHash } = await import('node:crypto')
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') }
}

async function linksTo(page, url) {
  const res = await fetch(page, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) die(`${page}: couldn't read it (${res.status})`)
  const html = await res.text()
  const id = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)?.[1]
  return html.includes(id ?? url)
}
