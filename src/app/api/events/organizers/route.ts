import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Organizer suggestions for the submit form: active organizers whose name or
 * alias contains the typed text. Returns only what the form fills in, so the
 * table's contact details never leave the server.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return Response.json({ organizers: [] })

  const supabase = createServerSupabaseClient()
  const pattern = `%${q.replace(/[%_]/g, '')}%`
  const { data, error } = await supabase
    .from('event_organizers')
    .select('id, name, url, aliases')
    .eq('status', 'active')
    .ilike('name', pattern)
    .order('name')
    .limit(6)

  if (error) {
    console.error('organizer search error:', error)
    return Response.json({ organizers: [] })
  }

  return Response.json({
    organizers: (data ?? []).map((o) => ({ id: o.id as string, name: o.name as string, url: (o.url as string | null) ?? null })),
  })
}
