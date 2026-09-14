import { notFound } from 'next/navigation'
import SchoolPage from '@/app/shift-your-semester/SchoolPage'
import { loadSchoolPage } from '@/app/shift-your-semester/_lib/load'

/*
 * STAGING. A school page with the campaign code treated as live. Analytics
 * captures are off so review traffic never reaches the funnel.
 */
export const dynamic = 'force-dynamic'

export default async function SchoolLivePreview({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params
  const d = await loadSchoolPage(school, { codeLive: true })
  if (!d) notFound()
  return <SchoolPage d={d} capture={false} />
}
