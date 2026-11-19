'use client'

import { useEffect, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { answerHandoff, errorText } from '@/lib/organizers/api'
import { getHandoffsForMe, type GroupClaimed, type HandoffForMe } from '@/lib/organizers/group'
import { Button, Card, Notice, SectionTitle } from './ui'

/**
 * Rides someone asked the signed-in person to take over (Shift 01866), on
 * the console's first page: a person who only rides can't open a ride's Team
 * tab, so they answer here as well as in the app.
 */
export function HandoffsForMe({ onAnswered }: { onAnswered: () => void }) {
  const [asks, setAsks] = useState<HandoffForMe[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'good' | 'off'; text: string } | null>(null)

  useEffect(() => {
    let live = true
    getHandoffsForMe().then((list) => { if (live) setAsks(list ?? []) }).catch(() => {})
    return () => { live = false }
  }, [])

  async function answer(h: HandoffForMe, accept: boolean) {
    setBusy(`${h.id}-${accept ? 'yes' : 'no'}`)
    setMsg(null)
    try {
      await answerHandoff(h.id, accept)
      setAsks((list) => list.filter((x) => x.id !== h.id))
      setMsg(accept
        ? { tone: 'good', text: `You're the organizer of ${h.name} now. ${h.from || 'They'} stay${h.from ? 's' : ''} on as a co-organizer.` }
        : { tone: 'good', text: `Done. We've let ${h.from || 'them'} know.` })
      onAnswered()
    } catch (e) {
      setMsg({ tone: 'off', text: errorText(e) })
    } finally {
      setBusy(null)
    }
  }

  if (!asks.length && !msg) return null
  return (
    <div className="mb-5 grid gap-3">
      {asks.map((h) => (
        <Card key={h.id}>
          <SectionTitle hint={`You'd become the organizer. ${h.from || 'They'} stay${h.from ? 's' : ''} on as a co-organizer.`}>
            <span className="flex items-start gap-2"><ArrowLeftRight className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden /><span>{h.from || 'An organizer'} asked you to run {h.name}</span></span>
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" busy={busy === `${h.id}-yes`} disabled={!!busy} onClick={() => void answer(h, true)}>Yes, I&apos;ll run it</Button>
            <Button busy={busy === `${h.id}-no`} disabled={!!busy} onClick={() => void answer(h, false)}>No thanks</Button>
          </div>
        </Card>
      ))}
      {msg && <Notice tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Notice>}
    </div>
  )
}

/** "You're now an organizer for …" after someone added you to a group. */
export function GroupsClaimedNotice({ groups }: { groups: GroupClaimed[] }) {
  const [open, setOpen] = useState(groups.length > 0)
  if (!open || !groups.length) return null
  const names = groups.map((g) => g.name).join(' and ')
  const handedOver = groups.some((g) => g.handoff)
  const where = `${groups.length > 1 ? 'Their pages' : 'Its page'} and organizers are under Host page.`
  return (
    <div className="mb-5">
      <Notice tone="good" onClose={() => setOpen(false)}>
        {handedOver
          ? `${names} ${groups.length > 1 ? 'are' : 'is'} yours to run now. ${where}`
          : `You're now an organizer for ${names}. ${where}`}
      </Notice>
    </div>
  )
}

const STEPPED_KEY = 'organizers.steppedDown'

/** Remembered across the move to Your rides after stepping down from a group. */
export function rememberSteppedDown(group: string) {
  try { sessionStorage.setItem(STEPPED_KEY, group) } catch { /* the notice is a nicety */ }
}

/** "You stepped down from …" on Your rides, once. */
export function SteppedDownNotice() {
  const [group, setGroup] = useState<string | null>(null)
  useEffect(() => {
    try {
      const g = sessionStorage.getItem(STEPPED_KEY)
      if (g) { setGroup(g); sessionStorage.removeItem(STEPPED_KEY) }
    } catch { /* storage blocked */ }
  }, [])
  if (!group) return null
  return (
    <div className="mb-5">
      <Notice tone="good" onClose={() => setGroup(null)}>
        You stepped down from {group}. Rides you set up are still yours, below.
      </Notice>
    </div>
  )
}
