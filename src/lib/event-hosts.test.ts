// Event co-hosts. Run with:
//   node --test src/lib/event-hosts.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { eventHosts, hostIndex, splitHosts } from './event-hosts.ts'

const ORGS = [
  { id: 'seaport-tma', name: 'Seaport TMA', logo_url: 'https://x/seaport.png', url: 'https://www.seaporttma.org' },
  { id: 'massbike', name: 'MassBike', logo_url: 'https://x/mb.png', url: 'https://www.massbike.org' },
  { id: 'bcu', name: 'Boston Cyclists Union' },
  { id: 'cbs', name: 'Cambridge Bicycle Safety' },
  { id: 'wbs', name: 'Walk Bike Springfield' },
  { id: 'sbk', name: 'Somerville Bike Kitchen' },
  { id: 'holyoke', name: 'Holyoke Bicycle and Pedestrian Committee' },
  { id: 'weab', name: 'Worcester Earn-A-Bike', aliases: ['WEAB'] },
]
const idx = hostIndex(ORGS)
const names = (hs: { name: string }[]) => hs.map((h) => h.name)

describe('splitHosts', () => {
  it('splits a joined list where a piece is a known organizer', () => {
    assert.deepEqual(names(splitHosts('Seaport TMA, A Better City TMA, & Lower Mystic TMA', idx)), ['Seaport TMA', 'A Better City TMA', 'Lower Mystic TMA'])
    assert.deepEqual(names(splitHosts('Boston Cyclists Union and Cambridge Bicycle Safety', idx)), ['Boston Cyclists Union', 'Cambridge Bicycle Safety'])
    assert.deepEqual(names(splitHosts('Worcester Earn-A-Bike (WEAB) and MassBike', idx)), ['Worcester Earn-A-Bike', 'MassBike'])
  })
  it('keeps unknown pieces together', () => {
    assert.deepEqual(names(splitHosts('Walk Bike Springfield and Holyoke Bike and Pedestrian Committee', idx)), ['Walk Bike Springfield', 'Holyoke Bike and Pedestrian Committee'])
  })
  it('leaves a single name with "and" in it alone', () => {
    assert.deepEqual(names(splitHosts('North and South Rivers Watershed Association', idx)), ['North and South Rivers Watershed Association'])
    assert.deepEqual(names(splitHosts('Holyoke Bicycle and Pedestrian Committee', idx)), ['Holyoke Bicycle and Pedestrian Committee'])
    assert.deepEqual(names(splitHosts('Somerville Cycle & Social', idx)), ['Somerville Cycle & Social'])
    assert.deepEqual(names(splitHosts('Somerville Alliance for Safe Streets (SASS) / Somerville Pedestrian & Transit Advisory Committee (PTAC)', idx)), ['Somerville Alliance for Safe Streets (SASS)', 'Somerville Pedestrian & Transit Advisory Committee (PTAC)'])
  })
})

describe('eventHosts', () => {
  it('adds co-hosts the description names after Join', () => {
    const hs = eventHosts(
      { organizer_name: 'Seaport TMA', body: 'Join Seaport TMA and MassBike to learn tips and tricks for safe winter cycling.' },
      ORGS[0], ORGS,
    )
    assert.deepEqual(names(hs), ['Seaport TMA', 'MassBike'])
    assert.equal(hs[1].logo, 'https://x/mb.png')
  })
  it('ignores "Join us" and organizers mentioned elsewhere', () => {
    const hs = eventHosts(
      { organizer_name: 'Somerville Bike Kitchen', body: 'Join us for a fix-it night. MassBike will table at the door.' },
      ORGS[5], ORGS,
    )
    assert.deepEqual(names(hs), ['Somerville Bike Kitchen'])
  })
  it('takes "hosted by" with one name', () => {
    const hs = eventHosts({ organizer_name: 'Seaport TMA', body: 'This ride is co-hosted by the Boston Cyclists Union.' }, ORGS[0], ORGS)
    assert.deepEqual(names(hs), ['Seaport TMA', 'Boston Cyclists Union'])
  })
})
