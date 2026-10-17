#!/usr/bin/env node
// Build the draft guide previews served at /preview/guides/<slug>.
//
// Reads every seo/drafts/guides/*.md whose YAML block says `status: draft` and
// whose slug is not already in content/micro-guides-library.md, resolves its
// {{price:...}} tokens from src/lib/facts/prices.json (same rules as
// scripts/build-micro-guides-migration.mjs), and writes
// src/app/preview/guides/drafts.generated.json. The preview route renders each
// draft in the real guide template, never indexed.
//
// Translations (seo/answer-pages.md §10) live in seo/drafts/guides/<lang>/ and
// go to src/app/preview/guides/drafts-<lang>.generated.json, served at
// /preview/<lang>/guides/<slug>. Each must have the same sections, in the same
// order, as its English draft; the build stops if not, because tools are
// placed by section. Rerun after editing a draft:
//
//   node scripts/seo/build-draft-previews.mjs

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const draftsDir = resolve(repoRoot, 'seo/drafts/guides')
const prices = JSON.parse(readFileSync(resolve(repoRoot, 'src/lib/facts/prices.json'), 'utf8'))
const library = readFileSync(resolve(repoRoot, 'content/micro-guides-library.md'), 'utf8')
const shippedSlugs = new Set([...library.matchAll(/^slug: (\S+)$/gm)].map((m) => m[1]))

function formatPrice(value, forceCents) {
  if (!forceCents && Number.isInteger(value)) return `$${value.toLocaleString('en-US')}`
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function interpolatePrices(text, file) {
  return text.replace(/\{\{price:([a-zA-Z.]+)(\|cents)?\}\}/g, (_, path, cents) => {
    const value = path.split('.').reduce((o, k) => o?.[k], prices)
    if (typeof value !== 'number') throw new Error(`${file}: unknown price fact "${path}"`)
    return formatPrice(value, !!cents)
  })
}
function field(yaml, key) {
  const m = new RegExp(`^${key}: (.*)$`, 'm').exec(yaml)
  if (!m) return null
  const v = m[1].trim()
  if (v === 'null') return null
  return v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v
}
function list(yaml, key) {
  const v = field(yaml, key)
  return v ? v.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean) : []
}

/** Section headings in body order; null for the lead. Same split as GuideView. */
function headings(body) {
  const out = [null]
  for (const m of body.matchAll(/^### (.+)$/gm)) out.push(m[1].trim())
  return out
}

function readDrafts(dir) {
  const drafts = {}
  if (!existsSync(dir)) return drafts
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const src = readFileSync(resolve(dir, file), 'utf8')
    const m = /```yaml\n([\s\S]*?)\n```\n([\s\S]*)$/.exec(src)
    if (!m) continue
    const [, yaml, rawBody] = m
    const slug = field(yaml, 'slug')
    if (field(yaml, 'status') !== 'draft' || !slug || shippedSlugs.has(slug)) continue
    const body = interpolatePrices(rawBody.trim(), file)
    const reviewed = field(yaml, 'reviewed')
    drafts[slug] = {
      id: field(yaml, 'id'),
      slug,
      title: field(yaml, 'title'),
      summary: field(yaml, 'summary'),
      body,
      primary_mode: field(yaml, 'mode'),
      primary_barrier: field(yaml, 'barrier'),
      read_time_minutes: Math.max(1, Math.ceil(body.split(/\s+/).filter(Boolean).length / 200)),
      related_guides: list(yaml, 'related'),
      created_at: reviewed ? `${reviewed}T16:00:00Z` : new Date().toISOString(),
      last_reviewed_at: reviewed ? `${reviewed}T16:00:00Z` : null,
    }
  }
  return drafts
}

const drafts = readDrafts(draftsDir)
const out = resolve(repoRoot, 'src/app/preview/guides/drafts.generated.json')
writeFileSync(out, JSON.stringify(drafts, null, 2) + '\n')
console.log(`Wrote ${Object.keys(drafts).length} draft previews: ${Object.keys(drafts).join(', ')}`)

for (const lang of readdirSync(draftsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const translated = readDrafts(resolve(draftsDir, lang))
  for (const [slug, t] of Object.entries(translated)) {
    const en = drafts[slug]
    if (!en) {
      // The English page shipped or was dropped; the translation ships with it.
      delete translated[slug]
      continue
    }
    const enHeads = headings(en.body)
    const tHeads = headings(t.body)
    if (enHeads.length !== tHeads.length) {
      throw new Error(
        `${lang}/${slug}: ${tHeads.length - 1} sections, English has ${enHeads.length - 1}. Keep the same sections in the same order.`,
      )
    }
    t.lang = lang
    t.section_keys = enHeads
  }
  const outLang = resolve(repoRoot, `src/app/preview/guides/drafts-${lang}.generated.json`)
  writeFileSync(outLang, JSON.stringify(translated, null, 2) + '\n')
  console.log(`Wrote ${Object.keys(translated).length} ${lang} previews: ${Object.keys(translated).join(', ')}`)
}
