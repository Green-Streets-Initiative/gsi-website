import HubPage from '@/app/shift-your-semester/HubPage'
import { loadHubPage } from '@/app/shift-your-semester/_lib/load'

/*
 * STAGING. The Shift Your Semester hub with the campaign code treated as
 * live, whatever NEXT_PUBLIC_SEMESTER_CODE_LIVE says, so the launch state can
 * be reviewed before launch. Noindex from src/app/preview/layout.tsx.
 */
export const dynamic = 'force-dynamic'

export default async function SemesterHubLivePreview() {
  const data = await loadHubPage()
  return <HubPage {...data} codeLive />
}
