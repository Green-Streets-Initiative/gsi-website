'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'gsi.events.saved'

/**
 * Bookmarked event ids, persisted in localStorage. Loads after mount so the
 * server render and first client paint agree (nothing saved), then writes on
 * every change. Storage failures (private mode, quota) are swallowed.
 */
export function useSavedEvents() {
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)
  const savedRef = useRef(saved)
  savedRef.current = saved

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const ids = JSON.parse(raw)
        if (Array.isArray(ids)) {
          setSaved(Object.fromEntries(ids.filter((x) => typeof x === 'string').map((id) => [id, true])))
        }
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.keys(saved))) } catch { /* ignore */ }
  }, [saved, hydrated])

  /** Returns true when the event is now saved, false when it was removed. */
  const toggle = useCallback((id: string): boolean => {
    const nowSaved = !savedRef.current[id]
    setSaved((s) => {
      const next = { ...s }
      if (nowSaved) next[id] = true
      else delete next[id]
      return next
    })
    return nowSaved
  }, [])

  return { saved, toggle, count: Object.keys(saved).length }
}
