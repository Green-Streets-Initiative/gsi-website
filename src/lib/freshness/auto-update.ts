import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceDiff } from './extract'
import type { FreshnessSource } from './sources'
import { PRICING_DATA_KEY_MAP } from './sources'

/* ────── price helpers ────── */

/** Read a nested value from prices.json-shaped object by dot path. */
function getByPath(obj: Record<string, unknown>, path: string): number | undefined {
  const val = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj)
  return typeof val === 'number' ? val : undefined
}

/** Set a nested value by dot path (mutates). */
function setByPath(obj: Record<string, unknown>, path: string, value: number): void {
  const keys = path.split('.')
  const last = keys.pop()!
  const parent = keys.reduce<unknown>((o, k) => {
    const cur = o as Record<string, unknown>
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}
    return cur[k]
  }, obj) as Record<string, unknown>
  parent[last] = value
}

function formatPrice(value: number, forceCents: boolean): string {
  if (!forceCents && Number.isInteger(value)) return `$${value}`
  return `$${value.toFixed(2)}`
}

function priceToNum(s: string): number {
  return parseFloat(s.replace(/[$,]/g, ''))
}

/**
 * Derived prices: values computed from other prices rather than scraped
 * directly.  When the parent key updates, the derived value is recomputed.
 */
const DERIVED: Record<string, { parent: string; compute: (parent: number) => number }> = {
  'bluebikes.annualPerMonth': {
    parent: 'bluebikes.annual',
    compute: (annual) => Math.round((annual / 12) * 100) / 100,
  },
}

/* ────── matching ────── */

export interface PriceChange {
  key: string
  oldValue: number
  newValue: number
  derived?: boolean
}

export interface MatchResult {
  changes: PriceChange[]
  unmatched: string[]
}

/**
 * Given a price diff from the scraper and the current prices.json object,
 * identify which tracked keys changed and what their new values are.
 *
 * Strategy: build a reverse index from each known numeric value to the key(s)
 * that hold it.  A removed dollar amount whose value uniquely matches one key
 * is a confirmed change; the replacement is the closest-magnitude price in the
 * added set.  Ambiguous or unmatchable changes are returned in `unmatched`.
 */
export function matchPriceChanges(
  source: FreshnessSource,
  currentPrices: Record<string, unknown>,
  diff: PriceDiff,
): MatchResult {
  if (diff.added.length === 0 && diff.removed.length === 0) {
    return { changes: [], unmatched: [] }
  }

  // Reverse index: numeric value → key paths that have that value
  const reverseIndex = new Map<number, string[]>()
  for (const key of source.priceKeys) {
    const val = getByPath(currentPrices, key)
    if (val === undefined) continue
    const existing = reverseIndex.get(val) ?? []
    existing.push(key)
    reverseIndex.set(val, existing)
  }

  const changes: PriceChange[] = []
  const unmatched: string[] = []
  const usedAdded = new Set<number>()

  // Process each removed price
  for (const removedStr of diff.removed) {
    const removedVal = priceToNum(removedStr)
    const matchingKeys = reverseIndex.get(removedVal)

    if (!matchingKeys || matchingKeys.length === 0) {
      // Not one of our tracked prices — a price on the page we don't track
      continue
    }

    if (matchingKeys.length === 1) {
      // Unique match — find the best replacement from added prices
      const replacement = findReplacement(removedVal, diff.added, usedAdded)
      if (replacement !== null) {
        changes.push({
          key: matchingKeys[0],
          oldValue: removedVal,
          newValue: replacement,
        })
        usedAdded.add(replacement)
      } else {
        unmatched.push(
          `${removedStr} (${matchingKeys[0]}) removed from page — no replacement found`,
        )
      }
    } else {
      // Multiple keys share this value — ambiguous
      unmatched.push(
        `${removedStr} shared by ${matchingKeys.join(', ')} — cannot auto-determine which changed`,
      )
    }
  }

  // Recompute derived values when their parent changes
  for (const [derivedKey, { parent, compute }] of Object.entries(DERIVED)) {
    const parentChange = changes.find((c) => c.key === parent)
    if (parentChange) {
      const oldDerived = getByPath(currentPrices, derivedKey) ?? 0
      changes.push({
        key: derivedKey,
        oldValue: oldDerived,
        newValue: compute(parentChange.newValue),
        derived: true,
      })
    }
  }

  return { changes, unmatched }
}

