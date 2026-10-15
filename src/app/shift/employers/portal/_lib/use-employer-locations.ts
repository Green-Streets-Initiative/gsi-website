'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * An employer's locations (offices, branches), in display order. Location 1
 * is the main one: the Commute Advisor opens there, and the database keeps
 * employer_benefits.destination_* equal to it. Written only through the
 * set_employer_locations RPC (item 7, migration 01021).
 */
export type EmployerLocation = {
  id: string
  name: string | null
  address: string
  lat: number
  lng: number
  radius_m: number
  sort_order: number
  /**
   * "Arrive by": when people usually need to be in, "HH:MM" 24h local. The
   * Commute Advisor plans trips to arrive by it. Defaults to 09:00 until the
   * employer_locations.typical_start_time column (held migration) exists.
   */
  typical_start_time: string
}

export const DEFAULT_TYPICAL_START_TIME = '09:00'

/** "9:00" / "09:00" / "09:00:00" -> "09:00"; anything else -> the default. */
export function normalizeStartTime(v: unknown): string {
  if (typeof v !== 'string') return DEFAULT_TYPICAL_START_TIME
  const m = v.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return DEFAULT_TYPICAL_START_TIME
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return DEFAULT_TYPICAL_START_TIME
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

export type LocationDraft = {
  /** Set for a saved location, so saving keeps its id (and its ?location= links). */
  id?: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  /** "Arrive by", "HH:MM"; omitted means 09:00. */
  typical_start_time?: string
}

/** "Harvard Square" when named, else the street part of the address. */
export function locationTitle(l: { name: string | null; address: string }): string {
  return l.name?.trim() || l.address.split(',')[0]
}

export function useEmployerLocations(groupId: string | null | undefined) {
  const [locations, setLocations] = useState<EmployerLocation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchList = useCallback(async () => {
    if (!groupId) return null
    // typical_start_time is read on its own: until its held migration lands
    // the column does not exist, and that must not fail the whole list.
    const [{ data }, times] = await Promise.all([
      supabase
        .from('employer_locations')
        .select('id, name, address, lat, lng, radius_m, sort_order')
        .eq('group_id', groupId)
        .order('sort_order', { ascending: true })
        .limit(100),
      supabase
        .from('employer_locations')
        .select('id, typical_start_time')
        .eq('group_id', groupId)
        .limit(100)
        .then(({ data: rows, error }) => (error ? null : (rows as { id: string; typical_start_time: unknown }[] | null))),
    ])
    const timeById = new Map((times ?? []).map((t) => [t.id, normalizeStartTime(t.typical_start_time)]))
    return ((data ?? []) as Omit<EmployerLocation, 'typical_start_time'>[]).map((l) => ({
      ...l,
      typical_start_time: timeById.get(l.id) ?? DEFAULT_TYPICAL_START_TIME,
    }))
  }, [groupId])

  useEffect(() => {
    let cancelled = false
    fetchList().then((list) => {
      if (cancelled || !list) return
      setLocations(list)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchList])

  const reload = useCallback(async () => {
    const list = await fetchList()
    if (list) setLocations(list)
  }, [fetchList])

  /**
   * Replace the whole list. Returns an error message, or null on success.
   * `opts.onWarning` hears about the one thing that can fail on its own:
   * the arrive-by time, when its column or write path is not there yet. The
   * rest of the save still goes through.
   */
  const save = useCallback(
    async (drafts: LocationDraft[], opts?: { onWarning?: (message: string) => void }): Promise<string | null> => {
      if (!groupId) return 'No employer loaded.'
      if (drafts.some((d) => !d.address.trim() || d.lat == null || d.lng == null)) {
        return 'Pick each address from the suggestions so we know where it is on the map.'
      }
      const wanted = drafts.map((d) => normalizeStartTime(d.typical_start_time))
      const { data, error } = await supabase.rpc('set_employer_locations', {
        p_group_id: groupId,
        p_locations: drafts.map((d, i) => ({
          id: d.id ?? null,
          name: d.name.trim() || null,
          address: d.address.trim(),
          lat: d.lat,
          lng: d.lng,
          // Read by set_employer_locations once the held migration teaches it
          // the column; ignored by the version in production today.
          typical_start_time: wanted[i],
        })),
      })
      if (error) return 'Could not save locations. Try again in a moment.'
      if (!data?.ok) {
        return data?.reason === 'forbidden'
          ? 'Only admins can change locations.'
          : 'Could not save locations. Check each address and try again.'
      }
      const savedRaw = (data.locations ?? []) as (Omit<EmployerLocation, 'typical_start_time'> & { typical_start_time?: unknown })[]
      let saved: EmployerLocation[] = savedRaw.map((l) => ({ ...l, typical_start_time: normalizeStartTime(l.typical_start_time) }))

      // The RPC returns rows in order, so row i is draft i. Any time the RPC
      // did not keep is written directly (set_employer_locations writes a
      // fixed column list, so it drops the key). As of 2026-10-05 the
      // browser has no UPDATE grant on employer_locations (01021 revoked it;
      // 01028 and held 01131 add none back) and the column may not exist, so
      // a refusal here is a warning, not a failed save. The card keeps the
      // field read-only until that grant exists; this path then just works.
      const stale = saved
        .map((l, i) => ({ id: l.id, time: wanted[i] }))
        .filter((s, i) => s.time !== (saved[i]?.typical_start_time ?? DEFAULT_TYPICAL_START_TIME))
      if (stale.length > 0) {
        const results = await Promise.all(
          stale.map((s) =>
            supabase
              .from('employer_locations')
              .update({ typical_start_time: s.time })
              .eq('id', s.id)
              .eq('group_id', groupId)
              .then(({ error: e }) => (e ? null : s)),
          ),
        )
        const written = results.filter((r): r is { id: string; time: string } => r !== null)
        if (written.length > 0) {
          const byId = new Map(written.map((w) => [w.id, w.time]))
          saved = saved.map((l) => (byId.has(l.id) ? { ...l, typical_start_time: byId.get(l.id)! } : l))
        }
        if (written.length < stale.length) {
          opts?.onWarning?.(
            "Locations saved, but the arrive-by time didn't. That setting is still being switched on; it will keep once it is.",
          )
        }
      }
      setLocations(saved)
      return null
    },
    [groupId],
  )

  return { locations, loading, reload, save }
}
