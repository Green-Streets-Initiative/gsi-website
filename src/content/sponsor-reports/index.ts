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
): { campaign: CampaignReports; report: SponsorReport } | undefined {
  const campaign = findCampaign(campaignSlug)
  const report = campaign?.reports.find((r) => r.slug === sponsorSlug)
  if (!campaign || !report) return undefined
  return { campaign, report }
}

/** All (campaign, sponsor) pairs — used to prerender every report at build. */
export function allReportParams(): { campaign: string; sponsor: string }[] {
  return campaigns.flatMap((c) => c.reports.map((r) => ({ campaign: c.slug, sponsor: r.slug })))
}

export * from './types'
