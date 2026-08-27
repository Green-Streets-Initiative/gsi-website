import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import WalkAuditClient from './client'

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
