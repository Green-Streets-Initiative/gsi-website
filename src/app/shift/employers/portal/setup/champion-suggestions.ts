'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Someone the admin might name as a champion. */
export type ChampionSuggestion = {
  key: string
  name: string | null
  email: string | null
  /** Already on the team, or invited but not joined yet. */
  source: 'joined' | 'invited'
}

/** The fields of a portal member this needs (declared here, not imported,
 *  so the portal types can change without touching Setup). */
type MemberLike = { user_id: string; display_name: string | null }

type InvitationRow = { email: string; status: string; joined_user_id: string | null }

/**
 * People to suggest in the champion fields: everyone who joined the team
 * (name from their profile; email when they joined from an invitation), and
 * everyone on the uploaded invitation list who has not opted out. Read with
 * the admin's own sign-in, so RLS keeps it to this company.
 */
export function useChampionSuggestions(groupId: string | null | undefined, members: MemberLike[]): ChampionSuggestion[] {
  const [invites, setInvites] = useState<InvitationRow[]>([])

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    supabase
      .from('employer_invitations')
      .select('email,status,joined_user_id')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(({ data, error }) => {
        // No table yet, or no access: suggest members only.
        if (!cancelled && !error) setInvites((data ?? []) as InvitationRow[])
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  return useMemo(() => {
    const emailByUser = new Map<string, string>()
    for (const r of invites) if (r.joined_user_id && r.email) emailByUser.set(r.joined_user_id, r.email)

    const out: ChampionSuggestion[] = []
    const seenEmails = new Set<string>()
    for (const m of members) {
      const name = m.display_name?.trim() || null
      const email = emailByUser.get(m.user_id) ?? null
      if (!name && !email) continue
      if (email) seenEmails.add(email)
      out.push({ key: `m:${m.user_id}`, name, email, source: 'joined' })
    }
    for (const r of invites) {
      const email = r.email?.trim().toLowerCase()
      if (!email || seenEmails.has(email)) continue
      if (r.status === 'unsubscribed' || r.status === 'bounced') continue
      seenEmails.add(email)
      out.push({ key: `i:${email}`, name: null, email, source: r.status === 'joined' ? 'joined' : 'invited' })
    }
    return out
  }, [invites, members])
}

/**
 * The best few matches for what was typed, people already named elsewhere
 * left out. Starts-with matches (of any word in the name, or of the email)
 * rank above contains matches; joined members above invitees.
 */
export function matchSuggestions(
  all: ChampionSuggestion[],
  query: string,
  exclude: { emails: Set<string>; names: Set<string> },
  limit = 6,
): ChampionSuggestion[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const scored: { s: ChampionSuggestion; score: number }[] = []
  for (const s of all) {
    const email = s.email?.toLowerCase() ?? ''
    const name = s.name?.toLowerCase() ?? ''
    if (email && exclude.emails.has(email)) continue
    if (!email && name && exclude.names.has(name)) continue
    let score = -1
    if (email.startsWith(q) || name.startsWith(q) || name.split(/\s+/).some((w) => w.startsWith(q))) score = 2
    else if (email.includes(q) || name.includes(q)) score = 1
    if (score < 0) continue
    if (s.source === 'joined') score += 0.5
    scored.push({ s, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.s)
}
