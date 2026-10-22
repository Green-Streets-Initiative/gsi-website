'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { errorText, getMembers, inviteLeader, revokeLeaderInvite, setMemberRole } from '@/lib/organizers/api'
import { ago } from '@/lib/rides/public'
import { useRide } from './RideFrame'
import { Badge, Button, Card, Field, Input, Notice, SectionTitle } from './ui'

type Member = Awaited<ReturnType<typeof getMembers>>[number]

export default function Team() {
  const { detail, reload } = useRide()
  const r = detail.ride
  const manage = detail.my_role === 'organizer' || detail.my_role === 'admin'
  const canRename = detail.my_role === 'organizer' // set_ride_member_role is the organizer's alone
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'good' | 'off'; text: string } | null>(null)
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (!canRename) return
    getMembers(r.id).then(setMembers).catch(() => setMembers([]))
  }, [r.id, canRename, detail.leaders.length])

  async function invite(e: FormEvent) {
    e.preventDefault()
    setBusy('invite')
    setMsg(null)
    try {
      const res = await inviteLeader(r.id, email)
      const who = email.trim()
      setMsg({
        tone: 'good',
        text: res.status === 'invited' ? `Invited ${who}.${res.emailed ? ' They have an email with how to sign in.' : ''} Once they sign in here or in the app with that address, they're a co-organizer.`
          : res.status === 'made_leader' ? `${who} was already on the ride and is now a co-organizer.${res.emailed ? " We've let them know." : ''}`
            : res.status === 'already_leader' ? `${who} is already a co-organizer.` : `${who} organizes this ride.`,
      })
      setEmail('')
      await reload()
    } catch (err) {
      setMsg({ tone: 'off', text: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  async function act(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key)
    setMsg(null)
    try {
      await fn()
      setMsg({ tone: 'good', text: done })
      await reload()
    } catch (err) {
      setMsg({ tone: 'off', text: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  const riders = members.filter((m) => m.role === 'rider' && m.user_id)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {msg && <Notice tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Notice>}

      <Card>
        <SectionTitle hint="Co-organizers see who's coming and post updates to everyone on the ride, here or in the app. The organizer sets up dates and details.">
          Who runs this ride
        </SectionTitle>
        <ul className="divide-y divide-(--ev-line)">
          {detail.leaders.map((l) => (
            <li key={l.member_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-(--ev-ink)">{l.name}{l.is_you ? ' (you)' : ''}</span>
                <Badge tone={l.role === 'organizer' ? 'good' : 'plain'}>{l.role === 'organizer' ? 'Organizer' : 'Co-organizer'}</Badge>
              </div>
              {canRename && l.role === 'leader' && (
                <Button size="sm" variant="ghost" busy={busy === l.member_id}
                  onClick={() => void act(l.member_id, () => setMemberRole(r.id, l.user_id, 'rider'), `${l.name} is no longer a co-organizer. They stay on the ride.`)}>
                  Remove as co-organizer
                </Button>
              )}
            </li>
          ))}
          {detail.leader_invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] text-(--ev-ink-85)">{i.email}</span>
                <Badge tone="info">Invited {ago(i.created_at)}</Badge>
              </div>
              {manage && (
                <Button size="sm" variant="ghost" busy={busy === i.id}
                  onClick={() => void act(i.id, () => revokeLeaderInvite(i.id), `Withdrew the invite to ${i.email}.`)}>
                  Withdraw invite
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {manage && r.status !== 'archived' && (
        <Card>
          <SectionTitle hint="We email them a link. They sign in with that address, here or in the Shift app, and the ride is theirs to help run.">
            Invite a co-organizer
          </SectionTitle>
          <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Their email" htmlFor="lead-email">
                <Input id="lead-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.org" />
              </Field>
            </div>
            <Button type="submit" variant="primary" busy={busy === 'invite'} disabled={!email.trim()}>
              <UserPlus className="h-4 w-4" aria-hidden />Send invite
            </Button>
          </form>
        </Card>
      )}

      {canRename && riders.length > 0 && (
        <Card>
          <SectionTitle hint="People already on the ride with the Shift app.">Make someone on the ride a co-organizer</SectionTitle>
          <ul className="divide-y divide-(--ev-line)">
            {riders.map((m) => (
              <li key={m.member_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="text-[15px] text-(--ev-ink)">{m.display_name}</span>
                <Button size="sm" busy={busy === m.member_id}
                  onClick={() => void act(m.member_id, () => setMemberRole(r.id, m.user_id!, 'leader'), `${m.display_name} is now a co-organizer.`)}>
                  Make co-organizer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
