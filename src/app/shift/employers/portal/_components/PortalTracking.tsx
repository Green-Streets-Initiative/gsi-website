'use client'

import posthog from 'posthog-js'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { usePortal } from '../_lib/portal-context'
import { supabase } from '@/lib/supabase'

/**
 * Ties portal visits to the employer. PostHogProvider already sends a plain
 * $pageview for every portal page, but nothing on it says WHICH employer's
 * admin was looking, so admin engagement could only be guessed from auth
 * sign-in dates. This registers the employer for the visit and sends one
 * portal_page_viewed per page with the section name.
 *
 * GSI staff opening a customer's portal are tagged is_gsi_admin so they can
 * be filtered out of customer engagement numbers.
 */
export default function PortalTracking() {
  const { group, isGsiAdmin } = usePortal()
  const pathname = usePathname()

  // Name the admin, not just the device: without identify, the same person
  // on two browsers counts twice and one browser shared by two admins
  // counts once. The Supabase user id is the identity; no email is sent.
  useEffect(() => {
    if (!group?.id) return
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.user?.id) return
      posthog.identify(session.user.id, { employer_group_id: group.id, is_gsi_admin: isGsiAdmin })
    })
    return () => { cancelled = true }
  }, [group?.id, isGsiAdmin])

  useEffect(() => {
    if (!group?.id || !pathname) return
    const props = {
      employer_group_id: group.id,
      employer_slug: group.slug ?? null,
      is_gsi_admin: isGsiAdmin,
    }
    posthog.register_for_session(props)
    // /shift/employers/portal/share-kit -> "share-kit"; the root -> "home"
    const page = pathname.replace(/^\/shift\/employers\/portal\/?/, '').split('/')[0] || 'home'
    posthog.capture('portal_page_viewed', { ...props, page })
  }, [group?.id, group?.slug, isGsiAdmin, pathname])

  return null
}
