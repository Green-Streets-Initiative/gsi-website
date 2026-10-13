#!/usr/bin/env node
// Builds the one-page "How to pay for the T" cheat sheet PDF.
//
//   node scripts/t-cheat-sheet/build.mjs          English  -> public/downloads/t-cheat-sheet.pdf
//   node scripts/t-cheat-sheet/build.mjs es       Spanish  -> public/downloads/t-cheat-sheet-es.pdf
//   node scripts/t-cheat-sheet/build.mjs all      every strings/<lang>.json
//
// Reads t-cheat-sheet.html (layout) and strings/<lang>.json (every word), fills
// in {{t:...}} from the strings, {{price:...}} from src/lib/facts/prices.json
// (the same facts the guide uses), {{calc:...}} from those prices, and
// {{icon:...}} from Phosphor's regular SVGs, prints it with the local Google
// Chrome through playwright-core as a tagged (screen-reader friendly) PDF.
// Fails if the result is not exactly one page or a token is left over.
//
// Rerun every language after prices.json changes (the monthly freshness check),
// and bump CHECKED when the sheet's facts are re-checked against mbta.com.
// Each strings file spells the month itself (meta.months + meta.checked), so
// no language depends on what Node's Intl happens to know (Haitian Creole).

import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const CHECKED = { year: 2026, month: 10 }

// Fares the guide does not carry, from mbta.com on 2026-10-13. Update by hand.
const REDUCED = { subway: 1.1, bus: 0.85, month: 30 } // mbta.com/fares/reduced
const FERRY = { min: 2.4, max: 9.75 } // mbta.com/fares

const lang = process.argv[2] ?? 'en'

const here = dirname(fileURLToPath(import.meta.url))

if (lang === 'all') {
  for (const f of readdirSync(resolve(here, 'strings')).filter((f) => f.endsWith('.json')).sort()) {
    execFileSync(process.execPath, [fileURLToPath(import.meta.url), f.replace(/\.json$/, '')], { stdio: 'inherit' })
  }
  process.exit(0)
}

const repoRoot = resolve(here, '../..')
const templatePath = resolve(here, 't-cheat-sheet.html')
const stringsPath = resolve(here, 'strings', `${lang}.json`)
if (!existsSync(stringsPath)) throw new Error(`No strings for "${lang}" at ${stringsPath}`)
const strings = JSON.parse(readFileSync(stringsPath, 'utf8'))
const outPath = resolve(repoRoot, `public/downloads/t-cheat-sheet${lang === 'en' ? '' : `-${lang}`}.pdf`)
const iconDir = resolve(repoRoot, 'node_modules/@phosphor-icons/core/assets/regular')

const prices = JSON.parse(readFileSync(resolve(repoRoot, 'src/lib/facts/prices.json'), 'utf8'))
const m = prices.mbta

