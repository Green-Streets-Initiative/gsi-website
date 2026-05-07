#!/usr/bin/env node
/*
 * Build the micro-guide seed migration from content/micro-guides-library.md.
 *
 * Source of truth: content/micro-guides-library.md (markdown w/ YAML front blocks)
 * Output:          supabase/migrations/20260507_seed_micro_guides_library.sql
 *
 * Run with:  node scripts/build-micro-guides-migration.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const sourcePath = resolve(repoRoot, 'content/micro-guides-library.md')
const outputPath = resolve(repoRoot, 'supabase/migrations/20260507_seed_micro_guides_library.sql')

const STARTER_IDS = new Set([
  // Cycling
  'mg_low_stress_routes',
  'mg_bike_commute_gear',
  'mg_first_bike_lane',
  // Transit
  'mg_pay_for_t',
  'mg_transit_planning',
  'mg_subway_vs_bus',
  // Walking (all three)
  'mg_walking_vs_driving',
  'mg_walking_carrying',
  'mg_walking_weather',
])

const BARRIER_OVERRIDES = new Map([
  // Bluebikes ships barrier=null regardless of YAML — see plan/decision notes
  ['mg_bluebikes', null],
])

const SUPERSEDED_IDS = ['mg_blue_bikes', 'mg_return_bluebike']

/* ────────── Minimal YAML parser for our constrained subset ────────── */

function parseYaml(yamlText) {
  const obj = {}
  const lines = yamlText.split('\n')
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim() || line.trim().startsWith('#')) continue
    const m = line.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let value = m[2].trim()
    if (value === '' || value === 'null' || value === '~') {
      obj[key] = null
    } else if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim()
      obj[key] = inner === ''
        ? []
        : inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
    } else if (value.startsWith('"') && value.endsWith('"')) {
      obj[key] = value.slice(1, -1)
    } else if (value.startsWith("'") && value.endsWith("'")) {
      obj[key] = value.slice(1, -1)
    } else {
      obj[key] = value
    }
  }
  return obj
}

/* ────────── Markdown sectioning ────────── */

function extractGuides(markdown) {
  // Each guide section starts with `### \`mg_<id>\`` and ends at the next
  // top-level `---` separator on its own line.
  const guides = []
  const sectionRe = /^### `mg_[^`]+`\s*$/gm
  const matches = []
  let m
  while ((m = sectionRe.exec(markdown)) !== null) {
    matches.push({ index: m.index, header: m[0] })
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length
    const section = markdown.slice(start, end)
    guides.push(parseGuideSection(section))
  }
  return guides
}

function parseGuideSection(section) {
  const yamlRe = /```yaml\s*\n([\s\S]*?)\n```/
  const yamlMatch = section.match(yamlRe)
  if (!yamlMatch) throw new Error(`No YAML block found in section:\n${section.slice(0, 200)}`)
  const yaml = parseYaml(yamlMatch[1])

  // Body = everything after the closing ``` of the YAML block, up to the
  // next standalone `---` separator.
  const afterYaml = section.slice(yamlMatch.index + yamlMatch[0].length)
  const sepIdx = afterYaml.search(/^---\s*$/m)
  const rawBody = sepIdx === -1 ? afterYaml : afterYaml.slice(0, sepIdx)

  const body = normalizeBody(rawBody)
  return { yaml, body }
}

function normalizeBody(raw) {
  let body = raw

  // Strip parser-only "Note for Code:" trailers.
  // Format in source: a paragraph starting with **Note for Code:** that runs
  // until end of body. Drop from that marker onward.
  const noteIdx = body.search(/\*\*Note for Code:\*\*/)
  if (noteIdx !== -1) body = body.slice(0, noteIdx)

  return body.trim()
}

function deriveSummary(body) {
  // First non-heading, non-empty paragraph. Strip leading bullet/bold markers
  // so the summary reads as a sentence rather than a list lead-in.
  const blocks = body.split(/\n\s*\n/)
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#')) continue
    // Strip a leading bullet "- " and surrounding bold markers from the lead.
    const cleaned = trimmed
      .replace(/^[-*]\s+/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned.length > 0) return cleaned
  }
  return ''
}

