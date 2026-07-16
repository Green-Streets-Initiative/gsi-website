/**
 * One-off (reusable) bounce remediation for town digests.
 *
 * Re-sends a given day's digests to subscribers whose addresses bounced —
 * built for the 2026-07-16 fleet send, where every Apple private-relay
 * recipient bounced because the sender domain wasn't yet registered with
 * Apple's relay service (fixed by Keith same day).
 *
 * Reconstructs each town's email EXACTLY as the morning send: items come
 * from town_digest_sends.item_ids and partner rotation uses the send count
 * as of that send. Writes NO send-log rows (caps/idempotency untouched).
 *
 * Run from gsi-website root:
 *   NODE_OPTIONS='--conditions=react-server' npx tsx --env-file=.env.local scripts/resend-bounced-digests.ts 2026-07-16
 */
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildTownDigest, PROXIMITY_PLACEHOLDER, UNSUB_PLACEHOLDER } from '../src/lib/towns/digest'
import { signTownDigestUnsubToken } from '../src/lib/town-digest-token'
import {
  getTownCentroid,
  getTownDirectory,
  getTownEvents,
  getTownPartners,
  getTownResources,
  type TownCivicEvent,
} from '../src/lib/towns/queries'

const DAY = process.argv[2]
if (!/^\d{4}-\d{2}-\d{2}$/.test(DAY ?? '')) {
  console.error('usage: … resend-bounced-digests.ts YYYY-MM-DD')
  process.exit(1)
}

const SITE = 'https://www.gogreenstreets.org'
const FROM = 'Green Streets Initiative <noreply@gogreenstreets.org>'
const REPLY_TO = 'info@gogreenstreets.org'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY!)

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 3958.8
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
function proximityLine(miles: number | null): string {
  if (miles == null || miles > 2.5) return ''
  const phrase = miles < 0.2
    ? 'This project is just a few blocks from your home.'
    : `This project is about ${miles < 1 ? miles.toFixed(1) : Math.round(miles * 2) / 2} miles from your home.`
  return `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2D6A4F;">${phrase}</p>`
}

async function main() {
  const directory = await getTownDirectory()
  const qualifyingCount = directory.filter((t) => t.rank > 0).length

  const { data: sends } = await sb
    .from('town_digest_sends')
    .select('town_slug, sent_at, item_ids')
    .gte('sent_at', `${DAY}T00:00:00Z`)
    .lt('sent_at', `${DAY}T23:59:59Z`)
  if (!sends?.length) throw new Error(`no sends logged on ${DAY}`)

  let total = 0
  for (const send of sends) {
    const town = directory.find((t) => t.slug === send.town_slug)
    if (!town) continue

    // Bounced cohort: relay subscribers (all relay deliveries failed that day).
    const { data: subs } = await sb
      .from('town_digest_subscribers')
      .select('email, user_id, source')
      .eq('town_slug', send.town_slug)
      .is('unsubscribed_at', null)
      .like('email', '%@privaterelay.appleid.com')
    if (!subs?.length) {
      console.log(`${send.town_slug}: no relay subscribers, skipping`)
      continue
    }

    // Exact morning content: items by id; rotation as of that send.
    const { data: items } = await sb
      .from('infrastructure_hearings')
      .select('id, title, description, hearing_date, hearing_time, hearing_type, hearing_location_name, virtual_link, source_url, comment_deadline, comment_email, action_label, municipality, affected_towns, access_notes, digest_headline, lat, lng')
      .in('id', send.item_ids ?? [])
    const { count: priorCount } = await sb
      .from('town_digest_sends')
      .select('id', { count: 'exact', head: true })
      .eq('town_slug', send.town_slug)
      .lt('sent_at', send.sent_at)

    const centroid = await getTownCentroid(town.group_id)
    const [events, partners, resources] = await Promise.all([
      getTownEvents(centroid, 3),
      getTownPartners(town.town_name),
      getTownResources(town.group_id),
    ])
    const content = buildTownDigest({
      town,
      qualifyingCount,
      civic: (items ?? []) as TownCivicEvent[],
      resources,
      events,
      partners,
      priorSendCount: priorCount ?? 0,
      // Same day re-send: default clock reproduces the morning selection.
    })
    if (!content) {
      console.log(`${send.town_slug}: content rebuild came up empty, skipping`)
      continue
    }

    const userIds = subs.map((s) => s.user_id).filter((id): id is string => !!id)
    const homeByUser = new Map<string, { lat: number; lng: number }>()
    if (userIds.length) {
      const { data: homes } = await sb.from('users').select('id, home_lat, home_lng').in('id', userIds).not('home_lat', 'is', null)
      for (const u of homes ?? []) homeByUser.set(u.id as string, { lat: Number(u.home_lat), lng: Number(u.home_lng) })
    }

    for (const s of subs) {
      const token = signTownDigestUnsubToken(s.email.toLowerCase(), send.town_slug)
      const unsubUrl = `${SITE}/api/towns/unsubscribe?token=${token}`
      const home = s.user_id ? homeByUser.get(s.user_id) : undefined
      const miles = home && content.featuredLat != null && content.featuredLng != null
        ? haversineMiles(home.lat, home.lng, content.featuredLat, content.featuredLng)
        : null
      let html = (s.source === 'app_auto' ? content.htmlAppAuto : content.html)
        .replaceAll(UNSUB_PLACEHOLDER, unsubUrl)
        .replace(PROXIMITY_PLACEHOLDER, proximityLine(miles))
      for (const [itemId, loc] of Object.entries(content.itemLocations)) {
        const d = home ? haversineMiles(home.lat, home.lng, loc.lat, loc.lng) : null
        const tag = d != null && d <= 2.5
          ? ` <span style="color:#2D6A4F;font-weight:700;">· ${d < 0.2 ? 'a few blocks' : `${d < 1 ? d.toFixed(1) : Math.round(d * 2) / 2} mi`} from home</span>`
          : ''
        html = html.replace(`%%PROXALSO:${itemId}%%`, tag)
      }
      const res = await resend.emails.send({
        from: FROM,
        to: s.email,
        replyTo: REPLY_TO,
        subject: content.subject,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })
      if (res.error) console.error(`  FAIL ${send.town_slug} ${s.email}: ${res.error.message}`)
      else total++
      await new Promise((r) => setTimeout(r, 150))
    }
    console.log(`${send.town_slug}: re-sent to ${subs.length} relay subscriber(s)`)
  }
  console.log(`done — ${total} re-sends accepted by Resend`)
}

main().catch((e) => { console.error(e); process.exit(1) })
