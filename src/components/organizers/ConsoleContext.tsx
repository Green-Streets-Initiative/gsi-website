'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { errorText, getMe } from '@/lib/organizers/api'
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
 */
type Phase = 'checking' | 'signed_out' | 'no_access' | 'ready' | 'error'

interface ConsoleState {
  phase: Phase
  me: ConsoleMe | null
  /** The ride assistant is on for this person (Shift 01376). */
  assistant: boolean
  notice: string | null
  error: string | null
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
  const ran = useRef(-1)

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
              setPhase('signed_out')
              return
            }
          }
        }
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setPhase('signed_out')
          return
        }
        await loadMe()
      } catch (e) {
        setError(errorText(e, "We couldn't load your rides."))
        setPhase('error')
      }
    })()
  }, [attempt, loadMe])

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
    <Ctx.Provider value={{ phase, me, assistant, notice, error, clearNotice: () => setNotice(null), refreshMe, retry, signOut }}>
      {children}
    </Ctx.Provider>
  )
}
