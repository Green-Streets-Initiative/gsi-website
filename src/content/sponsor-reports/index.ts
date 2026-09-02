import type { CampaignReports, SponsorReport } from './types'
import { shiftYourSummer2026 } from './shift-your-summer-2026'

/** Every campaign with published sponsor reports. Add new campaigns here. */
export const campaigns: CampaignReports[] = [shiftYourSummer2026]

export function findCampaign(slug: string): CampaignReports | undefined {
  return campaigns.find((c) => c.slug === slug)
}

export function findReport(
  campaignSlug: string,
  sponsorSlug: string,
  token: string,
): { campaign: CampaignReports; report: SponsorReport } | undefined {
  const campaign = findCampaign(campaignSlug)
  const report = campaign?.reports.find((r) => r.slug === sponsorSlug)
  // The token must match: without it the slug alone would let one sponsor
  // guess their way into another's report.
  if (!campaign || !report || report.token !== token) return undefined
  return { campaign, report }
}

/** Every (campaign, sponsor, token) triple — used to prerender each report. */
export function allReportParams(): { campaign: string; sponsor: string; token: string }[] {
  return campaigns.flatMap((c) =>
    c.reports.map((r) => ({ campaign: c.slug, sponsor: r.slug, token: r.token })),
  )
}

export * from './types'
