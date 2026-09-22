'use client'

import posthog from 'posthog-js'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { normalizePartnerSlug } from '@/lib/nearby/partner'

/**
 * Web analytics into the SAME PostHog project as the Shift app (436603), so
 * web → install → app funnels connect. The key is a public client token
 * (same one the app ships); env can override but the default keeps prod
 * working without Vercel env coordination.
 *
 * App Router note: posthog-js only auto-captures the initial load, so client
 * navigations send $pageview manually from the pathname effect below. That
 * effect is also where partner co-brand attribution is registered, so every
 * event of the visit carries it regardless of which page fired it.
 */
const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_tZDqVkUx4TmwYokjRBVLpEBpycp4PZWCr9bWEbN3SBpb'

function PageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Init AFTER hydration: module-scope init injected the posthog <script>
  // into the DOM before React hydrated, producing a hydration mismatch
  // (and breaking sibling client components' effects). useEffect runs
  // post-hydration, so React's tree is settled first.
  useEffect(() => {
    if (!posthog.__loaded) {
      posthog.init(POSTHOG_KEY, {
        api_host: 'https://us.i.posthog.com',
        capture_pageview: false, // manual below — SPA navigations
        capture_pageleave: true,
        persistence: 'localStorage+cookie',
        respect_dnt: true,
        // Log every capture to the console in dev so CTA events can be
        // verified without decoding compressed request bodies.
        debug: process.env.NODE_ENV === 'development',
        // PostHog's loader injects its remote-config <script> before the
        // document's FIRST script tag — the town pages' JSON-LD block —
        // which breaks React's streamed hydration. This flag disables all
        // external script injection (we don't use session recording or
        // surveys; events/autocapture are unaffected).
        disable_external_dependency_loading: true,
        // We don't run surveys; without this, posthog-js still tries to load
        // surveys.js and logs an error every page load.
        disable_surveys: true,
      })
    }
  }, [])

  useEffect(() => {
    if (!pathname) return

    // Partner attribution, BEFORE the pageview so the pageview itself carries
    // it. A co-branded link (?partner=slug) tags the whole visit, not only the
    // pages still holding the param: without this the only way to measure a
    // partner was matching $current_url LIKE '%partner=%', which quietly lost
    // anyone who tapped through to a guide, /commute-advisor or /shift —
    // exactly the steps a partner most wants counted.
    const slug = normalizePartnerSlug(searchParams?.get('partner'))
    if (slug) {
      // Session-scoped: this visit's behaviour belongs to this partner.
      posthog.register_for_session({ partner: slug })
      // First touch persists, so an install days later still credits the
      // partner who made the introduction. register_once never overwrites,
      // so the first partner a person ever arrives through keeps the credit.
      posthog.register_once({ partner_first_touch: slug })
    }

    let url = window.origin + pathname
    const qs = searchParams?.toString()
    if (qs) url += `?${qs}`
    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return null
}

export default function PostHogProvider() {
  return (
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  )
}
