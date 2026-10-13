// Run with: node --test src/lib/employer/survey-exports.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  cambridgeOption,
  dayEmissionsKg,
  exportCsv,
  exportFor,
  massdepBand,
  massdepExport,
  massdepMode,
  modeShare,
  zipRows,
  type ExportResponse,
  type ExportSurvey,
} from './survey-exports.ts'
import { validateAnswers, type SurveyAnswers } from './survey-instrument.ts'

const survey: ExportSurvey = {
  title: 'Commute survey, week of October 19, 2026',
  rule_set: 'massdep',
  week_start: '2026-10-19',
  closes_on: '2026-10-28',
  headcount: 100,
  invited: 90,
  responded_matched: 60,
  responded_unmatched: 5,
}

function resp(days: SurveyAnswers['days'], extra: Partial<SurveyAnswers> = {}, applicable = true): ExportResponse {
  return {
    answers: { screen: { hours17: true, daytime: true, car_lt5: true }, days, ...extra },
    applicable,
    source: 'link',
    matched: true,
  }
}

describe('massdepMode (longest leg, carpool 2-6, vanpool 7+)', () => {
  it('maps plain days', () => {
    assert.equal(massdepMode({ mode: 'walk' }), 'walk')
    assert.equal(massdepMode({ mode: 'bikeshare' }), 'bicycle')
    assert.equal(massdepMode({ mode: 'drive_alone' }), 'drive_alone')
    assert.equal(massdepMode({ mode: 'telework' }), 'telecommute')
    assert.equal(massdepMode({ mode: 'day_off' }), 'flextime')
    assert.equal(massdepMode({ mode: 'out_of_office' }), 'out_of_office')
    assert.equal(massdepMode({ mode: 'shuttle' }), 'other')
    assert.equal(massdepMode({ mode: 'ridehail_alone' }), 'other')
  })
  it('counts dropped off and shared ride-hail as carpool', () => {
    assert.equal(massdepMode({ mode: 'dropped_off' }), 'carpool')
    assert.equal(massdepMode({ mode: 'ridehail_shared' }), 'carpool')
  })
  it('cuts carpool at 7 people', () => {
    assert.equal(massdepMode({ mode: 'carpool', size: 6 }), 'carpool')
    assert.equal(massdepMode({ mode: 'carpool', size: 7 }), 'vanpool')
  })
  it('uses the longest part of a two-part day', () => {
    assert.equal(massdepMode({ mode: 'transit_bike', longest: 'transit' }), 'transit')
    assert.equal(massdepMode({ mode: 'transit_bike', longest: 'bike' }), 'bicycle')
    assert.equal(massdepMode({ mode: 'drive_bike', longest: 'drive' }), 'drive_alone')
    assert.equal(massdepMode({ mode: 'transit_drive', longest: 'drive', car_part: 'drove_alone' }), 'drive_alone')
    assert.equal(massdepMode({ mode: 'transit_drive', longest: 'drive', car_part: 'carpool' }), 'carpool')
    assert.equal(massdepMode({ mode: 'transit_drive', longest: 'transit', car_part: 'drove_alone' }), 'transit')
  })
})

describe('cambridgeOption (carpool 2-7, vanpool 8+)', () => {
  it('cuts at 8', () => {
    assert.equal(cambridgeOption({ mode: 'carpool', size: 7 }), 'carpool')
    assert.equal(cambridgeOption({ mode: 'carpool', size: 8 }), 'vanpool')
    assert.equal(cambridgeOption({ mode: 'dropped_off' }), 'carpool')
    assert.equal(cambridgeOption({ mode: 'transit_walk' }), 'transit_walk')
  })
})

describe('massdepBand', () => {
  it('names the summary form', () => {
    assert.equal(massdepBand(49.9).band, 'below')
    assert.equal(massdepBand(50).band, 'scd3')
    assert.equal(massdepBand(75).band, 'scd2')
    assert.equal(massdepBand(90).band, 'scd1')
  })
})

describe('massdepExport', () => {
  it('counts applicable commuters only and every day', () => {
    const rows = [
      resp({ mon: { mode: 'drive_alone' }, tue: { mode: 'drive_alone' }, wed: { mode: 'transit_walk' }, thu: { mode: 'telework' }, fri: { mode: 'carpool', size: 3 } }),
      resp({ mon: { mode: 'walk' }, tue: { mode: 'walk' }, wed: { mode: 'walk' }, thu: { mode: 'walk' }, fri: { mode: 'walk' } }, {}, false),
    ]
    const doc = massdepExport(survey, rows, null)
    const modes = doc.sections.find((s) => s.heading.startsWith('Home-to-work'))!
    const row = (label: string) => modes.rows!.find((r) => r[0] === label)![1]
    assert.equal(row('Drive alone'), '2 (40%)')
    assert.equal(row('Public transit'), '1 (20%)')
    assert.equal(row('Telecommute'), '1 (20%)')
    assert.equal(row('Walk'), '0 (0%)')
    assert.equal(row("Total week's trips (person-days)"), 5)
    const share = doc.sections.find((s) => s.heading === 'Drive-alone share')!
    assert.equal(share.rows!.find((r) => r[0] === 'Drive-alone share of commute days')![1], '50%')
    const rate = doc.sections.find((s) => s.heading === 'Response rate')!
    assert.equal(rate.rows!.find((r) => r[0] === 'Response rate (of headcount)')![1], '65%')
    assert.equal(rate.rows!.find((r) => r[0] === 'Applicable commuters among respondents')![1], 1)
    assert.ok(doc.sections.some((s) => s.heading === 'Methodology statement'))
    assert.ok(!JSON.stringify(doc).includes('switch_text'))
  })
})

