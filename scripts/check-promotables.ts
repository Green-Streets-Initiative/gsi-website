/*
 * Table tests for the campaign resolver. No database, no clock mocking — the
 * ranking functions take `now` as a parameter precisely so this is possible.
 *
 *   npx tsx scripts/check-promotables.ts
 */
import { bucket, collapseSeries, phaseOf, pickNavPromo } from '../src/lib/campaigns/rank'
import { navPromoLabel } from '../src/lib/campaigns/format'
import { lastFridayET } from '../src/lib/campaigns/walk-ride-series'
import type { Promotable } from '../src/lib/campaigns/types'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) return console.log(`  ok   ${name}`)
  failures++
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`)
}

function make(id: string, startsAt: string, endsAt: string, extra: Partial<Promotable> = {}): Promotable {
  return {
    id, kind: 'flagship', source: 'db', title: id, icon: 'flag', shortTitle: id, blurb: null,
    startsAt, endsAt, windowKind: 'event', singleDay: false, phase: 'upcoming',
    href: null, secondaryHref: null, secondaryLabel: null,
    event: { sponsorName: null, sponsorLogoUrl: null, seriesKey: null, seriesNextDates: [] },
    mechanic: null, ...extra,
  }
}

console.log('\nending-soonest wins (the rule ported from CampaignHomeCard)')
{
  // A two-month campaign overlapping a one-day Walk/Ride Day.
  const summer = make('summer', '2026-08-01T04:00:00Z', '2026-10-16T03:59:59Z')
  const wrd = make('wrd', '2026-09-25T04:00:00Z', '2026-09-26T03:59:59Z', { singleDay: true })
  const items = [summer, wrd]
  const pick = (iso: string) => pickNavPromo(items, new Date(iso))?.id ?? null
  check('day before → the long campaign', pick('2026-09-24T14:00:00Z'), 'summer')
  check('the day itself → Walk/Ride Day', pick('2026-09-25T14:00:00Z'), 'wrd')
  check('day after → back to the campaign', pick('2026-09-27T14:00:00Z'), 'summer')
}

console.log('\nphases')
{
  const p = { startsAt: '2026-09-25T04:00:00Z', endsAt: '2026-09-26T03:59:59Z' }
  check('before', phaseOf(p, new Date('2026-09-01T12:00:00Z')), 'upcoming')
  check('during', phaseOf(p, new Date('2026-09-25T18:00:00Z')), 'active')
  check('after', phaseOf(p, new Date('2026-10-01T12:00:00Z')), 'wrapped')
}

console.log('\nsilence beats stale')
{
  check('nothing at all → no nav item', pickNavPromo([], new Date('2026-09-14T12:00:00Z')), null)
  // Shift Your Summer ended 2026-08-15; on 09-14 the nav must stay empty.
  const ended = make('summer', '2026-06-15T04:00:00Z', '2026-08-16T03:59:59Z')
  check('only a finished campaign → no nav item', pickNavPromo([ended], new Date('2026-09-14T12:00:00Z')), null)
  const far = make('far', '2026-12-01T05:00:00Z', '2026-12-02T04:59:59Z')
  check('beyond the 14-day horizon → no nav item', pickNavPromo([far], new Date('2026-09-14T12:00:00Z')), null)
}

console.log('\nseries collapsing')
{
  const mk = (d: string) => make(`wrd-${d}`, `${d}T04:00:00Z`, `${d}T23:59:59Z`, {
    singleDay: true,
    event: { sponsorName: null, sponsorLogoUrl: null, seriesKey: 'walk-ride-day', seriesNextDates: [] },
  })
  const out = collapseSeries([mk('2026-09-25'), mk('2026-10-30'), mk('2026-11-27')])
  check('three occurrences become one', out.length, 1)
  check('later dates move to the footnote', out[0].event!.seriesNextDates.length, 2)
}

console.log('\nlabels use the start date, in Eastern')
{
  // ends_at is 03:59:59Z on the 26th — i.e. 23:59:59 ET on Friday the 25th.
  // A label derived from it would read "Sep 26", a Saturday.
  const wrd = make('Walk/Ride Day', '2026-09-25T04:00:00Z', '2026-09-26T03:59:59Z', {
    singleDay: true, shortTitle: 'Walk/Ride Day',
  })
  check('upcoming', navPromoLabel({ ...wrd, phase: 'upcoming' }, new Date('2026-09-14T12:00:00Z')), 'Walk/Ride Day · Sep 25')
  check('tomorrow', navPromoLabel({ ...wrd, phase: 'upcoming' }, new Date('2026-09-24T12:00:00Z')), 'Walk/Ride Day · tomorrow')
  check('on the day', navPromoLabel({ ...wrd, phase: 'active' }, new Date('2026-09-25T14:00:00Z')), 'Walk/Ride Day · today')
  const sem = make('Shift Your Semester', '2026-09-15T04:00:00Z', '2026-12-16T04:59:59Z', {
    shortTitle: 'Shift Your Semester', windowKind: 'signup', phase: 'active',
  })
  // "Shift Your Semester · through Dec 15" is 36 chars, over the cap.
  check('over-long label drops the suffix', navPromoLabel(sem, new Date('2026-10-01T12:00:00Z')), 'Shift Your Semester')
}

console.log('\nlast-Friday synthesis matches the hand-seeded dates')
{
  // The golden fixture: the twelve literal dates in migration 00110, which
  // were computed by hand and include the November DST flip.
  const seeded: [number, number, string][] = [
    [2026, 3, '2026-04-24'], [2026, 4, '2026-05-29'], [2026, 5, '2026-06-26'],
    [2026, 6, '2026-07-31'], [2026, 7, '2026-08-28'], [2026, 8, '2026-09-25'],
    [2026, 9, '2026-10-30'], [2026, 10, '2026-11-27'], [2026, 11, '2026-12-25'],
    [2027, 0, '2027-01-29'], [2027, 1, '2027-02-26'], [2027, 2, '2027-03-26'],
  ]
  for (const [y, m, want] of seeded) {
    const got = lastFridayET(y, m).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    check(want, got, want)
  }
}

console.log('\nbucket ordering')
{
  const a = make('a', '2026-09-01T04:00:00Z', '2026-09-30T03:59:59Z')
  const b = make('b', '2026-09-10T04:00:00Z', '2026-09-20T03:59:59Z')
  const r = bucket([a, b], new Date('2026-09-14T12:00:00Z'))
  check('active sorted by soonest end', r.active.map((x) => x.id), ['b', 'a'])
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
