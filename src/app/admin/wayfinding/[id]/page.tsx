import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import EventEditor from './editor'

export const dynamic = 'force-dynamic'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: event } = await supabase
    .from('wayfinding_events')
    .select('*')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const { data: businesses } = await supabase
    .from('wayfinding_businesses')
    .select('*')
    .eq('event_id', id)
    .order('name')

  return (
    <EventEditor event={event} businesses={businesses ?? []} />
  )
}
