import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import WalkAuditResultsClient from './client'

export default async function WalkAuditResultsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createServerSupabaseClient()
  const { data } = await supabase.rpc('get_walk_audit_results', { p_organizer_token: token })

  if (!data || !data.audit) return notFound()

  return <WalkAuditResultsClient data={data} />
}
