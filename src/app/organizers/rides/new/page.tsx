'use client'

import Link from 'next/link'
import RideEditor from '@/components/organizers/RideEditor'
import { useConsole } from '@/components/organizers/ConsoleContext'
import { Card } from '@/components/organizers/ui'

export default function NewRidePage() {
  const { me } = useConsole()
  if (!me?.can_create) {
    return (
      <Card className="mx-auto max-w-lg">
        <p className="text-[15px] text-(--ev-ink-85)">
          Setting up new rides is open to invited organizers for now. As a co-organizer you can post updates and see who&rsquo;s coming on the rides you help run.
        </p>
        <Link href="/organizers" className="mt-3 inline-block font-semibold underline">Your rides</Link>
      </Card>
    )
  }
  return <RideEditor ride={null} />
}