function readTimeMinutes(body) {
  const words = body.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

/* ────────── SQL emission ────────── */

function sqlString(s) {
  // Single-quoted literal with doubled quotes. Used for short values.
  return `'${String(s).replace(/'/g, "''")}'`
}

function sqlNullable(s) {
  return s === null || s === undefined ? 'NULL' : sqlString(s)
}

function sqlTextArray(arr) {
  if (!arr || arr.length === 0) return `ARRAY[]::text[]`
  return `ARRAY[${arr.map(sqlString).join(', ')}]::text[]`
}

function sqlBody(body) {
  // Dollar-quoted string with a tag we can guarantee won't appear in body
  // content. Verify and bail if it does.
  const tag = 'guidebody'
  if (body.includes(`$${tag}$`)) {
    throw new Error(`Body contains $${tag}$ delimiter — pick a new tag.`)
  }
  return `$${tag}$${body}$${tag}$`
}

function rowSql(guide) {
  const y = guide.yaml
  const id = y.id
  const barrier = BARRIER_OVERRIDES.has(id) ? BARRIER_OVERRIDES.get(id) : y.barrier
  const summary = deriveSummary(guide.body)
  const isStarter = STARTER_IDS.has(id)
  const readMin = readTimeMinutes(guide.body)

  return `  (
    ${sqlString(id)},
    ${sqlString(y.title)},
    ${sqlString(y.slug)},
    ${sqlString(summary)},
    ${sqlBody(guide.body)},
    ${sqlString(y.mode)},
    ${sqlNullable(barrier)},
    ${sqlString(y.status || 'approved')},
    ${sqlString(y.content_type || 'micro_guide')},
    ${sqlTextArray(y.surfaces)},
    ${sqlTextArray(y.topics)},
    ${sqlTextArray(y.related)},
    ${isStarter ? 'true' : 'false'},
    ${readMin},
    now()
  )`
}

function buildMigration(guides) {
  const header = `-- Seed migration for the micro-guide library (20 guides).
-- Generated from content/micro-guides-library.md by
-- scripts/build-micro-guides-migration.mjs — do not edit by hand.
--
-- Re-running the parser overwrites this file. The markdown is the source of truth.

BEGIN;

-- 1. Mode cleanup: any pre-existing 'bike' rows fold into 'cycling'.
UPDATE content_items SET primary_mode = 'cycling' WHERE primary_mode = 'bike';

-- 2. Deprecate guides superseded by mg_bluebikes.
UPDATE content_items SET status = 'deprecated'
  WHERE id IN (${SUPERSEDED_IDS.map(sqlString).join(', ')});
`

  const insert = `
-- 3. Upsert the ${guides.length}-guide library.
INSERT INTO content_items (
  id, title, slug, summary, body, primary_mode, primary_barrier, status,
  content_type, surfaces, topics, related_guides, is_starter,
  read_time_minutes, last_reviewed_at
) VALUES
${guides.map(rowSql).join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  summary = EXCLUDED.summary,
  body = EXCLUDED.body,
  primary_mode = EXCLUDED.primary_mode,
  primary_barrier = EXCLUDED.primary_barrier,
  status = EXCLUDED.status,
  content_type = EXCLUDED.content_type,
  surfaces = EXCLUDED.surfaces,
  topics = EXCLUDED.topics,
  related_guides = EXCLUDED.related_guides,
  is_starter = EXCLUDED.is_starter,
  read_time_minutes = EXCLUDED.read_time_minutes,
  last_reviewed_at = EXCLUDED.last_reviewed_at;
  -- created_at intentionally not in SET so existing rows keep their original timestamp.

COMMIT;
`

  return header + insert
}

/* ────────── Main ────────── */

const markdown = readFileSync(sourcePath, 'utf8')
const guides = extractGuides(markdown)

// Sanity checks
if (guides.length !== 20) {
  console.warn(`WARNING: expected 20 guides, found ${guides.length}`)
}
const ids = guides.map((g) => g.yaml.id)
const dupeIds = ids.filter((id, i) => ids.indexOf(id) !== i)
if (dupeIds.length) throw new Error(`Duplicate guide IDs: ${dupeIds.join(', ')}`)

const slugs = guides.map((g) => g.yaml.slug).filter(Boolean)
const dupeSlugs = slugs.filter((s, i) => slugs.indexOf(s) !== i)
if (dupeSlugs.length) throw new Error(`Duplicate slugs: ${dupeSlugs.join(', ')}`)

const starterCount = guides.filter((g) => STARTER_IDS.has(g.yaml.id)).length
if (starterCount !== STARTER_IDS.size) {
  throw new Error(
    `Starter ID mismatch: expected ${STARTER_IDS.size} starters, matched ${starterCount}. ` +
      `Verify all starter IDs exist in the library.`,
  )
}

const sql = buildMigration(guides)
writeFileSync(outputPath, sql)

console.log(`Wrote ${guides.length} guides → ${outputPath}`)
console.log(`Starters: ${starterCount} · Deprecations: ${SUPERSEDED_IDS.length}`)
const byMode = guides.reduce((acc, g) => {
  acc[g.yaml.mode] = (acc[g.yaml.mode] || 0) + 1
  return acc
}, {})
console.log(`By mode: ${Object.entries(byMode).map(([m, n]) => `${m}=${n}`).join(' · ')}`)
