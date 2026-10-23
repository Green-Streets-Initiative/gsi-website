import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { looksLikeRideCode } from '@/lib/rides/public'
import { isPromoChannel } from '@/lib/rides/promo'

/**
 * A ride's per-channel short link from the Promote tab:
 * /r/<code>/<channel> counts one visit and sends the person to the ride page.
 * Link previews (Instagram, iMessage, Slack unfurls) fetch the link too; they
 * still get the redirect, so the preview shows the ride, but aren't counted.
 */
export const dynamic = 'force-dynamic'

const PREVIEW_BOT = /bot|crawl|spider|facebookexternalhit|meta-externalagent|whatsapp|slack|discord|telegram|twitter|linkedin|embedly|preview|skype|vkshare|pinterest|redditbot|applebot/i

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string; channel: string }> }) {
  const { code, channel } = await params
  if (!looksLikeRideCode(code)) return NextResponse.redirect(new URL('/events', req.url), 302)
  const via = isPromoChannel(channel) ? channel : null
  const target = new URL(`/rides/${code}`, req.url)
  if (via) target.searchParams.set('via', via)

  const ua = req.headers.get('user-agent') ?? ''
  if (via && req.method === 'GET' && !PREVIEW_BOT.test(ua)) {
    const { error } = await createServerSupabaseClient().rpc('log_ride_link_visit', { p_code: code, p_channel: via })
    if (error) console.error('log_ride_link_visit error:', error)
  }

  const res = NextResponse.redirect(target, 302)
  res.headers.set('cache-control', 'no-store')
  return res
}
