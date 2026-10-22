'use client'

import Link from 'next/link'
import RideEditor from '@/components/organizers/RideEditor'
import { useRide } from '@/components/organizers/RideFrame'
import { Card } from '@/components/organizers/ui'

export default function EditRidePage() {
  const { detail, reload } = useRide()
  if (!detail.can_edit) {
    return (
      <Card className="mx-auto max-w-lg">
        <p className="text-[15px] text-(--ev-ink-85)">Only the ride&rsquo;s organizer can change its details. Co-organizers post updates and see who&rsquo;s coming.</p>
        <Link href={`/organizers/rides/${detail.ride.id}`} className="mt-3 inline-block font-semibold underline">Back to the ride</Link>
      </Card>
    )
  }
  return <RideEditor ride={detail.ride} onSaved={reload} />
}
