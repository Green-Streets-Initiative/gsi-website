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

export interface StatRow {
  label: string
  value: string
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

export interface CampaignReports {
  /** URL segment, e.g. "shift-your-summer-2026" */
  slug: string
  /** Display name, e.g. "Shift Your Summer" */
  name: string
  /** Human-readable campaign period, e.g. "June 15 – August 15, 2026" */
  period: string
  /** Date the figures were pulled, e.g. "September 2, 2026" */
  asOf: string
  reports: SponsorReport[]
}
