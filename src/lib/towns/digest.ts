import 'server-only'
import { withUtm } from '@/lib/utm'
import {
  buildFeaturedCandidates,
  dateOnlyChip,
  wallTime,
  type FeaturedItem,
} from '@/lib/towns/civic-featured'
import type {
  TownCivicEvent,
  TownEvent,
  TownPartner,
  TownResource,
  TownSummary,
} from '@/lib/towns/queries'

/**
 * Town digest email — "the town page, delivered."
 *
 * Content contract (agreed with Keith 2026-07-14, after the v1 critique):
 *  - Lede states the specific thing; never "something's happening."
 *  - The featured item uses the organizer's own noun (public meeting /
 *    hearing / open house…), never our imposed "hearing."
 *  - "How to weigh in": one line per real channel the item actually has.
 *  - Community events are FUN, not civic duty — "Happening around {Town}."
 *  - Every section ends in a "see more" link into its town-page section.
 *  - Stats explain themselves; no bare "shift rate" / "active trips" jargon.
 *  - Real branding: hosted wordmark PNG + Bricolage via web fonts.
 *
 * The selection logic is shared with the town page (civic-featured.ts,
 * queries.ts) so the email and the page can never drift.
 */

const SITE = 'https://www.gogreenstreets.org'
const WORDMARK_URL = `${SITE}/assets/wayfinding/shift-wordmark.png`
export const UNSUB_PLACEHOLDER = '%%UNSUB_URL%%'

const STATE_NAMES: Record<string, string> = {
  MA: 'Massachusetts', NH: 'New Hampshire', RI: 'Rhode Island', CT: 'Connecticut',
  VT: 'Vermont', ME: 'Maine', NY: 'New York', NJ: 'New Jersey', PA: 'Pennsylvania',
}

const FONT_DISPLAY = "'Bricolage Grotesque','Trebuchet MS','Helvetica Neue',Arial,sans-serif"
const FONT_BODY = "'DM Sans','Helvetica Neue',Arial,sans-serif"

