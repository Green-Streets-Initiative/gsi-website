import { NextRequest, NextResponse } from 'next/server'
import { getShortlistProgress } from '@/lib/shortlist/server'
import { guard } from '../_shared'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = await guard(req)
  if (denied) return denied
  try {
    return NextResponse.json(await getShortlistProgress())
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