describe('zipRows', () => {
  it('groups ZIPs under 5', () => {
    const rows: ExportResponse[] = []
    for (let i = 0; i < 6; i++) rows.push(resp({}, { home_zip: '02143' }))
    for (let i = 0; i < 2; i++) rows.push(resp({}, { home_zip: '02144' }))
    rows.push(resp({}, { home_zip: '02145' }))
    const out = zipRows(rows)
    assert.deepEqual(out[0], ['02143', 6])
    assert.equal(out.length, 2)
    assert.equal(out[1][1], 3)
    assert.ok(String(out[1][0]).includes('fewer than 5'))
  })
})

describe('modeShare', () => {
  it('excludes telework and days off from the commute base', () => {
    const { commuteDays, personDays, shares } = modeShare([
      resp({ mon: { mode: 'drive_alone' }, tue: { mode: 'telework' }, wed: { mode: 'day_off' }, thu: { mode: 'bike' }, fri: { mode: 'transit_walk' } }),
    ])
    assert.equal(personDays, 5)
    assert.equal(commuteDays, 3)
    assert.equal(shares.drive_alone, 1)
    assert.equal(shares.telework, 1)
  })
})

describe('dayEmissionsKg', () => {
  const a: SurveyAnswers = { screen: {}, days: {}, transit_routes: ['red'] }
  it('uses EPA factors', () => {
    assert.equal(Math.round(dayEmissionsKg(a, { mode: 'drive_alone' }, 10) * 1000), 2970)
    assert.equal(Math.round(dayEmissionsKg(a, { mode: 'carpool', size: 3 }, 10) * 1000), 990)
    assert.equal(Math.round(dayEmissionsKg(a, { mode: 'transit_walk' }, 10) * 1000), 930)
    assert.equal(dayEmissionsKg(a, { mode: 'bike' }, 10), 0)
    assert.equal(dayEmissionsKg(a, { mode: 'telework' }, 10), 0)
    assert.equal(dayEmissionsKg(a, { mode: 'transit_bike', longest: 'bike' }, 10), 0)
    assert.equal(Math.round(dayEmissionsKg({ ...a, transit_routes: ['cr_north'] }, { mode: 'transit_walk' }, 10) * 1000), 1330)
  })
})

describe('exportFor + csv', () => {
  it('renders every rule set and a CSV', () => {
    const rows = [resp({ mon: { mode: 'drive_alone' }, tue: { mode: 'drive_alone' }, wed: { mode: 'walk' }, thu: { mode: 'walk' }, fri: { mode: 'telework' } }, { miles_one_way: '11_20' })]
    for (const rs of ['massdep', 'cambridge', 'boston', 'emissions'] as const) {
      const doc = exportFor(rs, { ...survey, rule_set: rs }, rows, null)
      assert.ok(doc.sections.length > 0, rs)
      const csv = exportCsv(doc)
      assert.ok(csv.startsWith('"Section","Item","Value"'))
    }
    const em = exportFor('emissions', survey, rows, null)
    const week = em.sections[0].rows!
    assert.equal(week.find((r) => r[0] === 'Office days (person-days at the site)')![1], 4)
    assert.equal(week.find((r) => r[0] === 'Telework days')![1], 1)
    // 2 drive days x 31 miles x 0.297 = 18.4 kg
    assert.equal(week.find((r) => r[0] === 'Commuting emissions for the week, kg CO2e')![1], '18')
  })
})

describe('validateAnswers', () => {
  it('requires every day and the follow-ups', () => {
    const bad = validateAnswers({ screen: { hours17: true, daytime: true, car_lt5: true }, days: { mon: { mode: 'carpool' } } }, 'massdep')
    assert.equal(bad.ok, false)
    if (!bad.ok) {
      assert.ok(bad.problems.some((p) => p.includes('Tuesday')))
      assert.ok(bad.problems.some((p) => p.includes('how many people')))
    }
  })
  it('cleans a full answer and tags applicability', () => {
    const good = validateAnswers(
      {
        screen: { hours17: true, daytime: true, car_lt5: false },
        days: { mon: { mode: 'transit_bike', longest: 'transit' }, tue: { mode: 'walk' }, wed: { mode: 'walk' }, thu: { mode: 'walk' }, fri: { mode: 'walk' } },
        home_zip: ' 02143 ',
        start_time: '8',
        why_shift: ['exercise', 'bogus'],
        incentives: { showers: 'very', nope: 'very' },
        switch_text: 'x'.repeat(2000),
      },
      'cambridge',
    )
    assert.equal(good.ok, true)
    if (good.ok) {
      assert.equal(good.applicable, false)
      assert.equal(good.answers.home_zip, '02143')
      assert.deepEqual(good.answers.why_shift, ['exercise'])
      assert.deepEqual(good.answers.incentives, { showers: 'very' })
      assert.equal(good.answers.switch_text!.length, 1000)
    }
  })
  it('does not require screening outside MassDEP', () => {
    const ok = validateAnswers({ days: { mon: { mode: 'walk' }, tue: { mode: 'walk' }, wed: { mode: 'walk' }, thu: { mode: 'walk' }, fri: { mode: 'walk' } } }, 'boston')
    assert.equal(ok.ok, true)
  })
})
