import { notFound } from 'next/navigation'
import { getShortlistSchool } from '@/lib/shortlist/server'
import SchoolWorkspace from '@/components/shortlist/SchoolWorkspace'

export const dynamic = 'force-dynamic'

export default async function ShortlistSchoolPage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  const { schoolId } = await params
  const data = await getShortlistSchool(schoolId)
  if (!data) notFound()
  return <SchoolWorkspace row={data.row} corridors={data.corridors} reviews={data.reviews} />
}
