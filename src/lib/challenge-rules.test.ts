// Same cases as the Shift app's lib/challenge-rules.test.ts. Run with:
//   node --test src/lib/challenge-rules.test.ts
// If you change a sentence here, change it in the app (locales/en.json
// challengeRules.*) and its test too: members read the app, employers read
// the portal, and the two must say the same thing.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { describeChallengeRules, isStandardRules, effectiveRules } from './challenge-rules.ts'

const base = {
  rules: null,
  startsAt: '2026-10-06T04:00:00Z',
  endsAt: '2026-11-03T04:59:59Z',
  goal: 10,
  spots: 50,
  funded: true,
  amountCents: 1500,
  description: null,
  requiresWorkEmail: true,
  domains: ['loomissayles.com'],
  employer: 'Loomis Sayles',
  contactName: 'Fabiana Fagundes',
  contactEmail: 'ffagundes@loomissayles.com',
}

describe('describeChallengeRules', () => {
  it('standard rules, funded, work email required', () => {
    assert.deepEqual(describeChallengeRules(base), [
      'The first 50 people to reach 10 trips each get a $15 gift card from Loomis Sayles.',
      'Walks of at least 0.5 miles, bike rides, e-scooter rides, carpools, and bus, subway, commuter rail, and ferry trips count.',
      "Driving alone doesn't count.",
      'Up to 2 trips a day count.',
      'Trips taken from Oct 6 through Nov 2 count, including ones from before you joined.',
      "Shift has to record the trip automatically. Trips added by hand don't count.",
      'If Shift guessed a trip wrong (a train ride marked as a drive, say), tap the trip and fix it, and it will count.',
      'For a carpool to count, tap the trip and mark it as a carpool.',
      'To win, verify your @loomissayles.com email in the Shift app. It takes about a minute.',
      'Spots go in the order people reach the goal. We check about every 10 minutes.',
      'Gift card winners pick their card in the app: a local shop, or a digital card from a brand they like.',
      'Questions? Contact Fabiana Fagundes at ffagundes@loomissayles.com.',
    ])
  })

  it('carpool and scooter on, no walk minimum, no cap, self-fulfilled, open to all', () => {
    assert.deepEqual(
      describeChallengeRules({
        ...base,
        rules: {
          modes: ['walk', 'bike', 'transit_bus', 'carpool', 'escooter'],
          min_walk_miles: 0,
          max_trips_per_day: null,
        },
        spots: 1,
        goal: 1,
        funded: false,
        amountCents: null,
        description: 'a Loomis Sayles fleece',
        requiresWorkEmail: false,
        contactName: null,
        contactEmail: 'greenteam@loomissayles.com',
      }),
      [
        'The first person to reach 1 trip gets a Loomis Sayles fleece.',
        'Walks, bike rides, e-scooter rides, carpools, and bus trips count.',
        "Driving alone doesn't count.",
        'There is no daily limit.',
        'Trips taken from Oct 6 through Nov 2 count, including ones from before you joined.',
        "Shift has to record the trip automatically. Trips added by hand don't count.",
        'If Shift guessed a trip wrong (a train ride marked as a drive, say), tap the trip and fix it, and it will count.',
        'For a carpool to count, tap the trip and mark it as a carpool.',
        'Spots go in the order people reach the goal. We check about every 10 minutes.',
        'Loomis Sayles fleece winners tap Claim in the app to share their name and email with Loomis Sayles, who hands out the Loomis Sayles fleece.',
        'Questions? Email greenteam@loomissayles.com.',
      ],
    )
  })
})

