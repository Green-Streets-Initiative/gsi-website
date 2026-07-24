#!/usr/bin/env node
/**
 * Apply website URLs and new Place IDs from carnaval-websites.json
 * back into static-carnaval.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const staticPath = path.resolve(__dirname, '../src/lib/wayfinding/static-carnaval.ts')

const results = JSON.parse(readFileSync(path.resolve(__dirname, 'carnaval-websites.json'), 'utf8'))
let src = readFileSync(staticPath, 'utf8')

let websiteUpdates = 0
let placeIdUpdates = 0

for (const r of results) {
  // Clean up URLs - strip UTM params from Marilene's, normalize trailing slashes
  let url = r.website_url
  if (!url) continue

  // Strip UTM params
  try {
    const u = new URL(url)
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith('utm_')) u.searchParams.delete(key)
    }
    url = u.toString()
    // Remove trailing ? if params were stripped
    if (url.endsWith('?')) url = url.slice(0, -1)
  } catch {}

  // Skip Facebook profile links - not really a website
  if (url.includes('facebook.com/profile')) continue

  // Find this business line and update website_url from null
  const idPattern = `id: '${r.id}'`
  const idx = src.indexOf(idPattern)
  if (idx === -1) { console.log(`  ⚠ Could not find ${r.id} (${r.name})`); continue }

  // Get the line
  const lineStart = src.lastIndexOf('\n', idx) + 1
  const lineEnd = src.indexOf('\n', idx)
  const line = src.substring(lineStart, lineEnd)

  let newLine = line

  // Update website_url: null → website_url: 'https://...'
  if (line.includes("website_url: null")) {
    newLine = newLine.replace("website_url: null", `website_url: '${url}'`)
    websiteUpdates++
    console.log(`✓ ${r.name}: ${url}`)
  }

  // Also update google_place_id if it was null and we found one
  if (r.google_place_id && line.includes("google_place_id: null")) {
    newLine = newLine.replace("google_place_id: null", `google_place_id: '${r.google_place_id}'`)
    placeIdUpdates++
  }

  if (newLine !== line) {
    src = src.substring(0, lineStart) + newLine + src.substring(lineEnd)
  }
}

writeFileSync(staticPath, src)
console.log(`\nUpdated ${websiteUpdates} website URLs and ${placeIdUpdates} Place IDs`)
