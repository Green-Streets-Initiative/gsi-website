'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { flattenObservances, type Observance, type ObservanceDateRow } from '@/lib/employer/observances'

/**
 * GSI's observances (Shift migration 01029) from 30 days ago onward, soonest
 * first. Empty until they load, or if the table isn't there, so callers
 * simply show nothing.
 */
export function useObservances(): Observance[] {
  const [list, setList] = useState<Observance[]>([])

  useEffect(() => {
    let cancelled = false
    const since = new Date(Date.now() - 30 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    supabase
      .from('challenge_observance_dates')
      .select('on_date, observance:challenge_observances!inner(slug, name, source_url, source_name, share_message)')
      .eq('observance.active', true)
      .gte('on_date', since)
      .order('on_date')
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setList(flattenObservances((data ?? []) as unknown as ObservanceDateRow[]))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return list
}
