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

const PEOPLE_PAGES = new Set(['roster', 'team', 'turnout', 'photos', 'dates'])

/** Emails and phone numbers never reach a recording. */
function maskContact(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, (m) => '*'.repeat(m.length))
    .replace(/\+?\d[\d\s().-]{8,}\d/g, (m) => '*'.repeat(m.length))
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

  // Session recording, console only (Keith 2026-11-21: watch real organizers
  // use it from launch). The rest of the website records nothing. The
  // recorder comes from our own bundle, since the site loads no PostHog
  // scripts (PostHogProvider). Typed fields are masked, and pages that list
  // other people (who's coming, turnout, organizers, photos, one date's
  // plan) pause it. Every text passes maskContact, so emails and phone
  // numbers never reach a recording.
  useEffect(() => {
    if (phase !== 'ready' || !pathname) return
    if (PEOPLE_PAGES.has(pageOf(pathname).page)) {
      if (posthog.sessionRecordingStarted()) posthog.stopSessionRecording()
      return
    }
    let cancelled = false
    import('posthog-js/dist/posthog-recorder').then(() => {
      if (cancelled || posthog.sessionRecordingStarted()) return
      posthog.set_config({ session_recording: { maskAllInputs: true, maskTextSelector: '*', maskTextFn: maskContact } })
      posthog.startSessionRecording(true)
    }).catch(() => { /* recording never blocks the console */ })
    return () => { cancelled = true }
  }, [phase, pathname])

  useEffect(() => () => {
    if (posthog.sessionRecordingStarted()) posthog.stopSessionRecording()
  }, [])

  return null
}
