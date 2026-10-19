import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildTownDigest, MANAGE_PLACEHOLDER, PROXIMITY_PLACEHOLDER, UNSUB_PLACEHOLDER } from '@/lib/towns/digest'
import {
  getTownCentroid,
  getTownCivicEvents,
  getTownDirectory,
  getTownPartners,
  getTownResources,
  type TownCivicEvent,
} from '@/lib/towns/queries'
import { getEventPicks } from '@/lib/towns/event-picks'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Town digest sender (E19). Event-driven: a town gets an email when a newly
 * published civic item affects it, assembled from the same query layer as
 * the public town page. Guardrails:
 *  - max 2 sends per town per rolling 30 days;
 *  - an item never emails the same town twice (town_digest_sends.item_ids);
 *  - towns with zero active subscribers are skipped;
 *  - ?dry_run=1&town=<slug> renders one town, emails ONLY the admin, writes
 *    nothing, and returns the HTML for review.
 *
 * Scheduled via vercel.json cron ONLY after Keith's copy sign-off.
 */

const FROM = 'Green Streets Initiative <noreply@gogreenstreets.org>'
const REPLY_TO = 'info@gogreenstreets.org'
const ADMIN_EMAIL = 'keith@gogreenstreets.org'
const SITE = 'https://www.gogreenstreets.org'
const FUNCTIONS = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`

/**
 * Subscribers come from Shift's one email subscription system (topic
 * town_digest, one row per address and town; product item 19 step 2): the
 * shared check email_recipients() decides who may get it (active, not
 * unsubscribed from everything), and email_link_sigs() signs each person's
 * "Stop … emails" and "Manage your emails" links exactly as Shift's own
 * emails are signed.
 */
type DigestSub = { id: string; email: string; user_id: string | null; source: string | null; params: { town_slug?: string } | null }
/** A made-up subscription for preview links: they land on "That link didn't work". */
const PREVIEW_SUB = '00000000-0000-4000-8000-000000000000'
// Announcements + reminders share this budget (raised 2 → 3 when reminders
// landed, Keith 2026-08-04).
const MAX_SENDS_PER_30D = 3

interface SendRow {
  item_ids: string[] | null
  sent_at: string
  /** 'announcement' (first mention) or 'reminder' (the ~3-days-out second send). */
  kind: string | null
}

/** Meeting/deadline this many days out triggers the reminder send. */
const REMINDER_LEAD_DAYS = 3

/** Show "near your home" only when it's meaningfully close. */
const PROXIMITY_MAX_MILES = 2.5

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 3958.8
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function proximityLine(miles: number | null): string {
  if (miles == null || miles > PROXIMITY_MAX_MILES) return ''
  const phrase = miles < 0.2
    ? 'This project is just a few blocks from your home.'
    : `This project is about ${miles < 1 ? miles.toFixed(1) : Math.round(miles * 2) / 2} mile${miles >= 0.95 && miles < 1.05 ? '' : 's'} from your home.`
  return `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2D6A4F;">${phrase}</p>`
}

