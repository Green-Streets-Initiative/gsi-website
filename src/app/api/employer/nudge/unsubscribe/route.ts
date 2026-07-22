import { timingSafeEqual } from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { nudgeUnsubscribeSig } from '@/lib/employer-nudge'

export const runtime = 'nodejs'

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>
<body style="margin:0;padding:60px 24px;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;text-align:center;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:12px;padding:36px 28px;">
    <h1 style="margin:0 0 12px;font-size:20px;color:#191A2E;">${title}</h1>
    <p style="margin:0;font-size:14px;line-height:1.55;color:#5A5C6E;">${body}</p>
  </div>
</body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const groupId = url.searchParams.get('g')
  const userId = url.searchParams.get('u')
  const sig = url.searchParams.get('sig')

  if (!groupId || !userId || !sig) {
    return page('Something went wrong', 'This unsubscribe link is incomplete. Please use the link from your email.', 400)
  }

  const expected = nudgeUnsubscribeSig(groupId, userId)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return page('Something went wrong', 'This unsubscribe link is invalid or has expired.', 400)
  }

  const sb = createServerSupabaseClient()
  const { error } = await sb
    .from('group_members')
    .update({ nudge_opt_out: true })
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (error) {
    return page('Something went wrong', 'We could not process your request. Please try again, or email info@gogreenstreets.org.', 500)
  }

  return page(
    "You're unsubscribed",
    "You won't receive any more reminder emails from your workplace on Shift. You can keep using the app as usual.",
  )
}
