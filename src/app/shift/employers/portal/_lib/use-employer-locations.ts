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
}

export type LocationDraft = {
  /** Set for a saved location, so saving keeps its id (and its ?location= links). */
  id?: string
  name: string
  address: string
  lat: number | null
  lng: number | null
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
    const { data } = await supabase
      .from('employer_locations')
      .select('id, name, address, lat, lng, radius_m, sort_order')
      .eq('group_id', groupId)
      .order('sort_order', { ascending: true })
      .limit(100)
    return (data ?? []) as EmployerLocation[]
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

  /** Replace the whole list. Returns an error message, or null on success. */
  const save = useCallback(
    async (drafts: LocationDraft[]): Promise<string | null> => {
      if (!groupId) return 'No employer loaded.'
      if (drafts.some((d) => !d.address.trim() || d.lat == null || d.lng == null)) {
        return 'Pick each address from the suggestions so we know where it is on the map.'
      }
      const { data, error } = await supabase.rpc('set_employer_locations', {
        p_group_id: groupId,
        p_locations: drafts.map((d) => ({ id: d.id ?? null, name: d.name.trim() || null, address: d.address.trim(), lat: d.lat, lng: d.lng })),
      })
      if (error) return 'Could not save locations. Try again in a moment.'
      if (!data?.ok) {
        return data?.reason === 'forbidden'
          ? 'Only admins can change locations.'
          : 'Could not save locations. Check each address and try again.'
      }
      setLocations((data.locations ?? []) as EmployerLocation[])
      return null
    },
    [groupId],
  )

  return { locations, loading, reload, save }
}
