'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import { CheckCircle, Users, Trophy } from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import Avatar from '@/components/employer/Avatar'

type NotifItem = {
  id: string
  type: 'join' | 'challenge'
  title: string
  name: string
  timestamp: string
  unread: boolean
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function getLastSeen(groupId: string): string | null {
  try {
    return localStorage.getItem(`ep_notif_seen_${groupId}`)
  } catch {
    return null
  }
}

function setLastSeen(groupId: string) {
  try {
    localStorage.setItem(`ep_notif_seen_${groupId}`, new Date().toISOString())
  } catch {}
}

function getPrefs(groupId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`ep_notif_prefs_${groupId}`)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { weekly_impact: true, new_employee: true, challenge_milestones: false }
}

export default function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const { group, members, challenge } = usePortal()
  const panelRef = useRef<HTMLDivElement>(null)

  const groupId = group?.id ?? ''
  const lastSeen = useMemo(() => getLastSeen(groupId), [groupId])
  const prefs = useMemo(() => getPrefs(groupId), [groupId])

  useEffect(() => {
    if (groupId) setLastSeen(groupId)
  }, [groupId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  const items = useMemo(() => {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const result: NotifItem[] = []

    if (prefs.new_employee !== false) {
      for (const m of members) {
        const joinedMs = new Date(m.joined_at).getTime()
        if (joinedMs > thirtyDaysAgo) {
          result.push({
            id: `join-${m.user_id}`,
            type: 'join',
            title: `${m.display_name || 'Someone'} joined your team`,
            name: m.display_name || 'User',
            timestamp: m.joined_at,
            unread: lastSeen ? new Date(m.joined_at) > new Date(lastSeen) : true,
          })
        }
      }
    }

    if (prefs.challenge_milestones !== false && challenge) {
      const startMs = new Date(challenge.starts_at).getTime()
      if (startMs > thirtyDaysAgo) {
        result.push({
          id: `challenge-${challenge.id}`,
          type: 'challenge',
          title: `Challenge "${challenge.name}" started`,
          name: challenge.name,
          timestamp: challenge.starts_at,
          unread: lastSeen ? new Date(challenge.starts_at) > new Date(lastSeen) : true,
        })
      }
    }

    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return result
  }, [members, challenge, lastSeen, prefs])

  const markAllRead = useCallback(() => {
    if (groupId) setLastSeen(groupId)
    onClose()
  }, [groupId, onClose])

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[360px] overflow-hidden rounded-[14px] border border-line bg-surface shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-[14px] font-bold text-ink">Notifications</span>
        {items.length > 0 && (
          <button
            onClick={markAllRead}
            className="text-[12.5px] font-semibold text-accent hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Items */}
      <div className="max-h-[380px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
              <CheckCircle size={20} strokeWidth={1.75} className="text-accent" />
            </div>
            <span className="text-[13.5px] text-ink-muted">You&apos;re all caught up</span>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
                item.unread ? 'bg-accent-softer' : ''
              }`}
            >
              {item.type === 'join' ? (
                <Avatar name={item.name} size={32} />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft">
                  <Trophy size={16} strokeWidth={1.75} className="text-accent" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] text-ink">{item.title}</div>
                <div className="text-[12px] text-ink-faint">{relativeTime(item.timestamp)}</div>
              </div>
              {item.unread && (
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function hasUnreadNotifications(
  groupId: string,
  members: { joined_at: string }[],
  challenge: { id: string; starts_at: string } | null,
): boolean {
  const lastSeen = getLastSeen(groupId)
  if (!lastSeen) return members.length > 0 || !!challenge

  const cutoff = new Date(lastSeen)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const prefs = getPrefs(groupId)

  if (prefs.new_employee !== false) {
    for (const m of members) {
      const joinedMs = new Date(m.joined_at).getTime()
      if (joinedMs > thirtyDaysAgo && new Date(m.joined_at) > cutoff) return true
    }
  }

  if (prefs.challenge_milestones !== false && challenge) {
    const startMs = new Date(challenge.starts_at).getTime()
    if (startMs > thirtyDaysAgo && new Date(challenge.starts_at) > cutoff) return true
  }

  return false
}
