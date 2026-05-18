import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  }

  const { data: event } = await supabase
    .from('wayfinding_events')
    .select('id, admin_token')
    .eq('slug', slug)
    .single()

  if (!event || event.admin_token !== token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, boolean> = {}

  if (typeof body.is_rain_date === 'boolean') updates.is_rain_date = body.is_rain_date
  if (typeof body.is_cancelled === 'boolean') updates.is_cancelled = body.is_cancelled

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('wayfinding_events')
    .update(updates)
    .eq('id', event.id)

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: updates })
}
