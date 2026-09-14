#!/usr/bin/env node
/**
 * Send the SEO/AEO routine's report email to keith@gogreenstreets.org.
 *
 * Usage:
 *   node scripts/seo/send-report-email.mjs --subject "[GSI] SEO weekly — ..." \
 *     --body seo/reports/2026-09-14-email.txt
 *   node scripts/seo/send-report-email.mjs ... --dry-run   # print, don't send
 *
 * WHY THIS EXISTS. The routine used to hand-write a JSON payload file with every
 * newline and quote escaped by hand, then POST it with a long inline curl. Both
 * halves were bad: the escaping is error-prone for a 7,000-character email, and
 * a bespoke curl line cannot be allowlisted, so an unattended run stops on a
 * permission prompt with the whole report already written. This takes a plain
 * text file and does the escaping itself.
 *
 * Auth: $CRON_SECRET — the SUPABASE-side value, injected from
 * .claude/settings.local.json. NOT the Vercel cron secret of the same name in
 * .env.local, which guards this repo's own /api/cron/* routes. Crossing the two
 * is a documented past failure; see .seo-state.json resolved_notes 2026-08-24.
 *
 * Exits non-zero with a one-line reason on any failure so the routine can
 * report the blocker rather than claiming it emailed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ENDPOINT = 'https://xyqcpgwbqrhykpgpqbdi.supabase.co/functions/v1/sentry-triage-email'
const MAX_BYTES = 256 * 1024

function die(msg) {
  console.error(`Email send failed: ${msg}`)
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const subject = arg('subject', null)
  const bodyPath = arg('body', null)

  if (!subject) die('missing --subject')
  if (!bodyPath) die('missing --body (path to a plain text file)')

  const resolved = path.resolve(REPO_ROOT, bodyPath)
  if (!fs.existsSync(resolved)) die(`no such body file: ${bodyPath}`)
  const text = fs.readFileSync(resolved, 'utf8')
  if (text.trim().length === 0) die(`${bodyPath} is empty`)

  const payload = JSON.stringify({ subject, text })
  const bytes = Buffer.byteLength(payload)
  if (bytes > MAX_BYTES) die(`payload is ${bytes} bytes, over the ${MAX_BYTES} limit`)

  if (dryRun) {
    console.log(`--- dry run, nothing sent ---`)
    console.log(`subject: ${subject}`)
    console.log(`body:    ${bodyPath} (${text.length} chars, ${bytes} bytes of JSON)`)
    return
  }

  const secret = process.env.CRON_SECRET
  if (!secret) {
    die(
      'CRON_SECRET is not set. The Supabase-side value is injected from the env ' +
        'block in .claude/settings.local.json — do not substitute the Vercel ' +
        'cron secret of the same name from .env.local.',
    )
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': secret },
    body: payload,
  })
  const body = await res.text()
  if (!res.ok) {
    const hint = res.status === 401 ? ' — wrong CRON_SECRET (see the note above)' : ''
    die(`${res.status}${hint}: ${body.slice(0, 300)}`)
  }
  console.log(`sent (${res.status}) — "${subject}" (${text.length} chars) to keith@gogreenstreets.org`)
}

main().catch((e) => die(e.message))
