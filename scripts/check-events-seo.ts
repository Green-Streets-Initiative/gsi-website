/**
 * Prints the title, description and Event JSON-LD the /events/[id] page would
 * emit for a set of real rows. Run after touching src/lib/events-seo.ts:
 *
 *   npx tsx scripts/check-events-seo.ts <rows.json> [--json]
 *
 * <rows.json> is an array of event rows shaped like CommunityEvent plus an
 * optional `timezone`, and an optional `recurring` boolean to preview the
 * repeating-event wording.
 */
import { readFileSync } from 'node:fs'
import type { CommunityEvent } from '../src/lib/events'
import { buildEventTitle, buildEventDescription, buildEventJsonLd } from '../src/lib/events-seo'

const [, , file, ...flags] = process.argv
if (!file) {
  console.error('usage: npx tsx scripts/check-events-seo.ts <rows.json> [--json]')
  process.exit(1)
}

const rows = JSON.parse(readFileSync(file, 'utf8')) as (CommunityEvent & {
  timezone?: string | null
  recurring?: boolean
})[]

for (const row of rows) {
  const recurring = row.recurring ?? false
  console.log('─'.repeat(78))
  console.log('address :', row.location_address ?? '(none)')
  console.log('title   :', buildEventTitle(row, recurring))
  console.log('recurring:', buildEventTitle(row, true))
  console.log('desc    :', buildEventDescription(row, recurring))
  if (flags.includes('--json')) {
    console.log(JSON.stringify(buildEventJsonLd(row, { timeZone: row.timezone }), null, 2))
  } else {
    const ld = buildEventJsonLd(row, { timeZone: row.timezone })
    console.log('start   :', ld.startDate, '  end:', ld.endDate ?? '(none)')
    console.log('free    :', 'isAccessibleForFree' in ld ? ld.isAccessibleForFree : '(unstated)')
  }
}