export async function GET(req: Request) {
  const startedAt = new Date()
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return new Response('CRON_SECRET not set', { status: 500 })
  if (auth !== `Bearer ${expected}`) return new Response('unauthorized', { status: 401 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return new Response('RESEND_API_KEY not set', { status: 500 })
  const resend = new Resend(apiKey)
  const sb = createServerSupabaseClient()

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry_run') === '1'
  const onlyTown = url.searchParams.get('town')

  const directory = await getTownDirectory()
  const qualifyingCount = directory.filter((t) => t.rank > 0).length

  let slugs: string[]
  if (onlyTown) {
    slugs = [onlyTown]
  } else {
    const { data: subTowns, error } = await sb.rpc('email_recipients', { p_topic: 'town_digest' })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    slugs = [...new Set(((subTowns ?? []) as DigestSub[]).map((r) => r.params?.town_slug).filter((x): x is string => !!x))]
  }

  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const results: Record<string, unknown>[] = []
  let previewHtml: string | null = null

  for (const slug of slugs) {
    const town = directory.find((t) => t.slug === slug)
    if (!town) {
      results.push({ town: slug, error: 'unknown town slug' })
      continue
    }

    try {
      const { data: sends } = await sb
        .from('town_digest_sends')
        .select('item_ids, sent_at, kind')
        .eq('town_slug', slug)
      const sentItemIds = new Set(((sends ?? []) as SendRow[]).flatMap((s) => s.item_ids ?? []))
      const recentSends = ((sends ?? []) as SendRow[]).filter((s) => s.sent_at >= cutoff30).length
      if (!dryRun && recentSends >= MAX_SENDS_PER_30D) {
        results.push({ town: slug, skipped: `cap: ${recentSends} sends in last 30d` })
        continue
      }

      // Dry-run runs the SAME selection as a real send — a preview that
      // diverges from what will actually go out is worse than none (Keith
      // hit exactly that 2026-08-04: preview featured a July 14 webinar with
      // a dead Zoom link while the real send would feature the Reid
      // reminder). Only when the real selection has nothing does dry-run
      // fall back to a rewound "recently published" window for copy review,
      // clearly labeled in the subject.
      const allCivic: TownCivicEvent[] = await getTownCivicEvents(town.town_name)
      const civic: TownCivicEvent[] = allCivic.filter((c) => !sentItemIds.has(c.id))

      // Reminder pass (Keith 2026-08-04): an item announced weeks ago whose
      // meeting (or comment deadline) is now REMINDER_LEAD_DAYS out gets one
      // second email, featured this time — the Reid Overpass lesson: the
      // announcement landed 3 weeks early as a footnote, then silence.
      // Guardrails: previously-sent items only (fresh ones are announcements),
      // one reminder per item ever, nothing emailed to this town in the last
      // 7 days, and the send counts against the 30-day cap like any other.
      const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      const reminderTarget = new Date(Date.parse(`${todayEt}T12:00:00Z`) + REMINDER_LEAD_DAYS * 86400000)
        .toISOString().slice(0, 10)
      const remindedIds = new Set(
        ((sends ?? []) as SendRow[]).filter((s) => s.kind === 'reminder').flatMap((s) => s.item_ids ?? []),
      )
      const cutoff7 = new Date(Date.now() - 7 * 86400000).toISOString()
      const recentIds = new Set(
        ((sends ?? []) as SendRow[]).filter((s) => s.sent_at >= cutoff7).flatMap((s) => s.item_ids ?? []),
      )
      // Window (1..LEAD days out), not exact-day equality: a missed cron run
      // would otherwise skip an item permanently, and items already inside
      // the window when this shipped would never remind at all.
      const inWindow = (d: string | null) => !!d && d > todayEt && d <= reminderTarget
      const reminders = allCivic.filter((c) =>
        sentItemIds.has(c.id) &&
        c.digest_can_trigger !== false &&
        !remindedIds.has(c.id) &&
        !recentIds.has(c.id) &&
        (inWindow(c.hearing_date) || (!c.hearing_date && inWindow(c.comment_deadline))),
      )
      const isReminder = reminders.length > 0

      const centroid = await getTownCentroid(town.group_id)
      const [events, partners, resources] = await Promise.all([
        getEventPicks(centroid, 3),
        getTownPartners(town.town_name, town.state),
        getTownResources(town.group_id),
      ])

      let content = buildTownDigest({
        town,
        qualifyingCount,
        // Reminder items lead; unsent items may ride along (both get logged
        // as sent). Soonest-first selection naturally features the ~3-days-out
        // reminder unless something even sooner is brand new — also correct.
        civic: isReminder ? [...reminders, ...civic] : civic,
        resources,
        events,
        partners,
        priorSendCount: (sends ?? []).length,
      })
      // Copy-review fallback: nothing due today, so preview recent past
      // items with a rewound clock — labeled so it can't be mistaken for a
      // real upcoming send.
      let previewFallback = false
      if (!content && dryRun) {
        previewFallback = true
        content = buildTownDigest({
          town,
          qualifyingCount,
          civic: await recentlyPublishedCivic(sb, town.town_name, cutoff30),
          resources,
          events,
          partners,
          priorSendCount: (sends ?? []).length,
          now: Date.now() - 30 * 86400000,
          horizonDays: 60,
        })
      }
      if (!content) {
        results.push({ town: slug, skipped: 'no new published items' })
        continue
      }

      const { data: allSubs, error: subsErr } = await sb.rpc('email_recipients', { p_topic: 'town_digest' })
      if (subsErr) throw new Error(subsErr.message)
      const townSubs = ((allSubs ?? []) as DigestSub[]).filter((r) => r.params?.town_slug === slug)
      let recipients: Array<{ id: string; email: string; user_id: string | null; source: string }>
      if (dryRun) {
        // Preview carries a real proximity line: borrow the town's first
        // app-linked subscriber (usually Keith's own account). Its links are
        // made-up, so clicking them in the preview can't touch that person.
        const demo = townSubs.find((r) => r.user_id)
        recipients = [{ id: PREVIEW_SUB, email: ADMIN_EMAIL, user_id: demo?.user_id ?? null, source: 'town_page' }]
      } else {
        recipients = townSubs.map((r) => ({ id: r.id, email: r.email, user_id: r.user_id, source: r.source ?? 'town_page' }))
        if (recipients.length === 0) {
          results.push({ town: slug, skipped: 'no active subscribers' })
          continue
        }
      }

      // Home coordinates for app-linked recipients, one query — powers the
      // per-recipient "about X miles from your home" line when the featured
      // project has a location.
      const homeByUser = new Map<string, { lat: number; lng: number }>()
      const userIds = recipients.map((r) => r.user_id).filter((id): id is string => !!id)
      const anyLocations = (content.featuredLat != null && content.featuredLng != null) ||
        Object.keys(content.itemLocations).length > 0
      if (userIds.length > 0 && anyLocations) {
        const { data: homes } = await sb
          .from('users')
          .select('id, home_lat, home_lng')
          .in('id', userIds)
          .not('home_lat', 'is', null)
        for (const u of homes ?? []) {
          homeByUser.set(u.id as string, { lat: Number(u.home_lat), lng: Number(u.home_lng) })
        }
      }

      const { data: sigRows, error: sigErr } = await sb.rpc('email_link_sigs', { p_subs: recipients.map((r) => r.id) })
      if (sigErr) throw new Error(`email_link_sigs: ${sigErr.message}`)
      const sigs = new Map(((sigRows ?? []) as { id: string; stop_sig: string; manage_sig: string }[]).map((x) => [x.id, x]))

      let sent = 0
      let errors = 0
      for (const r of recipients) {
        const sig = sigs.get(r.id)
        if (!sig?.stop_sig || !sig.manage_sig) throw new Error('missing link signature')
        const unsubUrl = `${FUNCTIONS}/email-subscriptions?a=stop&id=${r.id}&s=${sig.stop_sig}`
        const manageUrl = `${SITE}/email/manage?id=${r.id}&s=${sig.manage_sig}`
        const home = r.user_id ? homeByUser.get(r.user_id) : undefined
        const miles = home && content.featuredLat != null && content.featuredLng != null
          ? haversineMiles(home.lat, home.lng, content.featuredLat, content.featuredLng)
          : null
        let html = (r.source === 'app_auto' ? content.htmlAppAuto : content.html)
          .replaceAll(UNSUB_PLACEHOLDER, unsubUrl)
          .replaceAll(MANAGE_PLACEHOLDER, manageUrl)
          .replace(PROXIMITY_PLACEHOLDER, proximityLine(miles))
        for (const [itemId, loc] of Object.entries(content.itemLocations)) {
          const d = home ? haversineMiles(home.lat, home.lng, loc.lat, loc.lng) : null
          const tag = d != null && d <= PROXIMITY_MAX_MILES
            ? ` <span style="color:#2D6A4F;font-weight:700;">· ${d < 0.2 ? 'a few blocks' : `${d < 1 ? d.toFixed(1) : Math.round(d * 2) / 2} mi`} from home</span>`
            : ''
          html = html.replace(`%%PROXALSO:${itemId}%%`, tag)
        }
        if (dryRun && !previewHtml) previewHtml = html
        try {
          const res = await resend.emails.send({
            from: FROM,
            to: r.email,
            replyTo: REPLY_TO,
            subject: dryRun
              ? `[Preview — ${slug}${previewFallback ? ' — nothing due today; showing recent items' : ''}] ${content.subject}`
              : content.subject,
            html,
            headers: {
              'List-Unsubscribe': `<${unsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          })
          if (res.error) throw new Error(res.error.message)
          sent++
        } catch (err) {
          errors++
          console.error(`town-digest send failed (${slug}):`, err)
        }
      }

      if (!dryRun) {
        await sb.from('town_digest_sends').insert({
          town_slug: slug,
          item_ids: content.itemIds,
          subscriber_count: sent,
          error_count: errors,
          subject: content.subject,
          kind: isReminder ? 'reminder' : 'announcement',
        })
      }

      results.push({ town: slug, sent, errors, subject: content.subject, item_ids: content.itemIds, kind: isReminder ? 'reminder' : 'announcement', dry_run: dryRun })
    } catch (err) {
      results.push({ town: slug, error: String(err) })
    }
  }

  const errorCount = results.filter((r) => r.error).length
  const sentCount = results.reduce((n, r) => n + (typeof r.sent === 'number' ? (r.sent as number) : 0), 0)
  if (!dryRun) {
    // Same monitoring channel as the Shift repo's cron functions.
    await sb.rpc('record_cron_heartbeat', {
      p_function_name: 'town-digest',
      p_started_at: startedAt.toISOString(),
      p_finished_at: new Date().toISOString(),
      p_status: results.length === 0 ? 'no-op' : errorCount === 0 ? 'success' : 'partial',
      p_sent: sentCount,
      p_errors: errorCount,
      p_message: null,
    }).then(({ error }) => {
      if (error) console.error('town-digest heartbeat failed:', error.message)
    })
  }

  return Response.json({ ok: true, dry_run: dryRun, results, preview_html: previewHtml })
}

/** Dry-run item source: published in the last 30 days, upcoming or not. */
async function recentlyPublishedCivic(
  sb: ReturnType<typeof createServerSupabaseClient>,
  townName: string,
  cutoffIso: string,
): Promise<TownCivicEvent[]> {
  const { data } = await sb
    .from('infrastructure_hearings')
    .select('id, title, description, hearing_date, hearing_time, hearing_end_time, hearing_type, hearing_location_name, virtual_link, source_url, comment_deadline, comment_email, action_label, municipality, affected_towns, access_notes, digest_headline, community_name, whats_deciding, community_links, digest_can_trigger, lat, lng')
    .eq('status', 'published')
    .or(`municipality.eq.${townName},affected_towns.cs.{${townName}}`)
    .gte('published_at', cutoffIso)
    .order('hearing_date', { ascending: true, nullsFirst: false })
    .limit(20)
  return (data ?? []) as TownCivicEvent[]
}
