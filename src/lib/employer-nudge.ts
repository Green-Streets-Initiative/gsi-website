import { createHmac } from 'crypto'

// Signs the employer-nudge unsubscribe link so the opt-out endpoint can't
// be used to flip arbitrary members' flags. Keyed off CRON_SECRET, which
// is already required by the employer email surface.
export function nudgeUnsubscribeSig(groupId: string, userId: string): string {
  return createHmac('sha256', process.env.CRON_SECRET ?? '')
    .update(`nudge-unsub:${groupId}:${userId}`)
    .digest('hex')
}
