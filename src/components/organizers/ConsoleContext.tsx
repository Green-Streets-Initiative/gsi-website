'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { errorText, getMe, redeemLink } from '@/lib/organizers/api'
import { LINK_KEY, type LinkProblem } from '@/lib/organizers/first-ride'
import { track } from '@/lib/organizers/track'
import type { ConsoleMe } from '@/lib/organizers/types'

/**
 * Sign-in and access for the organizer console.
 *
 * Sign-in is the Shift account's own email link (signInWithOtp, the same
 * email the app sends). The link goes through shift.gogreenstreets.org/
 * auth/confirm, which hands the token back to this page as ?token_hash=,
 * and we redeem it here, as the employer portal does. The session lives in
 * this browser's storage.
 *
 * Access is organizer_console_me (Shift 01377): admins, invited or verified
 * organizers, and anyone who already organizes or leads a group ride.
 *
 * A personal console link (?link=, Shift 01588) is kept in this browser
 * until the person is signed in, redeemed once, and opens "Make your first
 * ride". It also rides in the sign-in email's return address, so a link
 * opened on the laptop and signed in on the phone still lands.
 */
type Phase = 'checking' | 'signed_out' | 'no_access' | 'ready' | 'error'

interface ConsoleState {
  phase: Phase
  me: ConsoleMe | null
  /** The ride assistant is on for this person (Shift 01376). */
  assistant: boolean
  notice: string | null
  error: string | null
  /** A personal link waiting for sign-in. */
  linkToken: string | null
  /** Why a personal link didn't open. */
  linkProblem: LinkProblem | null
  clearNotice: () => void
  refreshMe: () => Promise<void>
  retry: () => void
  signOut: () => Promise<void>
}

const Ctx = createContext<ConsoleState | null>(null)

export function useConsole(): ConsoleState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useConsole outside ConsoleProvider')
  return v
}

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [me, setMe] = useState<ConsoleMe | null>(null)
  const [assistant, setAssistant] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [linkProblem, setLinkProblem] = useState<LinkProblem | null>(null)
  const ran = useRef(-1)
  const router = useRouter()

  const loadMe = useCallback(async () => {
    const [m, a] = await Promise.all([getMe(), supabase.rpc('organizer_assistant_available')])
    setMe(m)
    setAssistant(a.data === true)
    setPhase(!m.signed_in ? 'signed_out' : m.allowed ? 'ready' : 'no_access')
  }, [])

  useEffect(() => {
    if (ran.current === attempt) return
    ran.current = attempt
    ;(async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const link = params.get('link')
        if (link) {
          if (/^[A-Za-z0-9_-]{16,64}$/.test(link)) {
            try { localStorage.setItem(LINK_KEY, link) } catch { /* kept below for this visit */ }
            setLinkToken(link)
            setLinkProblem(null)
          }
          params.delete('link')
          const rest = params.toString()
          window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
        }
        let token = link && /^[A-Za-z0-9_-]{16,64}$/.test(link) ? link : null
        try { token = token ?? localStorage.getItem(LINK_KEY) } catch { /* storage blocked */ }
        const tokenHash = params.get('token_hash')
        const type = params.get('type')
        if (tokenHash && (type === 'email' || type === 'magiclink')) {
          // 'email' covers a first sign-up's confirmation and a returning
          // sign-in alike (the portal's lesson).
          const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
          params.delete('token_hash')
          params.delete('type')
          const rest = params.toString()
          window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
          if (vErr) {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
              setNotice('That sign-in link has expired or was already used. Send yourself a new one.')
              setLinkToken(token)
              setPhase('signed_out')
              return
            }
          }
        }
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setLinkToken(token)
          setPhase('signed_out')
          return
        }
        if (token) {
          const r = await redeemLink(token)
          try { localStorage.removeItem(LINK_KEY) } catch { /* ignore */ }
          setLinkToken(null)
          if (r.ok) {
            track('organizer_link_redeemed', { again: !!r.already })
            // Go first, so the rides list doesn't flash before the landing.
            router.replace('/organizers/start')
            await loadMe()
            return
          }
          setLinkProblem(r.reason ?? 'not_found')
          track('organizer_link_refused', { reason: r.reason ?? 'not_found' })
        }
        await loadMe()
      } catch (e) {
        setError(errorText(e, "We couldn't load your rides."))
        setPhase('error')
      }
    })()
  }, [attempt, loadMe, router])

  // Signing out in another tab, or the session ending, returns here.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setMe(null)
        setPhase('signed_out')
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setMe(null)
    setPhase('signed_out')
  }, [])

  const refreshMe = useCallback(async () => {
    try { await loadMe() } catch { /* keep what we have */ }
  }, [loadMe])

  const retry = useCallback(() => {
    setError(null)
    setPhase('checking')
    setAttempt((a) => a + 1)
  }, [])

  return (
    <Ctx.Provider value={{ phase, me, assistant, notice, error, linkToken, linkProblem, clearNotice: () => setNotice(null), refreshMe, retry, signOut }}>
      {children}
    </Ctx.Provider>
  )
}
