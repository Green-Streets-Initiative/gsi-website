/**
 * Sponsor report content model.
 *
 * Post-campaign sponsor reports are deliberately STATIC snapshots, not live
 * queries: a sponsor should see the same numbers we quoted them, whatever
 * happens in the database afterwards. Every report carries an `asOf` date.
 *
 * Numbers here are transcribed from the internal post-mortem in the Shift
 * repo (docs/reports/campaigns/<campaign>/), where each one traces to a
 * query in appendix-queries.md.
 */

/**
 * A figure that is still moving. Campaign-period numbers (trips, miles,
 * entries, drawing pools) are historical and must stay static — a sponsor
 * should keep seeing the figures we sent them. Fulfillment is different: it
 * keeps changing for weeks after a campaign closes, and a sponsor opening the
 * link in October should see today's state, not the day we wrote the page.
 */
export interface LiveFulfillmentStat {
  /** Sponsor name, or the prize's brand_name_override when there is no sponsor row. */
  brand: string
  field: 'drawn' | 'notified' | 'claimed' | 'shipped' | 'received'
}

export interface StatRow {
  label: string
  /** Static fallback, and what renders if the live lookup fails. */
  value: string
  live?: LiveFulfillmentStat
}

export interface TableBlock {
  kind: 'table'
  head: string[]
  rows: string[][]
  foot?: string[]
  note?: string
}

export interface StatsBlock {
  kind: 'stats'
  rows: StatRow[]
  note?: string
}

export interface ProseBlock {
  kind: 'prose'
  paragraphs: string[]
}

export interface ChartBlock {
  kind: 'chart'
  title: string
  bars: { label: string; value: number; partial?: boolean }[]
  legend?: string
  note?: string
}

export interface ListBlock {
  kind: 'list'
  intro?: string
  items: { title: string; body: string }[]
  outro?: string[]
}

export type Block = TableBlock | StatsBlock | ProseBlock | ChartBlock | ListBlock

export interface ReportSection {
  id: string
  title: string
  /**
   * Short label for the sticky section nav. Section headings are written to be
   * read in place ("How we promoted the campaign"), which is too long for a
   * pill — without this the last pills get clipped off the row.
   */
  navLabel?: string
  blocks: Block[]
}

export interface SponsorReport {
  /** URL segment, e.g. "segway" */
  slug: string
  /**
   * Unguessable final URL segment. Sponsor reports are shared by link, not
   * logged into; the token stops one sponsor enumerating another's report by
   * swapping the slug. Not a secret worth protecting with a password — the
   * pages hold no PII or financials — just enough entropy that the URL has to
   * be given to you.
   */
  token: string
  /** Display name, e.g. "Segway" */
  sponsor: string
  /** Page <h1> */
  heading: string
  /** One-paragraph opening */
  intro: string
  /** Headline figures shown before the first section */
  summary: StatRow[]
  sections: ReportSection[]
}

/** The public campaign wrap page — one shared story, no per-sponsor analytics. */
export interface CampaignWrap {
  /** Page <h1> */
  heading: string
  intro: string
  summary: StatRow[]
  sections: ReportSection[]
  /** Donor roll, grouped for display. */
  donors: { group: string; names: string[] }[]
}

export interface CampaignReports {
  /** URL segment, e.g. "shift-your-summer-2026" */
  slug: string
  /** competitions.id — used to resolve live fulfillment figures. */
  competitionId: string
  /** Display name, e.g. "Shift Your Summer" */
  name: string
  /** Human-readable campaign period, e.g. "June 15 – August 15, 2026" */
  period: string
  /** Date the figures were pulled, e.g. "September 2, 2026" */
  asOf: string
  reports: SponsorReport[]
  /** Optional public wrap page at /sponsors/<campaign>. */
  wrap?: CampaignWrap
}
