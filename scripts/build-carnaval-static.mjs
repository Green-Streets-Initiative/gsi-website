/**
 * Build the CARNAVAL_BUSINESSES array for static-carnaval.ts
 * Merges geocoded CSV data with existing seed data (for place_id preservation).
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const geocoded = JSON.parse(readFileSync(resolve(__dirname, 'carnaval-businesses-geocoded.json'), 'utf8'))

// Existing seed data with google_place_ids we want to preserve
const existingPlaceIds = {
  'Montecristo\'s': 'ChIJVVr8e9pw44kR5ycgfoFBlhU',
  'Gauchão Brazilian Cuisine': 'ChIJEalB9tpw44kRIR4EqysYXB8',
  'Rincón Mexicano': 'ChIJYbgbVNpw44kRFV41qqw3mPw',
  'Vinny\'s Ristorante': 'ChIJ4RxWD9tw44kRfnBBHjLukwo',
  'Taco Loco': 'ChIJtbLSfNtw44kR25KofPDZl3M',
  'Lotus Xpress': 'ChIJz2le8vh244kREBSYnYwT1Kk',
  'Casey\'s': 'ChIJIWIKl9Bw44kRqrcJvGf4L-w',
  'Maya Sol': 'ChIJ5dyPltBw44kRfHg2YgGDaHQ',
  'Pastelaria Vitória': 'ChIJ1WFe6dBw44kRJUBchSYYOwQ',
  'Mount Vernon Restaurant & Pub': 'ChIJ0feWktxw44kRMPIGmSD8rU0',
  'Tapatio': 'ChIJZWCrANtw44kRXWBHooFaO1k',
  'Rei Da Picanha': 'ChIJoa_wZtpw44kR3hcF6YMTo8o',
  'Ola Café': 'ChIJ8Z7uX9pw44kRHcApbk0KJWE',
  'Los Paisanos': 'ChIJ2cSvc9tw44kRUKnF29-Q3bo',
  'Oliveira\'s Steakhouse': 'ChIJO03Gtchw44kRaJm0taIIUvk',
  'Royal Pizza': 'ChIJdXDrUcRw44kR_RJR5kDwKUs',
  'Michael\'s Bar': 'ChIJE_7PW89w44kR-KWwQjrAJJw',
  'Sisters Caribbean': 'ChIJsRBOVdpw44kRaJlfIaYcIbM',
}

// Remove duplicate: Mount Vernon Pub is same as Mount Vernon Restaurant & Pub
const filtered = geocoded.filter(b => b.name !== 'Mount Vernon Pub')

// Generate entries
const entries = filtered.map((biz, i) => {
  const id = `b${i + 1}`
  const placeId = existingPlaceIds[biz.name] || null

  return {
    id,
    event_id: 'static-carnaval',
    name: biz.name,
    category: biz.category,
    description: biz.description || null,
    lat: biz.lat,
    lng: biz.lng,
    address: biz.address || null,
    website_url: null,
    google_place_id: placeId,
    show_on_map: true,
    is_shift_partner: false,
    pin_color: null,
  }
})

// Existing website URLs to preserve
const existingWebsites = {
  'Montecristo\'s': 'https://montecristorestaurantsomerville.com',
  'Rincón Mexicano': 'https://www.rinconmexicanosomerville.com',
  'Vinny\'s Ristorante': 'https://www.vinnysatnight.com/',
  'Lotus Xpress': 'https://www.lotusxpress.com',
  'Casey\'s': 'https://www.caseyssomerville.com',
  'Maya Sol': 'https://www.mayasolmexicangrill.com',
  'Mount Vernon Restaurant & Pub': 'https://www.mtvernonsomerville.com',
  'Ola Café': 'https://www.olacafesomerville.com',
}

entries.forEach(e => {
  if (existingWebsites[e.name]) {
    e.website_url = existingWebsites[e.name]
  }
})

// Output as TypeScript
let ts = `export const CARNAVAL_BUSINESSES: WayfindingBusiness[] = [\n`
for (const e of entries) {
  const desc = e.description ? JSON.stringify(e.description) : 'null'
  const addr = e.address ? `'${e.address.replace(/'/g, "\\'")}'` : 'null'
  const web = e.website_url ? `'${e.website_url}'` : 'null'
  const pid = e.google_place_id ? `'${e.google_place_id}'` : 'null'
  ts += `  { id: '${e.id}', event_id: '${e.event_id}', name: ${JSON.stringify(e.name)}, category: '${e.category}', description: ${desc}, lat: ${e.lat}, lng: ${e.lng}, address: ${addr}, website_url: ${web}, google_place_id: ${pid}, show_on_map: true, is_shift_partner: false, pin_color: null },\n`
}
ts += `]\n`

writeFileSync(resolve(__dirname, 'carnaval-businesses-static.ts'), ts)
console.log(`Generated ${entries.length} business entries`)
console.log(`With place_ids: ${entries.filter(e => e.google_place_id).length}`)
console.log(`With websites: ${entries.filter(e => e.website_url).length}`)
