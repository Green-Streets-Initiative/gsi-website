import type { CampaignReports, ReportSection } from './types'

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
/** Campaign-wide sections, identical for every sponsor — defined once. */
const campaignResults: ReportSection = {
  id: 'results',
  title: 'Campaign results',
  blocks: [
    { kind: 'prose', paragraphs: ['189 Massachusetts residents opted in and logged the following over the campaign period, verified automatically by the app.'] },
    { kind: 'table', head: ['Mode', 'Trips', 'Miles'],
      rows: [['Walking','5,759','3,902'],['Biking','3,483','11,978'],['Subway & light rail','1,541','8,788'],['Bus','682','5,496'],['Commuter rail','268','6,388'],['Ferry','14','153']],
      foot: ['Total','11,747','36,706'] },
    { kind: 'prose', paragraphs: ['Together these trips avoided an estimated 13.9 metric tons of CO\u2082, equivalent to what roughly 634 trees absorb in a year.'] },
    { kind: 'chart', title: 'Active trips per week',
      bars: [{label:'Jun 15',value:901},{label:'Jun 22',value:988},{label:'Jun 29',value:1062},{label:'Jul 6',value:1285},{label:'Jul 13',value:1132},{label:'Jul 20',value:1474},{label:'Jul 27',value:1580},{label:'Aug 3',value:1781},{label:'Aug 10',value:1544,partial:true}],
      legend: 'Final bar covers a partial week; the campaign closed August 15.' },
    { kind: 'prose', paragraphs: ['Weekly trips rose from 901 in the opening week to 1,781 in the week of August 3, a 98% increase. The number of people active each week rose from 85 to 126 over the same period.'] },
  ],
}

const widerCampaign: ReportSection = {
  id: 'wider',
  title: 'How we promoted the campaign',
  blocks: [
    { kind: 'prose', paragraphs: ['Shift Your Summer ran on paid social, boosted posts, a partnership with a Boston Instagram account, and email to our full subscriber list.'] },
    { kind: 'table', head: ['Channel', 'Impressions', 'Clicks / visits'],
      rows: [['Reddit \u2014 all campaign creative','154,395','1,122 clicks'],['Instagram & Facebook \u2014 campaign ad','96,204','1,648 clicks'],['Meta \u2014 boosted posts','74,342','1,326 visits'],['Instagram \u2014 @onlyinbos partnership, 2 stories','28,346','135 link clicks'],['Universal Hub \u2014 local news site','Awaiting figures','Awaiting figures']],
      foot: ['Total, excluding Universal Hub','353,287','\u2014'],
      note: 'We also ran a placement on Universal Hub, a Boston news site, whose performance figures we have requested and not yet received. The total above therefore understates the campaign\u2019s reach, and we will update this page once those numbers arrive. Click figures are not totaled because the platforms count them differently: link clicks, ad clicks and website visits are not the same measure.' },
    { kind: 'prose', paragraphs: ['The campaign launch email went to 1,563 subscribers on June 12 and was opened by 50% of them.'] },
  ],
}