describe('commute only', () => {
  it('adds the office sentence after what counts', () => {
    const out = describeChallengeRules({
      ...base,
      rules: { commute_only: true },
      offices: ['One Financial Center, Boston'],
    })
    assert.equal(out[1], 'Walks of at least 0.5 miles, bike rides, e-scooter rides, carpools, and bus, subway, commuter rail, and ferry trips count.')
    assert.equal(out[2], "Only trips that start or end at Loomis Sayles's office (One Financial Center, Boston) count.")
    assert.equal(
      describeChallengeRules({ ...base, rules: { commute_only: true }, offices: ['A St', 'B St'] })[2],
      "Only trips that start or end at Loomis Sayles's offices (A St or B St) count.",
    )
    // Offices stored on the challenge are used when none are passed in.
    assert.equal(
      describeChallengeRules({
        ...base,
        rules: { commute_only: true, offices: [{ address: 'One Financial Center, Boston', lat: 42.35, lng: -71.05 }] },
      })[2],
      "Only trips that start or end at Loomis Sayles's office (One Financial Center, Boston) count.",
    )
  })
})

describe('prize wording', () => {
  it('lowercases a prize typed with a capital article', () => {
    assert.equal(
      describeChallengeRules({ ...base, spots: 25, funded: false, amountCents: null, description: 'A company fleece' })[0],
      'The first 25 people to reach 10 trips each get a company fleece.',
    )
  })
})

describe('effectiveRules', () => {
  it('matches the database defaults', () => {
    assert.deepEqual(effectiveRules(null), {
      modes: ['walk', 'bike', 'escooter', 'transit_bus', 'transit_train', 'transit_commuter_rail', 'ferry', 'carpool'],
      min_walk_miles: 0.5,
      max_trips_per_day: 2,
      commute_only: false,
      offices: [],
    })
    assert.equal(effectiveRules({ max_trips_per_day: null }).max_trips_per_day, null)
    assert.equal(isStandardRules({ commute_only: true }), false)
    assert.equal(isStandardRules(null), true)
    assert.equal(isStandardRules({ modes: ['walk'] }), false)
  })
})

// Web-only sentences for the public rules page (drawing and leaderboard
// rewards). Not part of the app parity set.
import { drawingSentence, topSentence } from './challenge-rules.ts'

describe('drawingSentence', () => {
  const d = { ...base, spots: 3, goal: 8 }
  it('words the entry minimum by the metric the draw uses', () => {
    assert.equal(
      drawingSentence(d, 'active_days'),
      'Everyone with 8 or more active days by Nov 2 is entered in a drawing. 3 winners, picked at random, each get a $15 gift card from Loomis Sayles.',
    )
    assert.match(drawingSentence(d, 'trips'), /^Everyone with 8 or more active trips by/)
    assert.match(drawingSentence({ ...d, goal: 2.5 }, 'miles'), /^Everyone with 2\.5 or more miles shifted by/)
    assert.match(drawingSentence({ ...d, goal: 50 }, 'pct_non_car'), /^Everyone with a Shift Rate of 50% or more by/)
  })
  it('handles one and no minimum, and one winner', () => {
    assert.match(drawingSentence({ ...d, goal: 1 }, 'trips'), /^Everyone with at least one active trip by/)
    assert.match(drawingSentence({ ...d, goal: 0 }, 'trips'), /^Everyone who takes part by/)
    assert.match(drawingSentence({ ...d, spots: 1 }, 'trips'), /One winner, picked at random, gets a \$15 gift card/)
  })
  it('uses the described prize when there is no gift card', () => {
    assert.match(
      drawingSentence({ ...d, funded: false, amountCents: null, description: 'A company fleece' }, 'trips'),
      /each get a company fleece\.$/,
    )
  })
})

describe('topSentence', () => {
  const t = { ...base, spots: 3 }
  it('names the measure and the count', () => {
    assert.equal(
      topSentence(t, 'miles'),
      'The top 3 by miles shifted when the challenge ends each get a $15 gift card from Loomis Sayles.',
    )
    assert.equal(
      topSentence({ ...t, spots: 1 }, 'pct_non_car'),
      'The person with the highest Shift Rate when the challenge ends gets a $15 gift card from Loomis Sayles.',
    )
    assert.match(topSentence({ ...t, spots: 1 }, 'trips'), /^The person with the most active trips/)
  })
})
