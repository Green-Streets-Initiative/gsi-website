import { CalendarCheck, Compass, Flag, GraduationCap } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import type { CampaignIcon } from '@/lib/campaigns/routes'

/**
 * Compass and GraduationCap are what the Shift app already ships for New
 * Routes and Shift Your Semester (lib/campaigns.ts there). Matching rather
 * than inventing.
 */
export const CAMPAIGN_ICONS: Record<CampaignIcon, Icon> = {
  compass: Compass,
  'graduation-cap': GraduationCap,
  calendar: CalendarCheck,
  flag: Flag,
}
