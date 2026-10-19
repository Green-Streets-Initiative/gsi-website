// Same cases as the Shift app's lib/eventCalendar.test.ts. Run with:
//   node --test src/lib/event-calendar.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildIcs, calendarLink, calendarLocation, calendarNotes, gcalUrl } from './event-calendar.ts'

const base = {
  id: 'ce_sync_cambridge_bike_safety_a3831a426506',
  slug: 'streetwise-at-aeronaut-2026-10-21',
  title: 'Streetwise: Cafe Biking, the Build-Out of Social Infrastructure',
  body: "This month's Streetwise talk is by Boston Cafe Bikers.",
  event_date: '2026-10-21',
  event_time: '18:00:00',
  event_end_time: '19:00:00' as string | null,
  location_name: 'Aeronaut Brewing Company',
  location_address: 'Aeronaut Brewing Company, 14 Tyler St, Somerville, MA 02143, USA',
  location_lat: 42.381978,
  location_lng: -71.106255,
  organizer_name: 'Somerville Pedestrian & Transit Advisory Committee',
  organizer_url: null,
  event_url: 'https://www.facebook.com/events/2878508752520360/' as string | null,
  registration_url: null as string | null,
  registration_notes: null as string | null,
  tags: ['free'],
}

describe('calendarLocation', () => {
  it('uses the address alone when it already names the venue', () => {
    assert.equal(calendarLocation(base.location_name, base.location_address), 'Aeronaut Brewing Company, 14 Tyler St, Somerville, MA 02143')
  })
  it('joins a venue and a separate street address', () => {
    assert.equal(calendarLocation('Program Room, Valente Branch', '826 Cambridge St, Cambridge, MA'), 'Program Room, Valente Branch, 826 Cambridge St, Cambridge, MA')
  })
  it('adds the state to a bare venue name, but not to an online event', () => {
    assert.equal(calendarLocation('Malcolm X Park', null), 'Malcolm X Park, MA')
    assert.equal(calendarLocation('Online', null), 'Online')
  })
})

describe('calendarNotes', () => {
  it('carries the description, cost, host and the event page on Green Streets', () => {
    const notes = calendarNotes(base)
    assert.ok(notes.includes("This month's Streetwise talk"))
    assert.ok(notes.includes('Event page: https://www.facebook.com/events/2878508752520360/'))
    assert.ok(notes.split('\n').includes('Free'))
    assert.ok(notes.includes('Hosted by Somerville Pedestrian & Transit Advisory Committee'))
    assert.ok(notes.includes('Details and directions: https://www.gogreenstreets.org/events/streetwise-at-aeronaut-2026-10-21'))
  })
  it('puts sign-up first and keeps the event page too', () => {
    const notes = calendarNotes({
      ...base,
      registration_url: 'https://www.eventbrite.com/e/123',
      registration_notes: 'Free. Register once per year.',
      tags: ['free', 'registration_required'],
    })
    const lines = notes.split('\n')
    const i = lines.indexOf('Sign-up required: https://www.eventbrite.com/e/123')
    assert.ok(i > -1, notes)
    assert.equal(lines[i + 1], 'Free. Register once per year.')
    assert.ok(!lines.includes('Free'))
  })
})

describe('calendarLink', () => {
  it('prefers sign-up, then the event page, then the Green Streets page', () => {
    assert.equal(calendarLink({ ...base, registration_url: 'https://reg.example/1' }), 'https://reg.example/1')
    assert.equal(calendarLink(base), base.event_url)
    assert.equal(calendarLink({ ...base, event_url: null, slug: null }), 'https://www.gogreenstreets.org/events/ce_sync_cambridge_bike_safety_a3831a426506')
  })
})

describe('buildIcs', () => {
  it('writes the location once, the link, and lines no longer than 75 characters', () => {
    const ics = buildIcs(base)
    assert.ok(ics.includes('LOCATION:Aeronaut Brewing Company\\, 14 Tyler St\\, Somerville\\, MA 02143'), ics)
    assert.ok(ics.includes(`URL:${base.event_url}`))
    assert.ok(ics.includes('DTEND:20261021T190000'))
    for (const line of ics.split('\r\n')) assert.ok(Array.from(line).length <= 75, line)
  })
  it('gives an event with no end time two hours, and one with no start time the whole day', () => {
    assert.ok(buildIcs({ ...base, event_end_time: null }).includes('DTEND:20261021T200000'))
    const allDay = buildIcs({ ...base, event_time: null, event_end_time: null } as unknown as typeof base)
    assert.ok(allDay.includes('DTSTART;VALUE=DATE:20261021'))
    assert.ok(allDay.includes('DTEND;VALUE=DATE:20261022'))
  })
})

describe('gcalUrl', () => {
  it('fills location, notes and Eastern time', () => {
    const u = new URL(gcalUrl(base))
    assert.equal(u.searchParams.get('location'), 'Aeronaut Brewing Company, 14 Tyler St, Somerville, MA 02143')
    assert.equal(u.searchParams.get('dates'), '20261021T180000/20261021T190000')
    assert.equal(u.searchParams.get('ctz'), 'America/New_York')
    assert.ok(u.searchParams.get('details')!.includes('Event page:'))
  })
})