const lessons = (extra: { title: string; body: string }[] = []): ReportSection => ({
  id: 'learned',
  title: 'What we learned',
  blocks: [
    { kind: 'list',
      intro: "This was the first Shift Your Summer, so we're treating this year as our baseline. What we took from it, and what we intend to do differently:",
      items: [
        ...extra,
        { title: 'Mid-campaign drawings appear to have sustained participation.', body: 'We ran smaller drawings through the summer rather than holding everything for the final drawing. Weekly activity rose from 901 trips to a peak of 1,781 rather than tapering after launch week. We plan to run more of them.' },
        { title: 'Partner audiences reached further than our own channels.', body: 'Two @onlyinbos Instagram stories reached 24,343 accounts, roughly nine times our combined following across platforms. Partnerships are where we expect to grow reach next year.' },
        { title: 'Earned media needs a different approach.', body: 'We pitched the campaign and our sponsors to nine outlets and did not convert any into coverage. Next year we plan to lead with the impact numbers rather than the giveaway, and to consider agency support.' },
        { title: 'We began measuring in-app views on July 1.', body: "The campaign's first two weeks are therefore undercounted in this report. Next year we will measure from day one so the report covers the full period." },
      ],
      outro: [
        "One change is already in hand: we've qualified for a Google Ad Grant that provides $10,000 per month in search advertising, and we plan to put it behind next year's campaign season.",
        "We'd like your feedback on this report. If your team tracks figures we haven't covered, or a different format would be more useful, tell us and we'll build it into next year's report.",
        'Thank you for supporting the first year of this campaign.',
      ] },
  ],
})

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
    {
      slug: 'harvard-fcu',
      token: 'k7dtsksdcrbo',
      sponsor: 'Harvard Federal Credit Union',
      heading: 'Harvard FCU at Shift Your Summer',
      intro:
        'Harvard FCU underwrote Shift Your Summer as a community sponsor and fielded an employee team, one of only four workplaces to do so. This report covers where the sponsorship appeared, what your team did, and what the campaign achieved.',
      summary: [
        { label: 'Employees enrolled on the Harvard FCU team', value: '16' },
        { label: 'Team members who logged trips', value: '12' },
        { label: 'Active trips by the team', value: '826' },
        { label: 'Active miles by the team', value: '2,074' },
        { label: 'Campaign participants overall', value: '189' },
        { label: 'Active miles logged campaign-wide', value: '36,706' },
      ],
      sections: [
        { id: 'recognition', title: 'Where your sponsorship appeared', blocks: [
          { kind: 'list', intro: 'Your support was visible on every public surface the campaign had, for its full run:', items: [
            { title: 'In the app.', body: 'Your logo, name and a tappable link appeared in the sponsor section of the campaign screen \u2014 first position among community sponsors \u2014 for the whole campaign. That screen was viewed 977 times by 163 people in July and August alone.' },
            { title: 'On the campaign page.', body: 'gogreenstreets.org/events/shift-your-summer carried your logo and link continuously, alongside the live leaderboard and prize roster.' },
            { title: 'On social.', body: 'Two dedicated posts named Harvard FCU as a community sponsor and called out your team on the leaderboard \u2014 Instagram on July 30 and Facebook on July 31.' },
          ] },
          { kind: 'stats', rows: [], note: 'In-app measurement began July 1, so the 977 figure covers July 1 \u2013 August 15 and excludes the campaign\u2019s first two weeks.' },
        ] },
        { id: 'team', title: 'Your team\u2019s summer', blocks: [
          { kind: 'stats', rows: [
            { label: 'Employees enrolled', value: '16' },
            { label: 'Members who logged trips', value: '12' },
            { label: 'Active trips', value: '826' },
            { label: 'Active miles', value: '2,074' },
            { label: 'Members who entered the sweepstakes', value: '7' },
          ] },
          { kind: 'prose', paragraphs: ['That is roughly 69 active trips per participating employee over eight weeks \u2014 walking, biking and taking transit instead of driving, tracked automatically by the app. At the IRS mileage rate those miles represent about $1,452 your employees did not spend on driving, and roughly 840 kg of CO\u2082 avoided.'] },
        ] },
        campaignResults,
        widerCampaign,
        lessons([{ title: 'Workplace teams are the format we most want to grow.', body: 'Four employers fielded teams this year. Your 16-person team is a working proof of the model, and expanding it is the clearest way to grow participation next year.' }]),
      ],
    },
    {
      slug: 'kryptonite',
      token: '4rgovljbiba8',
      sponsor: 'Kryptonite',
      heading: 'Kryptonite at Shift Your Summer',
      intro:
        'Kryptonite donated eight KryptoLok Standard U-Locks. Rather than holding them for the final drawing, we awarded them weekly through the summer, which gave participants a recurring reason to stay active and put the Kryptonite name in front of them repeatedly.',
      summary: [
        { label: 'U-Locks donated', value: '8' },
        { label: 'Winners drawn and notified', value: '8' },
        { label: 'Prizes claimed', value: '7' },
        { label: 'Locks shipped to winners', value: '7' },
        { label: 'Confirmed received by winners', value: '6' },
        { label: 'Entries in the largest drawing for your prize', value: '10,148' },
        { label: 'Bike trips logged campaign-wide', value: '3,483' },
        { label: 'Bike miles logged campaign-wide', value: '11,978' },
      ],
      sections: [
        { id: 'drawings', title: 'Weekly drawings', blocks: [
          { kind: 'prose', paragraphs: ['A KryptoLok was drawn most weeks of the campaign. Because participants received entries for each verified active trip, the pool behind each drawing grew as the summer went on:'] },
          { kind: 'table', head: ['Drawing', 'Entries in the pool'],
            rows: [['June 22','817'],['June 29','1,647'],['July 6','108'],['July 13','3,678'],['July 27','6,004'],['August 18 \u2014 three locks','10,148 / 9,995 / 9,863']],
            note: 'Every drawing was seeded and recorded for audit. Where several locks were drawn on the same day, each winner was removed from the pool before the next draw, which is why those figures step down. The July 6 pool is smaller because it ran while we were correcting an entry-weighting issue.' },
        ] },
        { id: 'fulfillment', title: 'Fulfillment', blocks: [
          { kind: 'stats', rows: [
            { label: 'Units drawn', value: '8' },
            { label: 'Winners notified', value: '8' },
            { label: 'Prizes claimed', value: '7' },
            { label: 'Shipped', value: '7' },
            { label: 'Confirmed received by the winner', value: '6' },
            { label: 'Median time from notification to claim', value: '1.5 hours' },
          ] },
          { kind: 'prose', paragraphs: [
            'You shipped directly to winners through a private link rather than passing addresses back and forth by email. That flow worked exactly as intended, and it is now our template for other product donors.',
            'Two winners did not complete their claim \u2014 one declined, one let the claim window lapse \u2014 and in both cases the system drew a replacement winner automatically, so no lock went unawarded.',
          ] },
        ] },
        { id: 'audience', title: 'The audience your locks reached', blocks: [
          { kind: 'prose', paragraphs: ['Participants logged 3,483 bike trips covering 11,978 miles over the campaign \u2014 the largest share of active mileage of any mode. Every one of those riders is someone who needs a lock they trust.'] },
        ] },
        campaignResults,
        widerCampaign,
        lessons([{ title: 'Weekly prizes did more work than a single grand prize.', body: 'Awarding your locks through the summer rather than at the end gave people a reason to keep going, and the entry pool grew twelvefold across the campaign. We would run this format again.' }]),
      ],
    },
    {
      slug: 'noxgear',
      token: 'qn1ylsli44k0',
      sponsor: 'Noxgear',
      heading: 'Noxgear at Shift Your Summer',
      intro: 'Noxgear donated three Tracer 2 LED safety vests and ran a member offer alongside them. This report covers what both delivered.',
      summary: [
        { label: 'Safety vests donated', value: '3' },
        { label: 'Winners drawn, notified and claimed', value: '3' },
        { label: 'Entries in the drawing for your first vest', value: '10,810' },
        { label: 'Times your offer was shown', value: '6,789' },
        { label: 'People who saw your offer', value: '297' },
        { label: 'Active miles logged campaign-wide', value: '36,706' },
      ],
      sections: [
        { id: 'prize', title: 'Your prizes', blocks: [
          { kind: 'prose', paragraphs: ['All three vests were drawn in the final drawing on August 22. All three winners have claimed their prize.'] },
          { kind: 'table', head: ['Vest', 'Entries in the pool'],
            rows: [['First', '10,810'], ['Second', '10,701'], ['Third', '10,632']],
            note: 'Prizes are drawn one at a time and anyone who has already won is removed from the pool before the next draw, so each successive drawing runs from a slightly smaller set of entries.' },
        ] },
        { id: 'offer', title: 'Your member offer', blocks: [
          { kind: 'prose', paragraphs: ['Your 10% off offer ran in the app for the full campaign.'] },
          { kind: 'stats', rows: [
            { label: 'Times shown', value: '6,789' },
            { label: 'People who saw it', value: '297' },
            { label: 'Taps through to your site', value: '15' },
            { label: 'Leads captured', value: '1' },
          ], note: 'These are campaign-period figures (June 15 \u2013 August 15). Your offer has continued running since the campaign closed and has now been shown 8,977 times to 337 people in total.' },
          { kind: 'prose', paragraphs: ['Honest read: reach was strong and sustained \u2014 297 people saw your brand an average of 23 times each. The weak step is the tap-through, and that is our placement and creative rather than your offer. We would like to redesign that surface with you for next year rather than repeat it as-is.'] },
        ] },
        campaignResults,
        widerCampaign,
        lessons([{ title: 'In-app offers reach people but do not yet convert them.', body: 'Offers were shown thousands of times to hundreds of members, and almost nobody tapped. That is a placement and creative problem we intend to fix with our partners before running it again.' }]),
      ],
    },
    {
      slug: 'thousand',
      token: 'vyduf70bwknl',
      sponsor: 'Thousand',
      heading: 'Thousand at Shift Your Summer',
      intro: 'Thousand donated a Chapter MIPS helmet and ran a member offer alongside it. This report covers what both delivered.',
      summary: [
        { label: 'Helmet donated', value: '1' },
        { label: 'Entries in the drawing for your prize', value: '10,810' },
        { label: 'Times your offer was shown', value: '3,169' },
        { label: 'People who saw your offer', value: '223' },
        { label: 'Leads captured to date', value: '3' },
        { label: 'Bike miles logged campaign-wide', value: '11,978' },
      ],
      sections: [
        { id: 'prize', title: 'Your prize', blocks: [
          { kind: 'prose', paragraphs: ['The Chapter MIPS helmet was drawn in the August 22 final drawing from a pool of 10,810 entries. The winner claimed it, it has shipped, and they have confirmed receiving it.'] },
        ] },
        { id: 'offer', title: 'Your member offer', blocks: [
          { kind: 'prose', paragraphs: ['Your 20% off orders over $60 offer ran in the app from mid-June.'] },
          { kind: 'stats', rows: [
            { label: 'Times shown', value: '3,169' },
            { label: 'People who saw it', value: '223' },
            { label: 'Taps through to your site', value: '8' },
            { label: 'Leads captured during the campaign', value: '1' },
            { label: 'Leads captured to date', value: '3' },
          ], note: 'Figures cover the campaign period (June 15 \u2013 August 15); two further leads have come in since. This offer expired July 14, halfway through the campaign, so it was not running during the weeks when participation peaked. Running it through the finale would have roughly doubled its exposure \u2014 that one is ours to fix.' },
        ] },
        campaignResults,
        widerCampaign,
        lessons([{ title: 'Offer end dates should match the campaign, not the calendar.', body: 'Your offer lapsed at the halfway point and missed the campaign\u2019s busiest weeks. Next year every partner offer runs to the final day by default.' }]),
      ],
    },
  ],
}
