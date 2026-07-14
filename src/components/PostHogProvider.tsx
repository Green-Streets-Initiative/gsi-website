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

if (typeof window !== 'undefined' && !posthog.__loaded) {
  posthog.init(POSTHOG_KEY, {
    api_host: 'https://us.i.posthog.com',
    capture_pageview: false, // manual below — SPA navigations
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    respect_dnt: true,
  })
}

function PageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
