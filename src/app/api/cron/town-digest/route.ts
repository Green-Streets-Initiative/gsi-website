import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildTownDigest, UNSUB_PLACEHOLDER } from '@/lib/towns/digest'
import { signTownDigestUnsubToken } from '@/lib/town-digest-token'
import {
  getTownCentroid,
  getTownCivicEvents,
  getTownDirectory,
  getTownEvents,
  getTownPartners,
  getTownResources,
  type TownCivicEvent,
} from '@/lib/towns/queries'

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

const FROM = 'Shift <noreply@gogreenstreets.org>'
const REPLY_TO = 'info@gogreenstreets.org'
const ADMIN_EMAIL = 'keith@gogreenstreets.org'
const SITE = 'https://www.gogreenstreets.org'
const MAX_SENDS_PER_30D = 2

interface SendRow {
  item_ids: string[] | null
  sent_at: string
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
    const { data: subTowns, error } = await sb
      .from('town_digest_subscribers')
      .select('town_slug')
      .is('unsubscribed_at', null)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    slugs = [...new Set((subTowns ?? []).map((r) => r.town_slug as string))]
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
        .select('item_ids, sent_at')
        .eq('town_slug', slug)
      const sentItemIds = new Set(((sends ?? []) as SendRow[]).flatMap((s) => s.item_ids ?? []))
      const recentSends = ((sends ?? []) as SendRow[]).filter((s) => s.sent_at >= cutoff30).length
      if (!dryRun && recentSends >= MAX_SENDS_PER_30D) {
        results.push({ town: slug, skipped: `cap: ${recentSends} sends in last 30d` })
        continue
      }

      // Dry-run relaxes "upcoming only" to "published in the last 30 days" so
      // a just-passed meeting still renders for copy review.
      const civic: TownCivicEvent[] = dryRun
        ? await recentlyPublishedCivic(sb, town.town_name, cutoff30)
        : (await getTownCivicEvents(town.town_name)).filter((c) => !sentItemIds.has(c.id))

      const centroid = await getTownCentroid(town.group_id)
      const [events, partners, resources] = await Promise.all([
        getTownEvents(centroid, 3),
        getTownPartners(town.town_name),
        getTownResources(town.group_id),
      ])

      const content = buildTownDigest({
        town,
        qualifyingCount,
        civic,
        resources,
        events,
        partners,
        priorSendCount: (sends ?? []).length,
        now: dryRun ? Date.now() - 30 * 86400000 : undefined,
        horizonDays: dryRun ? 60 : undefined,
      })
      if (!content) {
        results.push({ town: slug, skipped: 'no new published items' })
        continue
      }

      let recipients: Array<{ email: string }>
      if (dryRun) {
        recipients = [{ email: ADMIN_EMAIL }]
      } else {
        const { data: subs, error: subsErr } = await sb
          .from('town_digest_subscribers')
          .select('email')
          .eq('town_slug', slug)
          .is('unsubscribed_at', null)
        if (subsErr) throw new Error(subsErr.message)
        recipients = subs ?? []
        if (recipients.length === 0) {
          results.push({ town: slug, skipped: 'no active subscribers' })
          continue
        }
      }

      let sent = 0
      let errors = 0
      for (const r of recipients) {
        const token = signTownDigestUnsubToken(r.email.toLowerCase(), slug)
        const unsubUrl = `${SITE}/api/towns/unsubscribe?token=${token}`
        const html = content.html.replaceAll(UNSUB_PLACEHOLDER, unsubUrl)
        if (dryRun && !previewHtml) previewHtml = html
        try {
          const res = await resend.emails.send({
            from: FROM,
            to: r.email,
            replyTo: REPLY_TO,
            subject: dryRun ? `[Preview — ${slug}] ${content.subject}` : content.subject,
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
        })
      }

      results.push({ town: slug, sent, errors, subject: content.subject, item_ids: content.itemIds, dry_run: dryRun })
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
    .select('id, title, description, hearing_date, hearing_time, hearing_type, hearing_location_name, virtual_link, source_url, comment_deadline, comment_email, action_label, municipality, affected_towns, access_notes')
    .eq('status', 'published')
    .or(`municipality.eq.${townName},affected_towns.cs.{${townName}}`)
    .gte('published_at', cutoffIso)
    .order('hearing_date', { ascending: true, nullsFirst: false })
    .limit(20)
  return (data ?? []) as TownCivicEvent[]
}
