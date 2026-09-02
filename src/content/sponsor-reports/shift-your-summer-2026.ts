import type { CampaignReports } from './types'

/**
 * Shift Your Summer 2026 sponsor reports.
 *
 * Source of truth for every figure: the internal post-mortem in the Shift
 * repo at docs/reports/campaigns/sys-2026/, where each number traces to a
 * query in appendix-queries.md. Do not edit numbers here without updating
 * that appendix — a sponsor-facing number with no traceable source is how
 * reports become wrong.
 *
 * Note on participants: 189 is the count at drawing time. A later re-query
 * returns 188 (one account was deleted after the campaign). Reports quote the
 * drawing-time figure, which is who was actually in the running.
 */
export const shiftYourSummer2026: CampaignReports = {
  slug: 'shift-your-summer-2026',
  name: 'Shift Your Summer',
  period: 'June 15 – August 15, 2026',
  asOf: 'September 2, 2026',
  reports: [
    {
      slug: 'segway',
      token: '9ttyjeb0n4nu',
      sponsor: 'Segway',
      heading: 'Segway at Shift Your Summer',
      intro:
        "Segway donated the campaign's grand prize, a MUXI electric bike with accessory bundle. This report covers where that prize appeared, the audience it reached, and what participants did over the eight weeks it was on offer.",
      summary: [
        { label: 'Ad impressions for creative featuring the Segway prize', value: '215,672' },
        { label: 'Clicks from those ads', value: '2,571' },
        { label: 'Subscribers sent the launch email featuring the prize', value: '1,563' },
        { label: 'Entries in the grand-prize drawing', value: '10,810' },
        { label: 'Campaign participants', value: '189' },
        { label: 'Active trips logged', value: '11,747' },
        { label: 'Active miles logged', value: '36,706' },
      ],
      sections: [
        {
          id: 'ads',
          title: 'Paid advertising featuring the prize',
          blocks: [
            {
              kind: 'prose',
              paragraphs: [
                'On Meta and Reddit we ran Massachusetts-targeted creative that either pictured the MUXI or named the Segway e-bike in the headline.',
              ],
            },
            {
              kind: 'table',
              head: ['Placement', 'Impressions', 'Clicks', 'Click rate'],
              rows: [
                ['Instagram & Facebook — “Win a $2K Segway e-bike”', '96,204', '1,648', '1.71%'],
                ['Reddit — “Move more this summer: win a Segway e-bike & more”', '71,189', '531', '0.75%'],
                ['Reddit — grand-prize creative, MUXI pictured', '48,279', '392', '0.81%'],
              ],
              foot: ['Total', '215,672', '2,571', '—'],
            },
            {
              kind: 'prose',
              paragraphs: [
                'The Meta placement reached 39,131 people and delivered 1,503 visits to the campaign page, plus 119 reactions, 15 saves and 3 shares. Among our Reddit ads, both creatives featuring the prize outperformed the one that did not: 0.81% and 0.75% against 0.57%.',
              ],
            },
            {
              kind: 'stats',
              rows: [],
              note: 'The impressions column uses Meta’s “views” figure and Reddit’s “impressions” figure. Meta’s click rate is link clicks ÷ views; Reddit’s rates are as reported by the platform.',
            },
          ],
        },
        {
          id: 'email',
          title: 'Email',
          blocks: [
            {
              kind: 'prose',
              paragraphs: [
                'The campaign launch email, which featured the grand prize, went to our full subscriber list on June 12.',
              ],
            },
            {
              kind: 'stats',
              rows: [
                { label: 'Emails sent', value: '1,563' },
                { label: 'Open rate', value: '50%' },
                { label: 'Click rate', value: '7%' },
              ],
            },
          ],
        },
        {
          id: 'app',
          title: 'Placement in the app',
          blocks: [
            {
              kind: 'prose',
              paragraphs: [
                'The MUXI held the grand-prize position on the Shift Your Summer campaign screen for the full eight weeks, with a product image, the Segway name, and an outbound link.',
              ],
            },
            {
              kind: 'stats',
              rows: [
                { label: 'Views of the campaign screen', value: '977' },
                { label: 'Individual people who viewed it', value: '163' },
              ],
              note: 'In-app measurement began July 1, so these figures cover July 1 – August 15 and exclude the campaign’s first two weeks.',
            },
          ],
        },
        {
          id: 'traffic',
          title: 'Traffic we sent to your product page',
          blocks: [
            {
              kind: 'prose',
              paragraphs: [
                "Every link to the MUXI product page, from both the app and the campaign page on our website, carried UTM tags so you can identify the traffic in your own analytics. We did not log these taps on our side, so we can't report a click count — but you can find the sessions by filtering for:",
              ],
            },
            {
              kind: 'table',
              head: ['Parameter', 'From the Shift app', 'From our campaign page'],
              rows: [
                ['utm_source', 'shift_app', 'gsi_website'],
                ['utm_medium', 'in_app', 'event_page'],
                ['utm_campaign', 'shift-your-summer-2026', 'shift-your-summer-2026'],
                ['utm_content', 'grand_prize_detail', 'grand_prize_card'],
              ],
              note: 'Measuring these taps ourselves is on our list for next year, so a future report can state the traffic we sent you rather than pointing you to your own analytics.',
            },
          ],
        },
        {
          id: 'drawing',
          title: 'The drawing',
          blocks: [
            {
              kind: 'prose',
              paragraphs: [
                'Participants received entries for each verified active trip they logged, so the entry pool grew throughout the campaign. The winner was selected on August 22 at 12:00pm ET by an automated, seeded random drawing from 10,810 entries, with the entry pool and selection recorded for audit.',
                'The winner has claimed the prize and submitted their shipping details.',
              ],
            },
          ],
        },
        {
          id: 'wider',
          title: 'The wider campaign',
          blocks: [
            {
              kind: 'prose',
              paragraphs: [
                'This is the full promotional effort for Shift Your Summer, including the prize-specific creative above, plus boosted posts and a partnership with a Boston Instagram account.',
              ],
            },
            {
              kind: 'table',
              head: ['Channel', 'Impressions', 'Clicks / visits'],
              rows: [
                ['Reddit — all campaign creative', '154,395', '1,122 clicks'],
                ['Instagram & Facebook — campaign ad', '96,204', '1,648 clicks'],
                ['Meta — boosted posts', '74,342', '1,326 visits'],
                ['Instagram — @onlyinbos partnership, 2 stories', '28,346', '135 link clicks'],
                ['Universal Hub — local news site', 'Awaiting figures', 'Awaiting figures'],
              ],
              foot: ['Total, excluding Universal Hub', '353,287', '—'],
              note: 'We also ran a placement on Universal Hub, a Boston news site, whose performance figures we have requested and not yet received. The total above therefore understates the campaign\u2019s reach, and we will update this page once those numbers arrive. Click figures are not totaled because the platforms count them differently: link clicks, ad clicks and website visits are not the same measure.',
            },
            {
              kind: 'prose',
              paragraphs: ['The @onlyinbos stories reached 24,343 accounts between them.'],
            },
          ],
        },
        {
          id: 'results',
          title: 'Campaign results',
          blocks: [
            {
              kind: 'prose',
              paragraphs: [
                '189 Massachusetts residents opted in and logged the following over the campaign period, verified automatically by the app.',
              ],
            },
            {
              kind: 'table',
              head: ['Mode', 'Trips', 'Miles'],
              rows: [
                ['Walking', '5,759', '3,902'],
                ['Biking', '3,483', '11,978'],
                ['Subway & light rail', '1,541', '8,788'],
                ['Bus', '682', '5,496'],
                ['Commuter rail', '268', '6,388'],
                ['Ferry', '14', '153'],
              ],
              foot: ['Total', '11,747', '36,706'],
            },
            {
              kind: 'prose',
              paragraphs: [
                'Together these trips avoided an estimated 13.9 metric tons of CO₂, equivalent to what roughly 634 trees absorb in a year.',
              ],
            },
            {
              kind: 'chart',
              title: 'Active trips per week',
              bars: [
                { label: 'Jun 15', value: 901 },
                { label: 'Jun 22', value: 988 },
                { label: 'Jun 29', value: 1062 },
                { label: 'Jul 6', value: 1285 },
                { label: 'Jul 13', value: 1132 },
                { label: 'Jul 20', value: 1474 },
                { label: 'Jul 27', value: 1580 },
                { label: 'Aug 3', value: 1781 },
                { label: 'Aug 10', value: 1544, partial: true },
              ],
              legend: 'Final bar covers a partial week; the campaign closed August 15.',
            },
            {
              kind: 'prose',
              paragraphs: [
                'Weekly trips rose from 901 in the opening week to 1,781 in the week of August 3, a 98% increase. The number of people active each week rose from 85 to 126 over the same period.',
              ],
            },
          ],
        },
        {
          id: 'learned',
          title: 'What we learned',
          blocks: [
            {
              kind: 'list',
              intro:
                "This was the first Shift Your Summer, so we're treating this year as our baseline. Six things we took from it, and what we intend to do differently:",
              items: [
                {
                  title: 'The prize outperformed our general messaging.',
                  body: 'On Reddit, our two ads featuring the prize drew click rates of 0.81% and 0.75%, against 0.57% for the creative that did not mention it. Next year we plan to lead with the grand prize earlier and across more placements.',
                },
                {
                  title: 'Mid-campaign drawings appear to have sustained participation.',
                  body: 'We ran smaller drawings through the summer rather than holding everything for the final drawing. Weekly activity rose from 901 trips to a peak of 1,781 rather than tapering after launch week. We plan to run more of them.',
                },
                {
                  title: 'Partner audiences reached further than our own channels.',
                  body: 'Two @onlyinbos Instagram stories reached 24,343 accounts, roughly nine times our combined following across platforms. Partnerships are where we expect to grow reach next year.',
                },
                {
                  title: 'The campaign was visible to more people than entered it.',
                  body: '189 people entered the sweepstakes, but 245 logged trips during the campaign and 418 had the app by the time it closed. The campaign screen carrying your prize was open to all of them, and we can only evidence the portion measured from July 1. Next year we plan to measure prize visibility from day one and report the full audience.',
                },
                {
                  title: 'Earned media needs a different approach.',
                  body: 'We included the grand prize and our sponsors in press outreach to more than 20 outlets, and it did not convert into coverage. Next year we plan to change how we approach press, including the option of agency support.',
                },
                {
                  title: 'We began measuring in-app views on July 1.',
                  body: "The campaign's first two weeks are therefore undercounted in this report. Next year we will measure from day one so the report covers the full period.",
                },
              ],
              outro: [
                "One change is already in hand: we've qualified for a Google Ad Grant that provides $10,000 per month in search advertising, and we plan to put it behind next year's campaign season. Search was the one channel we had almost no presence in this year, so it should add meaningfully to the reach reported here.",
                "We'd like your feedback on this report. If your team tracks figures we haven't covered, or a different format would be more useful, tell us and we'll build it into next year's report.",
                'Thank you for supporting the first year of this campaign.',
              ],
            },
          ],
        },
      ],
    },
  ],
}