function findReplacement(
  removedVal: number,
  added: string[],
  usedAdded: Set<number>,
): number | null {
  let best: { val: number; dist: number } | null = null
  for (const s of added) {
    const val = priceToNum(s)
    if (usedAdded.has(val)) continue
    // Within 3x of the original — generous to handle fare restructures
    const ratio = val / removedVal
    if (ratio < 0.33 || ratio > 3) continue
    const dist = Math.abs(val - removedVal)
    if (!best || dist < best.dist) {
      best = { val, dist }
    }
  }
  return best?.val ?? null
}

/* ────── DB updates ────── */

export interface AutoUpdateReport {
  pricingDataUpdated: string[]
  guideBodiesUpdated: string[]
  errors: string[]
}

/**
 * Applies price changes to the database:
 *   1. Updates matching rows in the `pricing_data` table.
 *   2. Re-resolves guide body templates whose source references any of the
 *      affected guide IDs, writing new `body` from `body_template`.
 */
export async function applyPriceChanges(
  sb: SupabaseClient,
  changes: PriceChange[],
  currentPrices: Record<string, unknown>,
  affectedGuideIds: string[],
): Promise<AutoUpdateReport> {
  const report: AutoUpdateReport = {
    pricingDataUpdated: [],
    guideBodiesUpdated: [],
    errors: [],
  }

  if (changes.length === 0) return report

  // Build merged price object: current values + changes applied
  const merged = JSON.parse(JSON.stringify(currentPrices)) as Record<string, unknown>
  for (const c of changes) {
    setByPath(merged, c.key, c.newValue)
  }

  // 1. Update pricing_data rows
  for (const c of changes) {
    const dbKey = PRICING_DATA_KEY_MAP[c.key]
    if (!dbKey) continue
    const { error } = await sb
      .from('pricing_data')
      .upsert({ key: dbKey, value: c.newValue }, { onConflict: 'key' })
    if (error) {
      report.errors.push(`pricing_data upsert ${dbKey}: ${error.message}`)
    } else {
      report.pricingDataUpdated.push(`${dbKey} = ${c.newValue}`)
    }
  }

  // 2. Re-resolve guide body templates
  if (affectedGuideIds.length > 0) {
    const { data: guides, error } = await sb
      .from('content_items')
      .select('id, body_template')
      .in('id', affectedGuideIds)
      .not('body_template', 'is', null)

    if (error) {
      report.errors.push(`Guide template fetch: ${error.message}`)
    } else if (guides) {
      for (const g of guides) {
        const resolved = resolveTemplate(g.body_template as string, merged)
        const { error: updateErr } = await sb
          .from('content_items')
          .update({ body: resolved })
          .eq('id', g.id)

        if (updateErr) {
          report.errors.push(`Guide body update ${g.id}: ${updateErr.message}`)
        } else {
          report.guideBodiesUpdated.push(g.id)
        }
      }
    }
  }

  return report
}

/** Resolve {{price:path}} and {{price:path|cents}} tokens in a template. */
function resolveTemplate(template: string, prices: Record<string, unknown>): string {
  return template.replace(
    /\{\{price:([a-zA-Z.]+)(\|cents)?\}\}/g,
    (match, path: string, cents: string) => {
      const val = getByPath(prices, path)
      if (typeof val !== 'number') return match
      return formatPrice(val, !!cents)
    },
  )
}
