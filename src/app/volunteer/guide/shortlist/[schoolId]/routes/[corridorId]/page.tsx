import { notFound } from 'next/navigation'
import { getShortlistCorridor } from '@/lib/shortlist/server'
import RouteReview from '@/components/shortlist/RouteReview'

export const dynamic = 'force-dynamic'

export default async function ShortlistRoutePage({
  params,
}: {
  params: Promise<{ schoolId: string; corridorId: string }>
}) {
  const { schoolId, corridorId } = await params
  const data = await getShortlistCorridor(schoolId, corridorId)
  if (!data) notFound()
  return (
    <RouteReview
      row={data.row}
      corridor={data.corridor}
      index={data.index}
      images={data.images}
      reviews={data.reviews}
      siblings={data.siblings}
    />
  )
}
