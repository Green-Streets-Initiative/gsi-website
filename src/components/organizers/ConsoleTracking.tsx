'use client'

import posthog from 'posthog-js'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useConsole } from './ConsoleContext'

/**
 * Ties console visits to the organizer, as PortalTracking does for employer
 * admins: identify by the Supabase user id (no email), tag GSI staff so they
 * can be left out of organizer numbers, and send one organizer_page_viewed
 * per page with the page's name and the ride it's about.
 */
export function pageOf(pathname: string): { page: string; ride_id: string | null } {
  const parts = pathname.replace(/^\/organizers\/?/, '').split('/').filter(Boolean)
  if (parts.length === 0) return { page: 'home', ride_id: null }
  if (parts[0] !== 'rides') return { page: parts[0].replace(/-/g, '_'), ride_id: null }
  if (parts[1] === 'new') return { page: 'new_ride', ride_id: null }
  return { page: parts[2] ?? 'ride_overview', ride_id: parts[1] ?? null }
}

export default function ConsoleTracking() {
  const { phase, me } = useConsole()
  const pathname = usePathname()
  const isGsiAdmin = !!me?.is_admin

  useEffect(() => {
    if (phase !== 'ready') return
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.user?.id) return
      posthog.identify(session.user.id, { is_gsi_admin: isGsiAdmin, uses_organizer_console: true })
    })
    return () => { cancelled = true }
  }, [phase, isGsiAdmin])

  useEffect(() => {
    if (phase !== 'ready' || !pathname) return
    const props = { is_gsi_admin: isGsiAdmin, console: 'organizer' }
    posthog.register_for_session(props)
    posthog.capture('organizer_page_viewed', { ...props, ...pageOf(pathname) })
  }, [phase, isGsiAdmin, pathname])

  return null
}
