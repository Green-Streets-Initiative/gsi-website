#!/usr/bin/env node
/*
 * Build the guide translations seed from content/translations/<lang>/*.md.
 *
 * Each file is one guide in one language: the "### `<id>`" line, the guide's
 * YAML block (same fields as content/micro-guides-library.md, plus `lang:`),
 * then the translated body. Rules: seo/answer-pages.md §10.
 *
 * Output: supabase/migrations/20261017_seed_guide_translations.sql, which
 * upserts public.content_item_translations (Shift migration 01212). Like the
 * English reseed it is applied through the management API, and it can run any
 * number of times. Rerun after editing a translation, after an English guide
 * changes (its translation must change with it), or after prices.json changes:
 *
 *   node scripts/build-guide-translations-migration.mjs
 *
 * Checks, any of which stops the build:
 *   - the guide id exists in the English library;
 *   - the translation has the same number of sections as the English guide
 *     (the website places tools and anchors by section);
 *   - every {{price:...}} token resolves.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const translationsDir = resolve(repoRoot, 'content/translations')
const outputPath = resolve(repoRoot, 'supabase/migrations/20261017_seed_guide_translations.sql')
const LOCALES = new Set(['es', 'pt-BR', 'zh-Hans'])

const prices = JSON.parse(readFileSync(resolve(repoRoot, 'src/lib/facts/prices.json'), 'utf8'))
function formatPrice(value, forceCents) {
  if (!forceCents && Number.isInteger(value)) return `$${value.toLocaleString('en-US')}`
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function interpolatePrices(text, where) {
  return text.replace(/\{\{price:([a-zA-Z.]+)(\|cents)?\}\}/g, (_, path, cents) => {
    const value = path.split('.').reduce((o, k) => o?.[k], prices)
    if (typeof value !== 'number') throw new Error(`${where}: unknown price fact "${path}"`)
    return formatPrice(value, !!cents)
  })
}

function field(yaml, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(yaml)
  if (!m) return null
  const v = m[1].trim()
  if (v === '' || v === 'null') return null
  return v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\"/g, '"') : v
}

/** The body, without the parser-only "Note for Code:" trailer the English build also drops. */
function cleanBody(raw) {
  const note = raw.search(/\*\*Note for Code:\*\*/)
  return (note === -1 ? raw : raw.slice(0, note)).trim()
}

function sectionCount(body) {
  return (body.match(/^### /gm) ?? []).length
}

/** id -> { body, reviewed } from the English library. */
function englishGuides() {
  const src = readFileSync(resolve(repoRoot, 'content/micro-guides-library.md'), 'utf8')
  const out = new Map()
  const re = /^### `([^`]+)`\s*\n+```yaml\n([\s\S]*?)\n```\n([\s\S]*?)(?=^### `|^---\s*$|(?![\s\S]))/gm
  for (const m of src.matchAll(re)) {
    out.set(m[1], { body: cleanBody(m[3]), reviewed: field(m[2], 'reviewed'), status: field(m[2], 'status') })
  }
  return out
}

function sqlString(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}
function sqlNullable(s) {
  return s == null ? 'NULL' : sqlString(s)
}
function sqlBody(body) {
  const tag = 'guidebody'
  if (body.includes(`$${tag}$`)) throw new Error(`Body contains $${tag}$`)
  return `$${tag}$${body}$${tag}$`
}
/** Noon Boston time, as the English seed writes review dates. */
function sqlDate(d) {
  if (!d) return 'NULL'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Bad date "${d}"`)
  return `timezone('America/New_York', ${sqlString(`${d} 12:00`)}::timestamp)`
}

const english = englishGuides()
const rows = []
const langs = existsSync(translationsDir)
  ? readdirSync(translationsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : []

for (const lang of langs.sort()) {
  if (!LOCALES.has(lang)) throw new Error(`content/translations/${lang}: not a supported locale`)
  for (const file of readdirSync(resolve(translationsDir, lang)).filter((f) => f.endsWith('.md')).sort()) {
    const where = `content/translations/${lang}/${file}`
    const src = readFileSync(resolve(translationsDir, lang, file), 'utf8')
    const m = /^### `([^`]+)`\s*\n+```yaml\n([\s\S]*?)\n```\n([\s\S]*)$/m.exec(src)
    if (!m) throw new Error(`${where}: expected "### \`<id>\`", a yaml block, then the body`)
    const [, id, yaml, rawBody] = m
    const en = english.get(id)
    if (!en) throw new Error(`${where}: no English guide with id ${id}`)
    if (field(yaml, 'lang') !== lang) throw new Error(`${where}: lang must be ${lang}`)
    const template = cleanBody(rawBody)
    if (sectionCount(template) !== sectionCount(en.body)) {
      throw new Error(
        `${where}: ${sectionCount(template)} sections, English has ${sectionCount(en.body)}. Keep the same sections in the same order.`,
      )
    }
    const title = field(yaml, 'title')
    if (!title) throw new Error(`${where}: missing title`)
    const humanReviewed = field(yaml, 'human_reviewed')
    rows.push({
      id,
      lang,
      title,
      summary: field(yaml, 'summary'),
      body: interpolatePrices(template, where),
      template,
      sourceReviewed: en.reviewed,
      translatedBy: humanReviewed ? 'human' : 'ai',
      humanReviewed,
    })
  }
}

const values = rows
  .map(
    (r) => `  (
    ${sqlString(r.id)},
    ${sqlString(r.lang)},
    ${sqlString(r.title)},
    ${sqlNullable(r.summary)},
    ${sqlBody(r.body)},
    ${sqlBody(r.template)},
    ${sqlDate(r.sourceReviewed)},
    ${sqlString(r.translatedBy)},
    ${sqlDate(r.humanReviewed)}
  )`,
  )
  .join(',\n')

const sql = `-- Generated by scripts/build-guide-translations-migration.mjs. Do not edit by hand:
-- edit content/translations/<lang>/<slug>.md and rerun the script.
-- ${rows.length} translations: ${[...new Set(rows.map((r) => r.lang))].map((l) => `${l} ${rows.filter((r) => r.lang === l).length}`).join(', ')}.
-- Needs public.content_item_translations (Shift migration 01212).

insert into public.content_item_translations
  (content_item_id, locale, title, summary, body, body_template, source_reviewed_at, translated_by, human_reviewed_at)
values
${values}
on conflict (content_item_id, locale) do update set
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  body_template = excluded.body_template,
  source_reviewed_at = excluded.source_reviewed_at,
  translated_by = excluded.translated_by,
  human_reviewed_at = excluded.human_reviewed_at,
  updated_at = now();
`

writeFileSync(outputPath, sql)
console.log(`Wrote ${rows.length} translations → ${outputPath}`)
