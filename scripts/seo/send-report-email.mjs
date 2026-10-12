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
 * Auth: the Supabase-side cron secret, read at send time from Supabase Vault
 * (`cron_secret`, the same entry pg_cron uses) through the management API with
 * the Supabase CLI login in the macOS keychain, as ~/.claude/bin/sbq.sh does.
 * It stays in memory and is never printed or written, so a rotation needs no
 * copies updated (the 2026-10-12 email 401'd on a stale copy). $CRON_SECRET
 * from .claude/settings.local.json is only a fallback. NOT the Vercel cron
 * secret of the same name in .env.local, which guards this repo's own
 * /api/cron/* routes.
 *
 * Exits non-zero with a one-line reason on any failure so the routine can
 * report the blocker rather than claiming it emailed.
 */
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
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

const PROJECT_REF = 'xyqcpgwbqrhykpgpqbdi'

async function vaultSecret() {
  const raw = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-w'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
  const token = Buffer.from(raw.replace(/^go-keyring-base64:/, ''), 'base64').toString('utf8')
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query:
        "begin transaction read only; select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'; ",
    }),
  })
  if (!res.ok) throw new Error(`management API ${res.status}`)
  const rows = await res.json()
  const value = Array.isArray(rows) ? rows[0]?.decrypted_secret : null
  if (!value) throw new Error('no cron_secret row in vault')
  return value
}

// --check-secret: compare this session's $CRON_SECRET with the gsi-website and
// Shift env blocks by sha256 prefix only, never printing a value. The Shift
// block is kept current when the Supabase secret rotates (2026-10-09 rotation
// left gsi-website's copy stale and the 2026-10-12 email 401'd).
async function checkSecret() {
  const digest = (v) => (v ? crypto.createHash('sha256').update(v).digest('hex').slice(0, 12) : '(unset)')
  const fromFile = (p) => {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')).env?.CRON_SECRET ?? null
    } catch {
      return null
    }
  }
  const shift = path.join(os.homedir(), 'Documents/GreenStreetsInitiative/Shift/.claude/settings.local.json')
  const rows = [
    ['this session $CRON_SECRET', process.env.CRON_SECRET],
    ['gsi-website settings.local.json', fromFile(path.join(REPO_ROOT, '.claude/settings.local.json'))],
    ['Shift settings.local.json', fromFile(shift)],
  ]
  let vault = null
  try {
    vault = await vaultSecret()
  } catch (e) {
    console.log(`vault read failed: ${e.message}`)
  }
  rows.unshift(['Supabase Vault cron_secret (used for sending)', vault])
  for (const [label, v] of rows) console.log(`${digest(v)}  ${label}`)
}

async function main() {
  if (process.argv.includes('--check-secret')) return checkSecret()
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

  let secret = null
  try {
    secret = await vaultSecret()
  } catch (e) {
    console.error(`vault read failed (${e.message}); falling back to $CRON_SECRET`)
  }
  secret ??= process.env.CRON_SECRET
  if (!secret) {
    die(
      'no secret: the Supabase Vault read failed and $CRON_SECRET is not set. ' +
        'Do not substitute the Vercel cron secret of the same name from .env.local.',
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
