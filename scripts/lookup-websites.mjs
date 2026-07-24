#!/usr/bin/env node
/**
 * Batch-lookup website URLs for Carnaval businesses using Google Places API.
 * - Businesses with a google_place_id: use Place Details directly
 * - Businesses without: use Find Place from Text, then Place Details
 *
 * Outputs JSON with { id, name, website_url, google_place_id } for each match.
 */

import { readFileSync } from 'fs'
import { writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env.local manually
const envContent = readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
if (!API_KEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1) }

// Parse businesses from static file
const src = readFileSync(path.resolve(__dirname, '../src/lib/wayfinding/static-carnaval.ts'), 'utf8')

// Extract business objects — they're on single lines like { id: 'b1', ... }
const bizRegex = /\{\s*id:\s*'([^']+)'.*?name:\s*"([^"]+)".*?address:\s*'([^']*)'.*?website_url:\s*(null|'[^']*').*?google_place_id:\s*(null|'[^']*')/g

const businesses = []
let m
while ((m = bizRegex.exec(src)) !== null) {
  const websiteRaw = m[4]
  const placeIdRaw = m[5]
  businesses.push({
    id: m[1],
    name: m[2],
    address: m[3],
    website_url: websiteRaw === 'null' ? null : websiteRaw.slice(1, -1),
    google_place_id: placeIdRaw === 'null' ? null : placeIdRaw.slice(1, -1),
  })
}

console.log(`Found ${businesses.length} total businesses`)
const needsWebsite = businesses.filter(b => !b.website_url)
console.log(`${needsWebsite.length} need website lookup`)

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getPlaceDetails(placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=websiteUri&key=${API_KEY}`
  const res = await fetch(url, { headers: { 'X-Goog-FieldMask': 'websiteUri' } })
  if (!res.ok) return null
  const data = await res.json()
  return data.websiteUri || null
}

async function findPlace(name, address) {
  const query = `${name} ${address} Somerville MA`
  const url = `https://places.googleapis.com/v1/places:searchText`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.websiteUri,places.displayName',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  })
  if (!res.ok) {
    console.error(`  Search failed for "${name}": ${res.status}`)
    return { placeId: null, website: null }
  }
  const data = await res.json()
  if (!data.places || data.places.length === 0) return { placeId: null, website: null }
  const place = data.places[0]
  return {
    placeId: place.id || null,
    website: place.websiteUri || null,
  }
}

const results = []
let found = 0

for (const biz of needsWebsite) {
  process.stdout.write(`Looking up: ${biz.name}...`)

  if (biz.google_place_id) {
    // Direct place details lookup
    const website = await getPlaceDetails(biz.google_place_id)
    if (website) {
      found++
      console.log(` ✓ ${website}`)
      results.push({ id: biz.id, name: biz.name, website_url: website, google_place_id: biz.google_place_id })
    } else {
      console.log(' ✗ no website')
      results.push({ id: biz.id, name: biz.name, website_url: null, google_place_id: biz.google_place_id })
    }
  } else {
    // Search by name + address
    const { placeId, website } = await findPlace(biz.name, biz.address)
    if (website) {
      found++
      console.log(` ✓ ${website}`)
    } else {
      console.log(placeId ? ' ✗ no website' : ' ✗ not found')
    }
    results.push({
      id: biz.id,
      name: biz.name,
      website_url: website,
      google_place_id: placeId || biz.google_place_id,
    })
  }

  await sleep(100) // rate limit
}

console.log(`\nDone. Found websites for ${found}/${needsWebsite.length} businesses.`)

writeFileSync(
  path.resolve(__dirname, 'carnaval-websites.json'),
  JSON.stringify(results, null, 2)
)
console.log('Results saved to scripts/carnaval-websites.json')
