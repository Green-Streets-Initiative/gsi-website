import { getShortlist } from '@/lib/shortlist/server'
import ShortlistIndex from '@/components/shortlist/ShortlistIndex'

export const dynamic = 'force-dynamic'

export default async function ShortlistPage() {
  const rows = await getShortlist()
  return <ShortlistIndex rows={rows} />
}
