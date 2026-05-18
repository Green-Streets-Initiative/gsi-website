import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // For now, log to server console. Can pipe to Supabase or analytics later.
    console.log('[wayfinding-telemetry]', JSON.stringify(body))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
