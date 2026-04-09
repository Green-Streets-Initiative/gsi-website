import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const COOKIE_NAME = 'wmu_funder_token'

/**
 * Proxy for wmu-funder-dashboard-data Edge Function.
 * Reads the httpOnly cookie and forwards it as a Bearer token.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const page = req.nextUrl.searchParams.get('page') || '1'

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/wmu-funder-dashboard-data?page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
