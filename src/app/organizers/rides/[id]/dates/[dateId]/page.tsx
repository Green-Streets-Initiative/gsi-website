'use client'

import Link from 'next/link'
import { use } from 'react'
import DateEditor from '@/components/organizers/DateEditor'
import { useRide } from '@/components/organizers/RideFrame'
import { todayKey } from '@/lib/organizers/ride-words'
import { Card } from '@/components/organizers/ui'

export default function PlanDatePage({ params }: { params: Promise<{ id: string; dateId: string }> }) {
  const { dateId } = use(params)
  const { detail, reload } = useRide()
  const date = detail.occurrences.find((o) => o.id === dateId)
  const back = `/organizers/rides/${detail.ride.id}`
  const passed = !!date && date.date < todayKey()
  if (!detail.can_edit || !date || passed) {
    return (
      <Card className="mx-auto max-w-lg">
        <p className="text-[15px] text-(--ev-ink-85)">
          {!detail.can_edit
            ? 'Only the ride’s organizer can plan its dates. Co-organizers post updates and see who’s coming.'
            : 'That date isn’t on this ride’s schedule.'}
        </p>
        <Link href={back} className="mt-3 inline-block font-semibold underline">Back to the ride</Link>
      </Card>
    )
  }
  return <DateEditor key={date.id} ride={detail.ride} date={date} dates={detail.occurrences} onSaved={reload} />
}
