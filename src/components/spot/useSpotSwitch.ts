'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { flagOnForEveryone } from '@/lib/feature-flags'

/**
 * Whether "Report a spot" shows on this site: the `report_a_spot` switch in
 * app_feature_flags (anyone may read it), or `?spot=1` in the address for
 * testing before launch. Visitors here are anonymous, so there is no one to
 * put in a rollout bucket: the web turns on when the switch is on for
 * everyone (enabled, rollout 100), the launch plan's own statement. A
 * partial rollout or an early-access list stays app-only.
 *
 * One read per page load, shared by every entry point. Off on any error.
 */

const FLAG = 'report_a_spot'
let flagPromise: Promise<boolean> | null = null

function readFlag(): Promise<boolean> {
  if (!flagPromise) flagPromise = flagOnForEveryone(supabase, FLAG)
  return flagPromise
}

function testParam(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('spot') === '1'
  } catch {
    return false
  }
}

export function useSpotSwitch(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let cancelled = false
    const answer = testParam() ? Promise.resolve(true) : readFlag()
    answer.then((v) => { if (!cancelled) setOn(v) })
    return () => { cancelled = true }
  }, [])
  return on
}
