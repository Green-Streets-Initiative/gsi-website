import { NextResponse } from 'next/server'
import { recordBlocked } from '@/lib/signup-guard'

/**
 * Retired (Shift product item 33, 2026-11-11). The town page sign-up now goes
 * through /api/email-subscribe, which has the bot checks every other sign-up
 * box has. This route had none: in Oct-Nov 2026 a script used it to add 50
 * strangers' addresses to Newton's town digest. Anything still posting here
 * is a script (no page has called it since), so it is counted and given the
 * usual answer, and nothing is saved.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { town?: unknown }
  await recordBlocked('retired_route', 'town_digest', body.town)
  return NextResponse.json({ ok: true })
}