// Same format rule as scripts/build-micro-guides-migration.mjs:
// integers bare ($90), cents otherwise ($2.40); |cents forces two decimals.
const money = (v, forceCents = false) =>
  !forceCents && Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`
const cents = (v) => Math.round(v * 100) / 100

// Fewest rides at which a pass costs less than paying per ride.
const breakEven = (pass, perRide) => Math.floor(pass / perRide) + 1

const subwayRT = cents(m.subwaySingle * 2)
const busRT = cents(m.busSingle * 2)
const dayRides = breakEven(m.dayPass, m.subwaySingle)
const weekTrips = breakEven(m.weekPass, subwayRT)
const linkDays = breakEven(m.linkPassMonthly, subwayRT)
const busTrips = breakEven(m.busPassMonthly, busRT)

const calc = {
  busToSubway: money(cents(m.subwaySingle - m.busSingle), true),
  subwayRoundTrip: money(subwayRT, true),
  busRoundTrip: money(busRT, true),
  dayRides: String(dayRides),
  dayRidesCost: money(cents(dayRides * m.subwaySingle), true),
  weekTrips: String(weekTrips),
  weekTripsCost: money(cents(weekTrips * subwayRT), true),
  linkDays: String(linkDays),
  linkDaysCost: money(cents(linkDays * subwayRT), true),
  busTrips: String(busTrips),
  busTripsCost: money(cents(busTrips * busRT), true),
}

// Every key in the English file must exist in a translation, so a missing
// string fails the build instead of printing a blank.
const en = JSON.parse(readFileSync(resolve(here, 'strings/en.json'), 'utf8'))
const missing = Object.keys(en).filter((k) => !k.startsWith('_') && !(k in strings))
if (missing.length) throw new Error(`strings/${lang}.json is missing: ${missing.join(', ')}`)

let html = readFileSync(templatePath, 'utf8')
html = html
  .replace(/\{\{t:([\w.-]+)\}\}/g, (_, k) => {
    if (!(k in strings)) throw new Error(`Unknown string "${k}"`)
    return strings[k]
  })
  // Weight follows the app's rule: regular for objects at this size, fill only
  // for state markers (check-circle). `{{icon:name:fill}}` picks the weight.
  .replace(/\{\{icon:([\w-]+)(?::(regular|bold|fill))?\}\}/g, (_, name, weight = 'regular') =>
    readFileSync(resolve(iconDir, '..', weight, `${name}${weight === 'regular' ? '' : `-${weight}`}.svg`), 'utf8')
      .trim()
      .replace('<svg ', '<svg class="i" aria-hidden="true" focusable="false" '),
  )
  .replace(/\{\{reduced\.(\w+)\}\}/g, (_, k) => money(REDUCED[k], k !== 'month'))
  .replace(/\{\{ferry\.(min|max)\}\}/g, (_, k) => money(FERRY[k], true))
  .replace(/\{\{price:([a-zA-Z.]+)(\|cents)?\}\}/g, (_, path, c) => {
    const v = path.split('.').reduce((o, k) => o?.[k], prices)
    if (typeof v !== 'number') throw new Error(`Unknown price fact "${path}"`)
    return money(v, !!c)
  })
  .replace(/\{\{calc:(\w+)\}\}/g, (_, k) => {
    if (!(k in calc)) throw new Error(`Unknown calc "${k}"`)
    return calc[k]
  })
  .replaceAll(
    '{{checked}}',
    strings['meta.checked']
      .replace('{month}', strings['meta.months'][CHECKED.month - 1])
      .replace('{year}', String(CHECKED.year)),
  )
if (/\{\{/.test(html)) throw new Error('Unresolved token left in the sheet')

// Written next to the template so its relative font and logo paths resolve.
const tmpHtml = resolve(here, `.t-cheat-sheet.${lang}.resolved.html`)
writeFileSync(tmpHtml, html)

const chromePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chromePath)) throw new Error(`Chrome not found at ${chromePath}; set CHROME_PATH`)

const browser = await chromium.launch({ executablePath: chromePath, headless: true })
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  // Translations run longer than English. Shrink the whole sheet in small
  // steps until it fits one page, but never below MIN_SCALE (about 10pt body
  // text): past that, shorten the strings instead.
  const MIN_SCALE = 0.9
  const countPages = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  let pdf
  let scale = 1
  for (;;) {
    await page.evaluate((z) => document.documentElement.style.setProperty('--z', String(z)), scale)
    pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true })
    if (countPages(pdf) === 1) break
    if (scale - 0.02 < MIN_SCALE - 1e-9) {
      throw new Error(`Sheet is ${countPages(pdf)} pages at ${MIN_SCALE} scale; shorten strings/${lang}.json`)
    }
    scale = Math.round((scale - 0.02) * 100) / 100
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, pdf)
  console.log(`Wrote ${outPath} (1 page, scale ${scale}, ${(pdf.length / 1024).toFixed(0)} KB)`)
} finally {
  await browser.close()
  unlinkSync(tmpHtml)
}
