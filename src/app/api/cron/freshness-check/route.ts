import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { SOURCES, STALE_AFTER_DAYS, type FreshnessSource } from '@/lib/freshness/sources'
import { fetchPriceSnapshot, diffPrices, type PriceDiff } from '@/lib/freshness/extract'
import {
  matchPriceChanges,
  applyPriceChanges,
  type PriceChange,
  type AutoUpdateReport,
} from '@/lib/freshness/auto-update'
import prices from '@/lib/facts/prices.json'

export const runtime = 'nodejs'
export const maxDuration = 120

const RECIPIENT = 'keith@gogreenstreets.org'
const FROM = 'GSI Freshness Bot <noreply@gogreenstreets.org>'

interface SourceReport {
  source: FreshnessSource
  fetched: string[]
  diff: PriceDiff | null
  status: number
  error?: string
  autoChanges: PriceChange[]
  autoUnmatched: string[]
  autoReport: AutoUpdateReport | null
}

interface StaleGuide {
  id: string
  slug: string | null
  title: string
  last_reviewed_at: string | null
  days_since: number
}

/**
 * Monthly freshness check — runs on the 1st of each month via Vercel Cron.
 *
 *  1. For each canonical price source: fetch, extract dollar amounts, diff
 *     against the stored snapshot, then write the new snapshot back.
 *  2. When prices changed: auto-match to prices.json keys, update the
 *     pricing_data DB table, and re-resolve guide body templates.
 *  3. Sweep stale guides.
 *  4. Email Keith a summary of what was auto-updated (and anything that
 *     needs manual review).
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return new Response('CRON_SECRET not set', { status: 500 })
  if (auth !== `Bearer ${expected}`) return new Response('unauthorized', { status: 401 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return new Response('RESEND_API_KEY not set', { status: 500 })

  const sb = createServerSupabaseClient()

  // 1. Source diffs + auto-update.
  const sourceReports: SourceReport[] = []
  for (const source of SOURCES) {
    const result = await fetchPriceSnapshot(source.url)
    let diff: PriceDiff | null = null
    let autoChanges: PriceChange[] = []
    let autoUnmatched: string[] = []
    let autoReport: AutoUpdateReport | null = null

    if (!result.error) {
      const { data: prev } = await sb
        .from('freshness_snapshots')
        .select('prices')
        .eq('url', source.url)
        .maybeSingle()

      if (prev) {
        diff = diffPrices(prev.prices ?? [], result.prices)

        // 2. Auto-update: match changed prices to keys and apply.
        if (diff.added.length > 0 || diff.removed.length > 0) {
          const match = matchPriceChanges(
            source,
            prices as unknown as Record<string, unknown>,
            diff,
          )
          autoChanges = match.changes
          autoUnmatched = match.unmatched

          if (match.changes.length > 0) {
            autoReport = await applyPriceChanges(
              sb,
              match.changes,
              prices as unknown as Record<string, unknown>,
              source.affectedGuideIds,
            )
          }
        }
      }

      await sb.from('freshness_snapshots').upsert(
        { url: source.url, prices: result.prices, fetched_at: new Date().toISOString() },
        { onConflict: 'url' },
      )
    }

    sourceReports.push({
      source,
      fetched: result.prices,
      diff,
      status: result.status,
      error: result.error,
      autoChanges,
      autoUnmatched,
      autoReport,
    })
  }

  // 3. Stale-by-age sweep.
  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: staleRows } = await sb
    .from('content_items')
    .select('id, slug, title, last_reviewed_at')
    .eq('content_type', 'micro_guide')
    .eq('status', 'approved')
    .lt('last_reviewed_at', cutoff)
    .order('last_reviewed_at', { ascending: true })

  const staleGuides: StaleGuide[] = (staleRows ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    last_reviewed_at: r.last_reviewed_at,
    days_since: r.last_reviewed_at
      ? Math.floor((Date.now() - new Date(r.last_reviewed_at).getTime()) / (24 * 60 * 60 * 1000))
      : -1,
  }))

  // 4. Compose + send email.
  const summary = summarize(sourceReports, staleGuides)
  const html = renderEmail(sourceReports, staleGuides)

  const resend = new Resend(apiKey)
  const sendResult = await resend.emails.send({
    from: FROM,
    to: RECIPIENT,
    subject: `GSI freshness check — ${summary.subjectSuffix}`,
    html,
  })

  return Response.json({
    ok: !sendResult.error,
    summary,
    emailId: sendResult.data?.id,
    emailError: sendResult.error?.message,
  })
}

function summarize(reports: SourceReport[], stale: StaleGuide[]) {
  const changedSources = reports.filter(
    (r) => r.diff && (r.diff.added.length > 0 || r.diff.removed.length > 0),
  ).length
  const autoUpdated = reports.filter((r) => r.autoChanges.length > 0).length
  const needsReview = reports.filter((r) => r.autoUnmatched.length > 0).length
  const erroredSources = reports.filter((r) => r.error).length

  const flags: string[] = []
  if (autoUpdated > 0) flags.push(`${autoUpdated} auto-updated`)
  if (needsReview > 0) flags.push(`${needsReview} need${needsReview === 1 ? 's' : ''} review`)
  if (changedSources > 0 && autoUpdated === 0 && needsReview === 0) {
    flags.push(`${changedSources} source${changedSources === 1 ? '' : 's'} changed`)
  }
  if (stale.length > 0) flags.push(`${stale.length} guide${stale.length === 1 ? '' : 's'} stale`)
  if (erroredSources > 0) flags.push(`${erroredSources} fetch error${erroredSources === 1 ? '' : 's'}`)

  const subjectSuffix = flags.length === 0 ? 'all clear' : flags.join(' · ')
  return { changedSources, autoUpdated, needsReview, erroredSources, staleCount: stale.length, subjectSuffix }
}

function renderEmail(reports: SourceReport[], stale: StaleGuide[]): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const sections: string[] = []
  sections.push(`<h2 style="margin:0 0 4px 0;font-size:18px">GSI freshness check</h2>`)
  sections.push(`<div style="color:#666;font-size:13px;margin-bottom:24px">${date}</div>`)

  for (const r of reports) {
    const lines: string[] = []
    lines.push(`<h3 style="margin:24px 0 8px 0;font-size:15px">${esc(r.source.label)}</h3>`)
    lines.push(`<div style="color:#666;font-size:12px;margin-bottom:8px">`)
    lines.push(`<a href="${esc(r.source.url)}" style="color:#666">${esc(r.source.url)}</a>`)
    lines.push(`</div>`)

    if (r.error) {
      lines.push(`<div style="color:#b00;font-size:13px">&#9888; Fetch error: ${esc(r.error)} (HTTP ${r.status})</div>`)
    } else if (!r.diff) {
      lines.push(
        `<div style="color:#888;font-size:13px">Snapshot seeded (${r.fetched.length} prices). Future runs will diff against this.</div>`,
      )
    } else if (r.diff.added.length === 0 && r.diff.removed.length === 0) {
      lines.push(`<div style="color:#0a8;font-size:13px">No change (${r.fetched.length} prices on page).</div>`)
    } else {
      // Show the raw diff
      lines.push(`<div style="font-size:13px">`)
      if (r.diff.removed.length > 0) {
        lines.push(`<div><strong>Removed:</strong> ${r.diff.removed.map((p) => `<code>${esc(p)}</code>`).join(', ')}</div>`)
      }
      if (r.diff.added.length > 0) {
        lines.push(`<div><strong>Added:</strong> ${r.diff.added.map((p) => `<code>${esc(p)}</code>`).join(', ')}</div>`)
      }
      lines.push(`</div>`)

      // Auto-update results
      if (r.autoChanges.length > 0) {
        lines.push(`<div style="margin-top:12px;padding:12px;background:#efffef;border-radius:8px;font-size:13px">`)
        lines.push(`<strong style="color:#0a8">Auto-updated:</strong>`)
        lines.push(`<ul style="margin:4px 0 0 0;padding-left:20px">`)
        for (const c of r.autoChanges) {
          const label = c.derived ? `${c.key} (derived)` : c.key
          lines.push(`<li><code>${esc(label)}</code>: $${c.oldValue} &rarr; $${c.newValue}</li>`)
        }
        lines.push(`</ul>`)
        if (r.autoReport) {
          if (r.autoReport.pricingDataUpdated.length > 0) {
            lines.push(`<div style="margin-top:4px;color:#666">pricing_data: ${r.autoReport.pricingDataUpdated.join(', ')}</div>`)
          }
          if (r.autoReport.guideBodiesUpdated.length > 0) {
            lines.push(`<div style="color:#666">Guide bodies re-resolved: ${r.autoReport.guideBodiesUpdated.join(', ')}</div>`)
          }
          if (r.autoReport.errors.length > 0) {
            lines.push(`<div style="color:#b00;margin-top:4px">Errors: ${r.autoReport.errors.map(esc).join('; ')}</div>`)
          }
        }
        lines.push(`</div>`)
      }

      // Items needing manual review
      if (r.autoUnmatched.length > 0) {
        lines.push(`<div style="margin-top:12px;padding:12px;background:#fff8e0;border-radius:8px;font-size:13px">`)
        lines.push(`<strong style="color:#b80">Needs manual review:</strong>`)
        lines.push(`<ul style="margin:4px 0 0 0;padding-left:20px">`)
        for (const msg of r.autoUnmatched) {
          lines.push(`<li>${esc(msg)}</li>`)
        }
        lines.push(`</ul>`)
        lines.push(`</div>`)
      }
    }
    sections.push(lines.join('\n'))
  }

  // Stale section
  sections.push(`<h3 style="margin:32px 0 8px 0;font-size:15px">Routine review (&#8805; ${STALE_AFTER_DAYS} days since last review)</h3>`)
  if (stale.length === 0) {
    sections.push(`<div style="color:#0a8;font-size:13px">All guides reviewed within the last ${STALE_AFTER_DAYS} days.</div>`)
  } else {
    sections.push(`<table style="border-collapse:collapse;font-size:13px;width:100%">`)
    sections.push(
      `<thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd">Guide</th><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd">Days since review</th></tr></thead><tbody>`,
    )
    for (const g of stale) {
      const url = g.slug ? `https://www.gogreenstreets.org/guides/${g.slug}` : null
      const titleCell = url
        ? `<a href="${url}">${esc(g.title)}</a> <code style="color:#888;font-size:11px">${esc(g.id)}</code>`
        : `${esc(g.title)} <code style="color:#888;font-size:11px">${esc(g.id)}</code>`
      sections.push(
        `<tr><td style="padding:6px;border-bottom:1px solid #f0f0f0">${titleCell}</td><td style="padding:6px;border-bottom:1px solid #f0f0f0">${g.days_since}</td></tr>`,
      )
    }
    sections.push(`</tbody></table>`)
  }

  sections.push(
    `<hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px 0"/>`,
    `<div style="color:#888;font-size:11px">` +
      `Automated monthly check from /api/cron/freshness-check. ` +
      `When a scraped price changes and can be matched to a known key, it is auto-applied to the pricing_data table and guide bodies. ` +
      `The static <code>prices.json</code> file (used by the commute advisor page and /nearby Bluebikes note) still needs a code deploy to pick up the new values &mdash; that happens on your next push. ` +
      `Anything the system cannot auto-match is flagged above for manual review.` +
    `</div>`,
  )

  return `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222">${sections.join('\n')}</div>`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
