'use client'

import posthog from 'posthog-js'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

/**
 * Web analytics into the SAME PostHog project as the Shift app (436603), so
 * web → install → app funnels connect. The key is a public client token
 * (same one the app ships); env can override but the default keeps prod
 * working without Vercel env coordination.
 *
 * App Router note: posthog-js only auto-captures the initial load, so client
 * navigations send $pageview manually from the pathname effect below.
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
        // PostHog's loader injects its remote-config <script> before the
        // document's FIRST script tag — the town pages' JSON-LD block —
        // which breaks React's streamed hydration. This flag disables all
        // external script injection (we don't use session recording or
        // surveys; events/autocapture are unaffected).
        disable_external_dependency_loading: true,
      })
    }
  }, [])

  useEffect(() => {
    if (!pathname) return
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
