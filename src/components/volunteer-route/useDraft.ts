'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_FORM, type FormData } from './formModel'

// A photo that has already been uploaded (or is in flight). Only uploaded
// photos persist in the draft — File objects can't survive a refresh, so
// PhotoField uploads at selection time and the draft stores the result.
export interface DraftPhoto {
  path: string
  url: string
  caption: string
  lat?: number
  lng?: number
  accuracy?: number
  captured_at?: string
}

interface DraftState {
  v: number
  savedAt: string
  step: number
  form: FormData
  photos: DraftPhoto[]
}

// v2 adds the walk-audit borrowings (problem pins, measured seconds, new
// questions). v1 drafts still load — the DEFAULT_FORM merge fills new fields.
const DRAFT_VERSION = 2
const ACCEPTED_VERSIONS = [1, 2]

function draftKey(token: string) {
  return `shift-route-draft:${token}`
}

export function loadDraft(token: string): DraftState | null {
  try {
    const raw = localStorage.getItem(draftKey(token))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftState
    if (!ACCEPTED_VERSIONS.includes(parsed.v) || !parsed.form) return null
    // Merge over defaults so a form field added later doesn't come back undefined.
    return {
      ...parsed,
      form: { ...DEFAULT_FORM, ...parsed.form },
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
    }
  } catch {
    return null
  }
}

export function clearDraft(token: string) {
  try {
    localStorage.removeItem(draftKey(token))
  } catch {
    // ignore
  }
}

/** Debounced draft persistence. Call save() on every state change. */
export function useDraftSaver(token: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const save = useCallback(
    (step: number, form: FormData, photos: DraftPhoto[]) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        try {
          const state: DraftState = {
            v: DRAFT_VERSION,
            savedAt: new Date().toISOString(),
            step,
            form,
            photos,
          }
          localStorage.setItem(draftKey(token), JSON.stringify(state))
          setSavedAt(new Date())
        } catch {
          // Storage full or unavailable — the form still works, just no draft.
        }
      }, 800)
    },
    [token],
  )

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return { save, savedAt }
}
