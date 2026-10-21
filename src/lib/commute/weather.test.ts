// Run with: node --test src/lib/commute/weather.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chipFor, flagsFor, flagsForMode, morningWeather, planMorning, summaryFor, wearFor, type WeatherHour } from './weather.ts'

const hour = (start: string, over: Partial<WeatherHour> = {}): WeatherHour => ({ start, tempF: 55, condition: 'sunny', windMph: 5, precipPct: 0, ...over })
// Tuesday 2026-10-20, 8 PM in Boston (Wednesday 00:00 UTC)
const tuesdayEvening = new Date('2026-10-21T00:00:00Z')
// Wednesday 2026-10-21, 6:30 AM in Boston
const wednesdayDawn = new Date('2026-10-21T10:30:00Z')
// Friday 2026-10-23, 6 PM in Boston
const fridayEvening = new Date('2026-10-23T22:00:00Z')

describe('planMorning', () => {
  it('is this morning before leave-by on a weekday, else the next weekday', () => {
    assert.deepEqual(planMorning('08:12', wednesdayDawn), { date: '2026-10-21', dayLabel: 'This morning' })
    assert.deepEqual(planMorning('08:12', tuesdayEvening), { date: '2026-10-21', dayLabel: 'Tomorrow morning' })
    assert.deepEqual(planMorning('08:12', fridayEvening), { date: '2026-10-26', dayLabel: 'Monday morning' })
  })
})

describe('flags', () => {
  it('reads rain, snow, cold, heat and the app\'s severe test', () => {
    assert.deepEqual(flagsFor(hour('x', { condition: 'light rain', precipPct: 70, tempF: 48 })), ['rain'])
    assert.deepEqual(flagsFor(hour('x', { condition: 'chance light rain', precipPct: 20 })), [])
    assert.deepEqual(flagsFor(hour('x', { condition: 'snow showers', precipPct: 60, tempF: 30 })), ['snow', 'cold'])
    assert.deepEqual(flagsFor(hour('x', { condition: 'mostly sunny', tempF: 31 })), ['cold'])
    assert.deepEqual(flagsFor(hour('x', { condition: 'sunny', tempF: 90 })), ['heat'])
    assert.ok(flagsFor(hour('x', { condition: 'freezing rain', precipPct: 90, tempF: 30 })).includes('severe'))
  })
  it('matters to the rows outside: rides and walks, and the wait at a stop; never the drive', () => {
    const w = { date: '2026-10-21', dayLabel: 'Tomorrow morning', hour: hour('x', { tempF: 30, condition: 'rain', precipPct: 80 }), flags: ['rain', 'cold'] as const }
    const mw = { ...w, flags: [...w.flags] }
    assert.deepEqual(flagsForMode(mw, 'drive'), [])
    assert.deepEqual(flagsForMode(mw, 'transit'), ['rain', 'cold'])
    assert.equal(wearFor(mw, 'transit'), 'Rain gear and layers')
    assert.equal(chipFor(mw, 'bike')?.label, 'Rain')
    assert.equal(chipFor(mw, 'drive'), null)
    const hot = { ...mw, hour: hour('x', { tempF: 91 }), flags: ['heat' as const] }
    assert.equal(chipFor(hot, 'transit'), null)
    assert.equal(wearFor(hot, 'bike'), 'Light clothes, water')
    const cold = { ...mw, hour: hour('x', { tempF: 28 }), flags: ['cold' as const] }
    assert.equal(wearFor(cold, 'transit'), 'Layers for the wait')
    assert.equal(wearFor(cold, 'walk'), 'Layers and gloves')
    assert.equal(chipFor(cold, 'shuttle')?.label, '28°F')
  })
})

describe('morningWeather', () => {
  const hours = [
    hour('2026-10-21T07:00:00-04:00', { tempF: 40 }),
    hour('2026-10-21T08:00:00-04:00', { tempF: 42, condition: 'chance light rain', precipPct: 30 }),
    hour('2026-10-21T09:00:00-04:00', { tempF: 44, condition: 'light rain', precipPct: 60 }),
  ]
  it('takes the leave-by hour on the routed morning, and the next hour\'s flags too', () => {
    const w = morningWeather(hours, '08:12', '2026-10-21', tuesdayEvening)
    assert.equal(w?.hour.tempF, 42)
    assert.equal(w?.dayLabel, 'Tomorrow morning')
    assert.deepEqual(w?.flags, ['rain'])
    assert.equal(summaryFor(w!), '42°F, light rain, 30% chance')
  })
  it('is nothing when the forecast does not reach the morning', () => {
    assert.equal(morningWeather([], '08:12', null, tuesdayEvening), null)
    assert.equal(morningWeather(hours, '08:12', null, fridayEvening), null)
  })
})
