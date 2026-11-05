'use client'

// "Carpooling" on Home (Keith 2026-11-04, Update 26 review): how many of the
// workplace's people are looking for someone to share the drive, and how
// many are sharing one now. Counts only, never who. The server
// (get_employer_carpool_counts, Shift) returns null for any count under 3, so
// the card stays hidden until at least 3 people have an open carpool sign-up
// and no one can be singled out.
//
// No action line yet: the portal has no carpool message to share, and carpool
// matching (the commute_partners switch) is on only for named early-access
// people. When it opens to everyone, a "Tell your team about carpool
// matching" link belongs under the counts.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/employer/Card'

type Counts = { groupId: string; looking: number; sharing: number | null }

export default function CarpoolCard({ groupId }: { groupId: string }) {
  const [counts, setCounts] = useState<Counts | null>(null)
  useEffect(() => {
    let live = true
    void supabase.rpc('get_employer_carpool_counts', { p_group_id: groupId }).then(({ data, error }) => {
      const d = data as { looking?: number | null; sharing?: number | null } | null
      if (!live) return
      // An error (or the function not deployed yet) hides the card, like an
      // under-3 count does.
      setCounts(!error && d?.looking != null ? { groupId, looking: d.looking, sharing: d.sharing ?? null } : null)
    })
    return () => {
      live = false
    }
  }, [groupId])

  if (!counts || counts.groupId !== groupId) return null

  return (
    <Card pad>
      <h2 className="mb-4 text-[17px] font-bold tracking-[-0.01em] text-ink">Carpooling</h2>
      <div className="grid gap-2">
        <p className="text-[15px] text-ink">
          <strong className="text-[18px]">{counts.looking.toLocaleString('en-US')}</strong> of your people are looking for someone to share the drive
        </p>
        {counts.sharing != null && (
          <p className="text-[15px] text-ink">
            <strong className="text-[18px]">{counts.sharing.toLocaleString('en-US')}</strong> are sharing the drive now
          </p>
        )}
      </div>
    </Card>
  )
}