export interface TownDigestContent {
  subject: string
  preheader: string
  /** Full email HTML with UNSUB_PLACEHOLDER where the per-subscriber unsubscribe URL goes. */
  html: string
  /** infrastructure_hearings ids included — the send-log idempotency set. */
  itemIds: string[]
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  const cut = str.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)}…`
}

/**
 * Scraped titles often lead with the towns ("Somerville and Cambridge -
 * Bridge replacement on …"). The email already names the town everywhere,
 * so strip that prefix when it's only town names.
 */
export function shortCivicTitle(item: TownCivicEvent, townNames: string[]): string {
  const sep = ' - '
  const idx = item.title.indexOf(sep)
  if (idx > 0) {
    const prefix = item.title.slice(0, idx).toLowerCase()
    const prefixIsTowns = prefix
      .split(/,|and/)
      .every((p) => p.trim() === '' || townNames.some((t) => t.toLowerCase() === p.trim()))
    if (prefixIsTowns) return item.title.slice(idx + sep.length)
  }
  return item.title
}

/**
 * The organizer's own noun for the event — scanned from the item's text.
 * Keith 07-14: "we refer to the meeting as a 'hearing,' but the hosts
 * themselves do not." Default is the most neutral term.
 */
export function meetingNoun(item: TownCivicEvent): string {
  const text = `${item.title} ${item.description ?? ''}`.toLowerCase()
  if (/\bhearing\b/.test(text)) return 'public hearing'
  if (/open house/.test(text)) return 'open house'
  if (/listening session/.test(text)) return 'listening session'
  if (/\bworkshop\b/.test(text)) return 'workshop'
  if (/information session/.test(text)) return 'information session'
  if (/\bwebinar\b/.test(text)) return 'webinar'
  return 'public meeting'
}

function weekdayName(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

/** "Tue, Jul 15" for community events (date-only, no TZ round-trip). */
function eventDateLabel(e: TownEvent): string {
  if (e.recurring_weekday) return `${e.recurring_weekday}s`
  return dateOnlyChip(e.event_date)
}

function hostLabel(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function buildTownDigest(opts: {
  town: TownSummary
  qualifyingCount: number
  /** Published, upcoming, NOT previously sent to this town. */
  civic: TownCivicEvent[]
  resources: TownResource[]
  events: TownEvent[]
  partners: TownPartner[]
  /** Prior send count for this town — drives partner rotation. */
  priorSendCount: number
  /** Selection clock — dry-run rewinds it so a just-passed item still renders. */
  now?: number
  /** Selection window — dry-run widens it so the rewound clock still covers upcoming items. */
  horizonDays?: number
}): TownDigestContent | null {
  const { town, qualifyingCount, civic, resources, events, partners, priorSendCount, now = Date.now(), horizonDays = 30 } = opts
  const townName = town.town_name
  const slug = town.slug

  const linkFor = (content: string) => (url: string | null) =>
    withUtm(url, { source: 'town_digest', medium: 'email', campaign: slug, content }) ?? '#'
  const townUrl = (content: string, anchor = '') =>
    linkFor(content)(`${SITE}/shift/towns/${slug}`) + anchor

  // The digest trigger is a new pipeline item — the featured card must be
  // civic. Dated town_resources rows may ride along as "also" rows.
  const { candidates } = buildFeaturedCandidates(civic, resources, linkFor('featured'), now, horizonDays)
  const featured = candidates.find((c) => c.civic)
  if (!featured?.civic) return null
  const also = candidates.filter((c) => c !== featured).slice(0, 2)
  const item = featured.civic
  const itemIds = [item.id, ...also.map((a) => a.civic?.id).filter((id): id is string => !!id)]

  const noun = meetingNoun(item)
  const title = shortCivicTitle(item, [...(item.affected_towns ?? []), item.municipality, townName])
  const time = wallTime(item.hearing_time)

  // Chip: "Mon, Jul 14 · 7:00 PM ET · virtual public meeting"
  const typeWord = item.hearing_type === 'virtual' ? 'virtual ' : item.hearing_type === 'hybrid' ? 'hybrid ' : ''
  const chip = item.hearing_date
    ? `${dateOnlyChip(item.hearing_date)}${time ? ` · ${time} ET` : ''} · ${typeWord}${noun}`
    : `Comments open through ${dateOnlyChip(item.comment_deadline!)}`

  // Subject + lede state the thing.
  const shortT = truncate(title, 64)
  const subjectTail = item.hearing_date
    ? ` — weigh in ${weekdayName(item.hearing_date)}`
    : item.comment_deadline
      ? ` — comments due ${dateOnlyChip(item.comment_deadline).replace(/^\w+, /, '')}`
      : ''
  const subject = `${townName}: ${shortT}${subjectTail}`
  const h1 = item.hearing_date
    ? `${title} — and ${townName} gets a say.`
    : `${title} — ${townName} can weigh in through ${dateOnlyChip(item.comment_deadline!)}.`

  // "How to weigh in" — one line per real channel. Hybrid meetings list both.
  const weighIn: string[] = []
  if (item.virtual_link) {
    weighIn.push(
      `<a href="${linkFor('featured_register')(item.virtual_link)}" style="color:#191A2E;">Join the ${item.hearing_type === 'virtual' ? 'virtual ' : ''}${noun} online</a> — registration takes a minute`,
    )
  }
  if (item.hearing_date && item.hearing_type !== 'virtual') {
    const where = item.hearing_location_name ? ` at ${escapeHtml(item.hearing_location_name)}` : ''
    weighIn.push(`${item.virtual_link ? 'Or show' : 'Show'} up in person${where}${time ? ` — ${weekdayName(item.hearing_date)} at ${time}` : ''}`)
  }
  if (item.access_notes) {
    weighIn.push(escapeHtml(item.access_notes))
  }
  if (item.comment_deadline) {
    weighIn.push(
      item.comment_email
        ? `Can’t make it? Email comments to <a href="mailto:${escapeHtml(item.comment_email)}" style="color:#191A2E;">${escapeHtml(item.comment_email)}</a> by ${dateOnlyChip(item.comment_deadline)}`
        : `Written comments are accepted through ${dateOnlyChip(item.comment_deadline)}`,
    )
  }
  const noticeHost = hostLabel(item.source_url)
  if (item.source_url) {
    weighIn.push(
      `<a href="${linkFor('featured_notice')(item.source_url)}" style="color:#191A2E;">Read the full notice${noticeHost ? ` on ${escapeHtml(noticeHost)}` : ''}</a>`,
    )
  }

  const ctaHref = item.virtual_link
    ? linkFor('featured_cta')(item.virtual_link)
    : item.source_url
      ? linkFor('featured_cta')(item.source_url)
      : townUrl('featured_cta', '#involved')
  const ctaLabel = item.action_label ??
    (item.virtual_link ? `Register for the ${noun}` : item.comment_deadline ? 'Submit a comment' : 'See the details')

  // Community events — fun, not duty.
  const eventPicks = events.slice(0, 3)
  const eventTag = (e: TownEvent) => {
    const nice: string[] = []
    if (e.tags.includes('free')) nice.push('free')
    if (e.tags.includes('family_friendly')) nice.push('family-friendly')
    return nice.length ? ` — ${nice.join(', ')}` : ''
  }

  // One Rewards Partner, rotating per send.
  const partner = partners.length > 0 ? partners[priorSendCount % partners.length] : null

  // Pulse — self-explaining, rank included when the town has one.
  const trips = Math.round(town.active_trips_month).toLocaleString('en-US')
  const stateName = STATE_NAMES[town.state] ?? town.state
  const rankClause = town.rank > 0 ? ` — ranked #${town.rank} of ${qualifyingCount} ${stateName} towns` : ''

  const preheaderBits: string[] = []
  if (eventPicks[0]) preheaderBits.push(truncate(eventPicks[0].title, 44))
  if (eventPicks[1]) preheaderBits.push(truncate(eventPicks[1].title, 44))
  if (partner) preheaderBits.push(`a local perk from ${partner.name}`)
  const preheader = preheaderBits.length
    ? `Plus: ${preheaderBits.join(', ')}.`
    : `How to make your voice count in ${townName}.`

  const alsoSection = also.length
    ? `<tr><td style="padding:0 32px 24px;">
        <p style="margin:0 0 8px;font-family:${FONT_DISPLAY};font-size:12px;font-weight:700;letter-spacing:0.1em;color:#5A5C6E;">ALSO WORTH YOUR VOICE</p>
        ${also.map((a) => `<p style="margin:0 0 6px;font-size:14px;color:#3A3C4E;"><b style="color:#191A2E;">${escapeHtml(a.chip)}</b> · <a href="${a.href}" style="color:#3A3C4E;">${escapeHtml(truncate(a.title, 90))}</a></p>`).join('\n')}
      </td></tr>`
    : ''

  const eventsSection = eventPicks.length
    ? `<tr><td style="padding:0 32px 24px;">
        <p style="margin:0 0 10px;font-family:${FONT_DISPLAY};font-size:16px;font-weight:700;color:#191A2E;">Happening around ${escapeHtml(townName)}</p>
        ${eventPicks.map((e) => `<p style="margin:0 0 7px;font-size:14px;line-height:1.5;color:#3A3C4E;"><b style="color:#191A2E;">${escapeHtml(eventDateLabel(e))}</b> · ${escapeHtml(e.title)}${e.location_name ? ` — ${escapeHtml(e.location_name)}` : ''}${eventTag(e)}</p>`).join('\n')}
        <p style="margin:10px 0 0;font-size:13px;"><a href="${townUrl('events_more', '#events')}" style="color:#2966E5;font-weight:700;text-decoration:none;">See all events near ${escapeHtml(townName)} &rarr;</a></p>
      </td></tr>`
    : ''

  const perkSection = partner
    ? `<tr><td style="padding:0 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F1;border-radius:12px;"><tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-family:${FONT_DISPLAY};font-size:12px;font-weight:700;letter-spacing:0.1em;color:#2D6A4F;">A LOCAL PERK</p>
          <p style="margin:0;font-size:14px;line-height:1.55;color:#3A3C4E;"><b style="color:#191A2E;">${escapeHtml(partner.name)}</b>${partner.discount_description ? ` — ${escapeHtml(partner.discount_description.trim().replace(/\.$/, ''))}` : ''}. One of ${partners.length} ${escapeHtml(townName)} businesses that thank you for arriving car-free, through the free Shift app.</p>
          <p style="margin:8px 0 0;font-size:13px;"><a href="${townUrl('rewards_more', '#rewards')}" style="color:#2D6A4F;font-weight:700;text-decoration:none;">See all ${escapeHtml(townName)} Rewards Partners &rarr;</a></p>
        </td></tr></table>
      </td></tr>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
</style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:${FONT_BODY};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <!-- Header: real wordmark on a light band -->
  <tr>
    <td style="padding:22px 32px 18px;border-bottom:3px solid #191A2E;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><img src="${WORDMARK_URL}" alt="Shift" width="110" style="display:block;" /></td>
        <td align="right" style="font-family:${FONT_DISPLAY};font-size:11px;font-weight:700;letter-spacing:0.14em;color:#5A5C6E;vertical-align:middle;">YOUR ${escapeHtml(townName.toUpperCase())} UPDATE</td>
      </tr></table>
    </td>
  </tr>
  <!-- Lede -->
  <tr>
    <td style="padding:28px 32px 8px;">
      <p style="margin:0 0 6px;font-family:${FONT_DISPLAY};font-size:12px;font-weight:700;letter-spacing:0.12em;color:#2966E5;">WORTH YOUR VOICE</p>
      <h1 style="margin:0;font-family:${FONT_DISPLAY};font-size:25px;font-weight:800;letter-spacing:-0.02em;line-height:1.18;color:#191A2E;">${escapeHtml(h1)}</h1>
    </td>
  </tr>
  <!-- Featured item -->
  <tr>
    <td style="padding:18px 32px 22px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #E3B23C;background:#FDF8EC;border-radius:12px;"><tr><td style="padding:20px 22px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#8a6612;">${escapeHtml(chip)}</p>
        ${item.description ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#3A3C4E;">${escapeHtml(truncate(item.description, 420))}</p>` : ''}
        ${weighIn.length ? `<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;color:#8a6612;font-family:${FONT_DISPLAY};">HOW TO WEIGH IN</p>
        ${weighIn.map((w) => `<p style="margin:0 0 3px;font-size:14px;line-height:1.5;color:#3A3C4E;">&bull;&nbsp; ${w}</p>`).join('\n')}` : ''}
        <table cellpadding="0" cellspacing="0" style="margin:14px 0 0;"><tr><td style="background:#191A2E;border-radius:999px;">
          <a href="${ctaHref}" style="display:inline-block;padding:11px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;font-family:${FONT_BODY};">${escapeHtml(ctaLabel)} &rarr;</a>
        </td></tr></table>
      </td></tr></table>
    </td>
  </tr>
  ${alsoSection}
  ${eventsSection}
  ${perkSection}
  <!-- Pulse -->
  <tr>
    <td style="padding:0 32px 26px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#3A3C4E;border-top:1px solid #E5E7EB;padding-top:16px;">${escapeHtml(townName)} neighbors on Shift have logged <b style="color:#191A2E;">${trips} walking, biking, and transit trips</b> so far this month${escapeHtml(rankClause)}. <a href="${townUrl('pulse')}" style="color:#2966E5;font-weight:700;text-decoration:none;">See how ${escapeHtml(townName)} moves &rarr;</a></p>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background:#191A2E;padding:18px 32px;text-align:center;">
      <p style="margin:0 0 5px;font-size:12px;color:rgba(255,255,255,0.78);">You asked for occasional ${escapeHtml(townName)} updates &mdash; only when something matters.</p>
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.78);"><a href="${UNSUB_PLACEHOLDER}" style="color:rgba(255,255,255,0.78);">Unsubscribe</a> &nbsp;&middot;&nbsp; <a href="${SITE}" style="color:rgba(255,255,255,0.78);text-decoration:none;">Green Streets Initiative</a> &nbsp;&middot;&nbsp; Want your trips to count too? <a href="${linkFor('install')(`${SITE}/shift`)}" style="color:rgba(255,255,255,0.78);">Shift is free</a></p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return { subject, preheader, html, itemIds }
}
