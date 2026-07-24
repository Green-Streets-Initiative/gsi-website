/**
 * One-time script to geocode Carnaval businesses from the ESMS CSV.
 * Uses Google Geocoding API via GOOGLE_PLACES_API_KEY from .env.local.
 *
 * Usage: node scripts/geocode-carnaval-businesses.mjs
 * Output: scripts/carnaval-businesses-geocoded.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
const envPath = resolve(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const envVars = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
}

const API_KEY = envVars.GOOGLE_PLACES_API_KEY
if (!API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY not found in .env.local')
  process.exit(1)
}

// Parse CSV
const csvPath = resolve(__dirname, '..', '..', 'Downloads', 'Carnaval Map Business List - Sheet1.csv')
const csvContent = readFileSync(csvPath, 'utf8')
const lines = csvContent.split('\n').slice(1).filter(l => l.trim())

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += line[i]
    }
  }
  result.push(current.trim())
  return result
}

const businesses = lines.map(line => {
  const [name, category, about, address] = parseCSVLine(line)
  return { name, category, about, address: address || null }
})

// Special case: Touched by a Rose has no address in CSV
const touchedByRose = businesses.find(b => b.name === 'Touched by a Rose')
if (touchedByRose && !touchedByRose.address) {
  touchedByRose.address = '4 Lincoln St'
}

console.log(`Parsed ${businesses.length} businesses from CSV`)

// Geocode using Google Geocoding API
async function geocode(address, businessName) {
  const query = `${address}, Somerville, MA`
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status === 'OK' && data.results.length > 0) {
    const loc = data.results[0].geometry.location
    return { lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address }
  }

  // Fallback: try with business name
  const fallbackUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${businessName}, Somerville, MA`)}&key=${API_KEY}`
  const fallbackRes = await fetch(fallbackUrl)
  const fallbackData = await fallbackRes.json()

  if (fallbackData.status === 'OK' && fallbackData.results.length > 0) {
    const loc = fallbackData.results[0].geometry.location
    return { lat: loc.lat, lng: loc.lng, formatted: fallbackData.results[0].formatted_address }
  }

  return null
}

// Search for Google Place ID using Text Search
async function findPlaceId(businessName, address) {
  const query = address
    ? `${businessName} ${address} Somerville MA`
    : `${businessName} Somerville MA`
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address,geometry&key=${API_KEY}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status === 'OK' && data.candidates?.length > 0) {
    const candidate = data.candidates[0]
    return {
      place_id: candidate.place_id,
      lat: candidate.geometry?.location?.lat,
      lng: candidate.geometry?.location?.lng,
    }
  }
  return null
}

async function main() {
  const results = []
  let geocoded = 0
  let failed = 0

  for (const biz of businesses) {
    console.log(`Geocoding: ${biz.name} (${biz.address || 'no address'})...`)

    // Try Place ID search first (more accurate for businesses)
    const place = await findPlaceId(biz.name, biz.address)

    let lat, lng, placeId = null

    if (place?.lat && place?.lng) {
      lat = place.lat
      lng = place.lng
      placeId = place.place_id
      geocoded++
    } else if (biz.address) {
      // Fallback to geocoding
      const geo = await geocode(biz.address, biz.name)
      if (geo) {
        lat = geo.lat
        lng = geo.lng
        geocoded++
      } else {
        console.warn(`  FAILED: ${biz.name}`)
        failed++
        continue
      }
    } else {
      console.warn(`  FAILED (no address): ${biz.name}`)
      failed++
      continue
    }

    results.push({
      name: biz.name,
      category: biz.category,
      description: biz.about || null,
      address: biz.address,
      lat: Math.round(lat * 10000000) / 10000000,
      lng: Math.round(lng * 10000000) / 10000000,
      google_place_id: placeId,
    })

    // Rate limit: 50 requests/second for Geocoding API
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nDone! Geocoded: ${geocoded}, Failed: ${failed}`)

  const outPath = resolve(__dirname, 'carnaval-businesses-geocoded.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`Written to: ${outPath}`)
}

main().catch(console.error)
