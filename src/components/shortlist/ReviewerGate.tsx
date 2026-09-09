'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * Who is reviewing. The guide gate is a shared password, so the workspace
 * asks for a name once and sends it with every write; Keith sees it on each
 * suggestion. Kept in localStorage (one volunteer, one browser).
 */
const KEY = 'sfs-reviewer-name'

interface ReviewerContextValue {
  reviewer: string
  setReviewer: (name: string) => void
  /** JSON request with the reviewer injected; 401 sends the volunteer to log in. */
  request: <T = unknown>(
    url: string,
    body: Record<string, unknown>,
    method?: 'POST' | 'PATCH',
  ) => Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; data?: unknown }>
}

const ReviewerContext = createContext<ReviewerContextValue | null>(null)

function readName(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function ReviewerProvider({ children }: { children: React.ReactNode }) {
  const [reviewer, setReviewerState] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setReviewerState(readName())
    setHydrated(true)
  }, [])

  const setReviewer = useCallback((name: string) => {
    const t = name.trim().replace(/\s+/g, ' ')
    setReviewerState(t)
    try {
      if (t) localStorage.setItem(KEY, t)
      else localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const request = useCallback<ReviewerContextValue['request']>(
    async (url, body, method = 'POST') => {
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, reviewer }),
        })
        if (res.status === 401) {
          window.location.href = '/volunteer/guide/login'
          return { ok: false, error: 'Signed out', status: 401 }
        }
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          return {
            ok: false,
            error: (data && typeof data.error === 'string' && data.error) || `Request failed (${res.status})`,
            status: res.status,
            data,
          }
        }
        return { ok: true, data }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Network error', status: 0 }
      }
    },
    [reviewer],
  )

  return (
    <ReviewerContext.Provider value={{ reviewer, setReviewer, request }}>
      {children}
      {hydrated && !reviewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191A2E]/70 px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (draft.trim()) setReviewer(draft)
            }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="font-[family-name:var(--font-bricolage)] text-[22px] font-extrabold tracking-tight text-[#191A2E] m-0">
              Your name
            </h2>
            <p className="mt-1.5 mb-4 text-[14px] text-[#4A4D68]">
              It goes on every score and note you submit, so Keith knows whose judgment he&rsquo;s reading.
            </p>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="First and last name"
              maxLength={80}
              className="w-full rounded-lg border border-[#E4E2D9] px-3 py-2.5 text-[15px] text-[#191A2E] focus:border-[#2966E5] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="mt-4 w-full rounded-lg bg-[#2966E5] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#2159c7] disabled:opacity-50"
            >
              Start reviewing
            </button>
          </form>
        </div>
      )}
    </ReviewerContext.Provider>
  )
}

export function useReviewer(): ReviewerContextValue {
  const ctx = useContext(ReviewerContext)
  if (!ctx) throw new Error('useReviewer outside ReviewerProvider')
  return ctx
}
