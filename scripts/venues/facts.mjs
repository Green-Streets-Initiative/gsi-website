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
 *
 * `set` changes an existing text only (a typo in the path is an error, not a
 * new field). Dates are YYYY-MM-DD in Boston time.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FILE = fileURLToPath(new URL('../../src/lib/venue-facts.json', import.meta.url))
const STALE_DAYS = 45
const ISO = /^\d{4}-\d{2}-\d{2}$/

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
      console.log(`  ${s.url}`)
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
} else {
  die(`unknown command "${cmd}"`)
}
