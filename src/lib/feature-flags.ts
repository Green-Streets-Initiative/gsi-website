import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The website's one reader for Shift's switches (app_feature_flags), the
 * same rules as the app (Shift lib/feature-flags.ts), so a switch means the
 * same thing on both. Before 2026-11-13 the site had copies of this in five
 * places (parity gap-flag-readers).
 *
 *   flagOnFor(db, name, userId)    one signed-in person: a row for them in
 *                                  app_feature_flag_users (early access), or
 *                                  the switch on and their bucket inside the
 *                                  rollout
 *   flagOnForEveryone(db, name)    anonymous visitors: on only when the
 *                                  switch is on for everyone (enabled, 100%)
 *   flagState(db, name)            the switch itself, for a page that splits
 *                                  a share of browsers on its own
 *
 * Every reader is off on any error. The early-access table shows a signed-in
 * person only their own rows (and nothing to anon), so pass the person's own
 * client, or the service role on the server.
 */

type FlagRow = { enabled: boolean; rollout_percent: number | null }

/** The app's rolloutBucket: float FNV, never Math.imul, so a person lands in the same bucket on both. */
export function rolloutBucket(userId: string): number {
  let h = 2166136261
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h % 100
}

export async function flagState(db: SupabaseClient, name: string): Promise<{ enabled: boolean; rollout: number }> {
  try {
    const { data, error } = await db.from('app_feature_flags').select('enabled, rollout_percent').eq('name', name).maybeSingle()
    const f = data as FlagRow | null
    if (error || !f) return { enabled: false, rollout: 0 }
    return { enabled: !!f.enabled, rollout: Math.max(0, Math.min(100, Number(f.rollout_percent ?? 0))) }
  } catch {
    return { enabled: false, rollout: 0 }
  }
}

export async function flagOnFor(db: SupabaseClient, name: string, userId: string): Promise<boolean> {
  try {
    const [flag, mine] = await Promise.all([
      flagState(db, name),
      db.from('app_feature_flag_users').select('user_id').eq('flag_name', name).eq('user_id', userId).maybeSingle(),
    ])
    if (!mine.error && mine.data) return true
    if (!flag.enabled) return false
    return flag.rollout >= 100 || (flag.rollout > 0 && rolloutBucket(userId) < flag.rollout)
  } catch {
    return false
  }
}

export async function flagOnForEveryone(db: SupabaseClient, name: string): Promise<boolean> {
  const f = await flagState(db, name)
  return f.enabled && f.rollout >= 100
}
