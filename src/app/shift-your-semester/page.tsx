import type { Metadata } from 'next'
import HubPage from './HubPage'
import { loadHubPage } from './_lib/load'
import { SEMESTER_CODE_LIVE, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS } from '@/lib/semester/campaign'

export const revalidate = 3600

export const metadata: Metadata = {
  title: `Shift Your Semester — ${SEMESTER_REWARD} for getting around like a local | Green Streets Initiative`,
  description: `College students, faculty, and staff in Massachusetts: walk, bike, and ride the T with Shift. Verify your school email, take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days, and unlock a ${SEMESTER_REWARD} reward from local merchants or a gift card you choose.`,
  alternates: { canonical: 'https://www.gogreenstreets.org/shift-your-semester' },
  openGraph: {
    title: 'Shift Your Semester',
    description: `Verify your school email on Shift, take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days, unlock a ${SEMESTER_REWARD} reward.`,
    url: 'https://www.gogreenstreets.org/shift-your-semester',
  },
}

export default async function ShiftYourSemesterPage() {
  const data = await loadHubPage()
  return <HubPage {...data} codeLive={SEMESTER_CODE_LIVE} />
}
