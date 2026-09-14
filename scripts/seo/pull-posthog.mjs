#!/usr/bin/env node
/**
 * Pull PostHog organic-traffic numbers for the SEO/AEO routine.
 *
 * Usage:
 *   node scripts/seo/pull-posthog.mjs --mode check     # verify auth + project
 *   node scripts/seo/pull-posthog.mjs --mode weekly    # 12 weeks of organic sessions
 *
 * WHY THIS EXISTS. The routine used to read PostHog through the PostHog MCP
 * server, which authenticates with OAuth. An unattended scheduled run cannot
 * complete an OAuth flow, so PostHog silently dropped out of the ledger every
 * time the server's session lapsed — it was missing from the 2026-09-14 pulse
 * for exactly that reason. A personal API key in a file has no interactive step
 * and no expiry, so this works the same way at 3am as it does by hand.
 *
 * Auth: a PostHog personal API key, kept OUTSIDE the repo. Path from
 * $POSTHOG_KEY_FILE, default ~/.config/gsi-seo/posthog.json:
 *
 *   { "personal_api_key": "phx_...", "project_id": 12345,
 *     "host": "https://us.posthog.com" }
 *
 * project_id and host are optional — the project is auto-discovered on first
 * run and the host defaults to the US cloud. NOTE this is the APP host
 * (us.posthog.com), not the ingest host (us.i.posthog.com) the apps send to.
 * The key needs the `query:read` scope and nothing else.
 *
 * Output: seo/data/posthog/weekly-YYYY-MM-DD.json (committed — git history is
 * the time series, same contract as the GSC files).
 *
 * Exits non-zero with a one-line reason on any auth/config failure so the
 * routine can email the blocker and stop.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DATA_DIR = path.join(REPO_ROOT, 'seo', 'data', 'posthog')
const KEY_FILE =
  process.env.POSTHOG_KEY_FILE || path.join(os.homedir(), '.config', 'gsi-seo', 'posthog.json')

const WEEKS = 12

function die(msg) {
  console.error(`PostHog pull failed: ${msg}`)
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

// ---- credentials ----
function loadKey() {
  if (!fs.existsSync(KEY_FILE)) {
    die(
      `no PostHog key at ${KEY_FILE}. Create a personal API key in PostHog ` +
        `(Settings -> Personal API keys, scope "query:read") and save it as ` +
        `{"personal_api_key":"phx_..."} at that path.`,
    )
  }
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'))
  } catch (e) {
    die(`${KEY_FILE} is not valid JSON (${e.message})`)
  }
  if (!parsed.personal_api_key) die(`${KEY_FILE} has no "personal_api_key"`)
  return {
    key: parsed.personal_api_key,
    projectId: parsed.project_id ?? null,
    host: (parsed.host || 'https://us.posthog.com').replace(/\/$/, ''),
    keyPath: KEY_FILE,
  }
}

async function api(cred, pathname, init = {}) {
  const res = await fetch(`${cred.host}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cred.key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const body = await res.text()
  if (!res.ok) {
    // 401/403 are the two that actually happen: wrong key, or a key without
    // query:read. Say which so the blocker email is one line, not a hunt.
    const hint =
      res.status === 401
        ? ' — key rejected; check it was copied whole and has not been revoked'
        : res.status === 403
          ? ' — key lacks the "query:read" scope, or no access to this project'
          : ''
    die(`${res.status} on ${pathname}${hint}: ${body.slice(0, 300)}`)
  }
  try {
    return JSON.parse(body)
  } catch {
    die(`non-JSON response from ${pathname}: ${body.slice(0, 200)}`)
  }
}

async function resolveProject(cred) {
  if (cred.projectId) return cred.projectId
  const list = await api(cred, '/api/projects/')
  const projects = list.results || []
  if (projects.length === 0) die('this key can see no projects')
  const id = projects[0].id
  console.error(
    `note: no project_id in ${cred.keyPath}; using "${projects[0].name}" (${id}). ` +
      `Add "project_id": ${id} to that file to pin it.`,
  )
  return id
}

async function hogql(cred, projectId, query) {
  const out = await api(cred, `/api/projects/${projectId}/query/`, {
    method: 'POST',
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  })
  if (out.error) die(`query error: ${out.error}`)
  return out.results || []
}

// ---- the queries ----
//
// The organic definition is the one established on 2026-08-31 and recorded in
// .seo-state.json. It is duplicated here ON PURPOSE so the numbers cannot drift
// when someone rewrites the note: Monday-start weeks, distinct $session_id on
// $pageview, referring domain in the search-engine list, and mail-security
// link-scanner paths excluded (they added 9 phantom "bing.com" sessions in the
// week of 2026-08-24 before we caught them).
const ORGANIC_DOMAINS = `'google', 'bing', 'duckduckgo', 'ecosia', 'yahoo', 'brave'`
const SCANNER_EXCLUSION = `
    AND properties.$pathname NOT LIKE '%/1/0100%'
    AND properties.$pathname NOT LIKE '/preferences/%'`

const ANSWER_ENGINE_DOMAINS = `'chatgpt', 'openai', 'perplexity', 'claude', 'anthropic', 'copilot', 'gemini'`

function domainMatch(column, list) {
  // $referring_domain is a bare host ("www.google.com"), so match on substring
  // rather than equality — country TLDs and subdomains are both common.
  return `multiSearchAny(lower(${column}), [${list}])`
}

const weeklySessionsQuery = `
  SELECT
    toStartOfWeek(timestamp, 1) AS week_start,
    count(DISTINCT properties.$session_id) AS sessions
  FROM events
  WHERE event = '$pageview'
    AND timestamp >= now() - INTERVAL ${WEEKS + 1} WEEK
    AND ${domainMatch('properties.$referring_domain', ORGANIC_DOMAINS)}${SCANNER_EXCLUSION}
  GROUP BY week_start
  ORDER BY week_start DESC
  LIMIT ${WEEKS + 1}
`

const landingPagesQuery = `
  SELECT
    properties.$pathname AS path,
    count(DISTINCT properties.$session_id) AS sessions
  FROM events
  WHERE event = '$pageview'
    AND timestamp >= now() - INTERVAL 1 WEEK
    AND ${domainMatch('properties.$referring_domain', ORGANIC_DOMAINS)}${SCANNER_EXCLUSION}
  GROUP BY path
  ORDER BY sessions DESC
  LIMIT 25
`

const answerEngineQuery = `
  SELECT
    properties.$referring_domain AS referrer,
    count(DISTINCT properties.$session_id) AS sessions
  FROM events
  WHERE event = '$pageview'
    AND timestamp >= now() - INTERVAL 1 WEEK
    AND ${domainMatch('properties.$referring_domain', ANSWER_ENGINE_DOMAINS)}
  GROUP BY referrer
  ORDER BY sessions DESC
  LIMIT 25
`

function mean(xs) {
  if (xs.length === 0) return null
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100
}

async function main() {
  const mode = arg('mode', 'weekly')
  const cred = loadKey()
  const projectId = await resolveProject(cred)

  if (mode === 'check') {
    const rows = await hogql(cred, projectId, 'SELECT count() FROM events LIMIT 1')
    console.log(`PostHog OK — project ${projectId} on ${cred.host}, events readable (${rows[0]?.[0] ?? 0})`)
    return
  }
  if (mode !== 'weekly') die(`unknown --mode "${mode}" (expected check or weekly)`)

  const [sessionRows, landingRows, answerRows] = await Promise.all([
    hogql(cred, projectId, weeklySessionsQuery),
    hogql(cred, projectId, landingPagesQuery),
    hogql(cred, projectId, answerEngineQuery),
  ])

  // Row 0 is the current, partial week — real but not comparable to full weeks.
  const weeks = sessionRows.map(([week_start, sessions]) => ({
    week_start: String(week_start).slice(0, 10),
    sessions: Number(sessions),
  }))
  const complete = weeks.slice(1)

  const out = {
    pulled_at: new Date().toISOString(),
    project_id: projectId,
    host: cred.host,
    definition:
      'Organic = distinct $session_id on $pageview where $referring_domain matches ' +
      'google/bing/duckduckgo/ecosia/yahoo/brave, excluding mail-security link-scanner ' +
      'paths (%/1/0100% and /preferences/%). Monday-start weeks.',
    partial_week: weeks[0] ?? null,
    weeks: complete,
    organic_sessions_last_complete_week: complete[0]?.sessions ?? null,
    organic_sessions_4wk_mean: mean(complete.slice(0, 4).map((w) => w.sessions)),
    organic_sessions_12wk_mean: mean(complete.slice(0, 12).map((w) => w.sessions)),
    top_organic_landing_pages: landingRows.map(([path, sessions]) => ({
      path,
      sessions: Number(sessions),
    })),
    answer_engine_referrals_7d: answerRows.map(([referrer, sessions]) => ({
      referrer,
      sessions: Number(sessions),
    })),
    answer_engine_referral_sessions_7d: answerRows.reduce((a, r) => a + Number(r[1]), 0),
  }

  fs.mkdirSync(DATA_DIR, { recursive: true })
  const stamp = complete[0]?.week_start ?? new Date().toISOString().slice(0, 10)
  const file = path.join(DATA_DIR, `weekly-${stamp}.json`)
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
  console.log(
    `wrote ${path.relative(REPO_ROOT, file)}  ` +
      `(organic sessions ${out.organic_sessions_last_complete_week}, ` +
      `4-wk mean ${out.organic_sessions_4wk_mean}, ` +
      `answer-engine referrals ${out.answer_engine_referral_sessions_7d})`,
  )
}

main().catch((e) => die(e.message))
