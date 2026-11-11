'use client'

import { useCallback, useEffect, useRef } from 'react'

/*
 * Cloudflare Turnstile for the email sign-up forms (Shift product item 33;
 * the server side is in lib/signup-guard and Shift's email-subscriptions
 * function). Real people almost never see it: the widget runs in the
 * background and shows a checkbox only when Cloudflare is unsure.
 *
 * The script loads the first time someone touches the form (focus), not with
 * the page, so pages don't pay for it. `token()` waits briefly for the answer
 * and then resets the widget, since each token works once.
 *
 * With no site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY), nothing loads and the
 * token is empty; the dev server uses Cloudflare's always-pass test key.
 */

const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  (process.env.NODE_ENV === 'development' ? '1x00000000000000000000AA' : '')
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const WAIT_MS = 8000

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  getResponse: (id: string) => string | undefined
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let loading: Promise<Turnstile | null> | null = null
function load(): Promise<Turnstile | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = SRC
    s.async = true
    s.onload = () => resolve(window.turnstile ?? null)
    s.onerror = () => {
      loading = null
      resolve(null)
    }
    document.head.appendChild(s)
  })
  return loading
}

export function useTurnstile() {
  const boxRef = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)

  /** Start the check in the background (call on focus). */
  const prime = useCallback(async () => {
    if (!SITE_KEY || widget.current || !boxRef.current) return
    const ts = await load()
    if (!ts || widget.current || !boxRef.current) return
    widget.current = ts.render(boxRef.current, {
      sitekey: SITE_KEY,
      appearance: 'interaction-only',
      'refresh-expired': 'auto',
      size: 'flexible',
    })
  }, [])

  /** The token to send with the sign-up ('' when Turnstile is off or never answered). */
  const token = useCallback(async (): Promise<string> => {
    if (!SITE_KEY) return ''
    await prime()
    const ts = window.turnstile
    const id = widget.current
    if (!ts || !id) return ''
    const start = Date.now()
    let t = ts.getResponse(id) ?? ''
    while (!t && Date.now() - start < WAIT_MS) {
      await new Promise((r) => setTimeout(r, 200))
      t = ts.getResponse(id) ?? ''
    }
    if (t) ts.reset(id)
    return t
  }, [prime])

  useEffect(
    () => () => {
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    },
    [],
  )

  return { boxRef, prime, token }
}
