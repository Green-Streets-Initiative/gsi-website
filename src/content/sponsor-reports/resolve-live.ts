import type { FulfillmentCounts } from './fulfillment'
import type { Block, ReportSection, SponsorReport, StatRow } from './types'

/**
 * Replace the value of any stat marked `live` with the current figure.
 *
 * Written values stay as the fallback: if the lookup returns nothing for a
 * brand — a renamed sponsor, a database blip — the report still renders what
 * we published rather than a blank or a zero, which would read to a sponsor as
 * "nothing shipped".
 */
export function resolveLiveStats(
  report: SponsorReport,
  fulfillment: Record<string, FulfillmentCounts>,
): SponsorReport {
  const row = (r: StatRow): StatRow => {
    if (!r.live) return r
    const counts = fulfillment[r.live.brand]
    if (!counts) return r
    return { ...r, value: counts[r.live.field].toLocaleString() }
  }

  const block = (b: Block): Block =>
    b.kind === 'stats' ? { ...b, rows: b.rows.map(row) } : b

  const section = (s: ReportSection): ReportSection => ({
    ...s,
    blocks: s.blocks.map(block),
  })

  return {
    ...report,
    summary: report.summary.map(row),
    sections: report.sections.map(section),
  }
}
