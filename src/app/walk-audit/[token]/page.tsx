import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import WalkAuditClient from './client'

export interface BlockDef {
  i: number
  name: string | null
  mid: { lat: number; lng: number }
  start: { lat: number; lng: number }
  end: { lat: number; lng: number }
}

export interface BlockCheck {
  block_index: number
  block_name: string | null
  observer_name: string | null
  verdict: 'fine' | 'soso' | 'rough'
  created_at: string
}

export interface WalkAuditMeta {
  id: string
  title: string
  org_name: string | null
  purpose: string
  area_type: 'route' | 'location'
  area: { lat: number; lng: number }[] | { lat: number; lng: number }
  area_label: string | null
  city: string | null
  scheduled_for: string | null
  enabled_modules: string[]
  blocks: BlockDef[] | null
  hazards: {
    crash_clusters?: { lat: number; lng: number; crashCount?: number; type?: string }[]
    summary?: { cluster_count: number; total_crashes: number }
  } | null
  observations: unknown[]
  block_checks: BlockCheck[]
}

export default async function WalkAuditPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createServerSupabaseClient()
  const { data } = await supabase.rpc('get_walk_audit', { p_token: token })

  if (!data) return notFound()

  return <WalkAuditClient token={token} audit={data as WalkAuditMeta} />
}
