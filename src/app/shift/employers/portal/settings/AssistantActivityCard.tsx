'use client'

// What was changed through the setup assistant, and by whom (Shift 01303).
// Conversations are private to each person; the changes they make are the
// team's business, so everyone on the portal team sees this list.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHead, CardBody } from '@/components/employer/Card'

type Row = { id: number; actor_email: string | null; summary: string; ok: boolean; created_at: string }

export default function AssistantActivityCard({ groupId }: { groupId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('employer_activity_log')
      .select('id, actor_email, summary, ok, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(25)
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as Row[])
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  if (!rows || rows.length === 0) return null

  return (
    <Card>
      <CardHead title="Changes made with the assistant" sub="Every change someone approved in the assistant. The conversations themselves stay private to each person." />
      <CardBody>
        <ul className="divide-y divide-line-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 text-[15px]">
              <span className="text-ink">
                {r.summary}
                {!r.ok && <span className="ml-1.5 font-semibold text-ep-danger">(didn&apos;t go through)</span>}
              </span>
              <span className="text-[14px] text-ink-muted">
                {r.actor_email ?? 'Someone'} ·{' '}
                {new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
