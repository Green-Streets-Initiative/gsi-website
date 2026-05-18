import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('wayfinding_businesses')
    .insert({ ...body, event_id: id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const supabase = createServerSupabaseClient()

  const { id: bizId, event_id: _eid, ...updates } = body

  const { data, error } = await supabase
    .from('wayfinding_businesses')
    .update(updates)
    .eq('id', bizId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bizId = searchParams.get('id')
  if (!bizId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('wayfinding_businesses')
    .delete()
    .eq('id', bizId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
