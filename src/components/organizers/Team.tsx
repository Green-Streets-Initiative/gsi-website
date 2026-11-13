'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftRight, Copy, UserPlus } from 'lucide-react'
import {
  answerHandoff, cancelHandoff, errorText, getHandoff, getMembers, inviteLeader, myUserId, requestHandoff,
  revokeLeaderInvite, rideJoinUrl, rotateInviteCode, setMemberRole,
} from '@/lib/organizers/api'
import { ago } from '@/lib/rides/public'
import { useRide } from './RideFrame'
import { Badge, Button, Card, copyText, Dialog, Field, Input, Notice, SectionTitle, Select } from './ui'

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
  const [allRiders, setAllRiders] = useState(false)
  /** Who the ride is waiting on to take it over (Shift 01288), and who's signed in. */
  const [handoffTo, setHandoffTo] = useState<string | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [asking, setAsking] = useState<Member | null>(null)
  const [newLink, setNewLink] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!canRename) return
    getMembers(r.id).then(setMembers).catch(() => setMembers([]))
  }, [r.id, canRename, detail.leaders.length])

  useEffect(() => {
    let live = true
    Promise.all([getHandoff(r.id), myUserId()])
      .then(([to, uid]) => { if (live) { setHandoffTo(to); setMe(uid) } })
      .catch(() => {})
    return () => { live = false }
  }, [r.id, detail.ride.organizer_user_id])

  async function invite(e: FormEvent) {
    e.preventDefault()
    setBusy('invite')
    setMsg(null)
    try {
      const res = await inviteLeader(r.id, email)
      const who = email.trim()
      setMsg({
        tone: 'good',
        text: res.status === 'invited' ? `Invited ${who}.${res.emailed ? ' They have an email with how to sign in.' : res.already_emailed ? ' We already emailed them today, so no new email went out.' : ''} Once they sign in here or in the app with that address, they're a leader.`
          : res.status === 'made_leader' ? `${who} was already on the ride and is now a leader.${res.emailed ? " We've let them know." : ''}`
            : res.status === 'already_leader' ? `${who} is already a leader.` : `${who} organizes this ride.`,
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
  // Anyone on the ride with a Shift account can be asked to take it over: leaders first.
  const takers = members
    .filter((m) => m.role !== 'organizer' && m.user_id && !m.is_you)
    .sort((a, b) => (a.role === 'leader' ? 0 : 1) - (b.role === 'leader' ? 0 : 1) || a.display_name.localeCompare(b.display_name))
  const waitingOn = handoffTo ? members.find((m) => m.user_id === handoffTo) ?? null : null
  const askedMe = !!handoffTo && !!me && handoffTo === me
  const ended = r.status === 'archived'

  async function handoff(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key)
    setMsg(null)
    try {
      await fn()
      setMsg({ tone: 'good', text: done })
      setHandoffTo(await getHandoff(r.id))
      setAsking(null)
      await reload()
    } catch (err) {
      setMsg({ tone: 'off', text: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {msg && <Notice tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Notice>}

      {askedMe && !ended && (
        <Card>
          <SectionTitle hint="You'd become the organizer. They stay on as a leader.">
            {detail.organizer_person || 'The organizer'} asked you to run this ride
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" busy={busy === 'accept'}
              onClick={() => void handoff('accept', () => answerHandoff(r.id, true), "You're the organizer now. They stay on as a leader.")}>
              Yes, I&apos;ll run it
            </Button>
            <Button busy={busy === 'decline'}
              onClick={() => void handoff('decline', () => answerHandoff(r.id, false), "Done. We've let them know.")}>
              No thanks
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle hint="Leaders see who's coming and post updates.">
          Who runs this ride
        </SectionTitle>
        <ul className="divide-y divide-(--ev-line)">
          {detail.leaders.map((l) => (
            <li key={l.member_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-(--ev-ink)">{l.name}{l.is_you ? ' (you)' : ''}</span>
                <Badge tone={l.role === 'organizer' ? 'good' : 'plain'}>{l.role === 'organizer' ? 'Organizer' : 'Leader'}</Badge>
              </div>
              {canRename && l.role === 'leader' && (
                <Button size="sm" variant="ghost" busy={busy === l.member_id}
                  onClick={() => void act(l.member_id, () => setMemberRole(r.id, l.user_id, 'rider'), `${l.name} is no longer a leader. They stay on the ride.`)}>
                  Remove as leader
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
          <SectionTitle hint="They get an email and sign in with that address.">
            Invite a leader
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

      {manage && !ended && r.invite_code && (
        <Card>
          <SectionTitle hint="Once they join in the Shift app, make them a leader below.">
            Or send the ride&apos;s link
          </SectionTitle>
          <p className="break-all text-[15px] text-(--ev-ink-85)">{rideJoinUrl(r.invite_code)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={async () => { setCopied(await copyText(rideJoinUrl(r.invite_code))); setTimeout(() => setCopied(false), 2500) }}>
              <Copy className="h-4 w-4" aria-hidden />{copied ? 'Copied' : 'Copy the link'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewLink(true)}>Make a new link</Button>
          </div>
        </Card>
      )}

      <Dialog open={newLink} onClose={() => setNewLink(false)} title="Make a new link?"
        footer={<>
          <Button onClick={() => setNewLink(false)}>Keep this one</Button>
          <Button variant="danger" busy={busy === 'rotate'}
            onClick={() => void act('rotate', async () => { await rotateInviteCode(r.id); setNewLink(false) }, 'New link ready. Share it from here or from Promote.')}>
            Make new link
          </Button>
        </>}>
        <p className="text-[15px] leading-snug text-(--ev-ink-85)">
          The old link and code stop working right away, including on printed flyers. People already on the ride stay on it.
        </p>
      </Dialog>

      {canRename && riders.length > 0 && (
        <Card>
          <SectionTitle hint="People already on the ride with the Shift app.">Make someone on the ride a leader</SectionTitle>
          <ul className="divide-y divide-(--ev-line)">
            {(allRiders ? riders : riders.slice(0, 6)).map((m) => (
              <li key={m.member_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="text-[15px] text-(--ev-ink)">{m.display_name}</span>
                <Button size="sm" busy={busy === m.member_id}
                  onClick={() => void act(m.member_id, () => setMemberRole(r.id, m.user_id!, 'leader'), `${m.display_name} is now a leader.`)}>
                  Make a leader
                </Button>
              </li>
            ))}
          </ul>
          {riders.length > 6 && (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAllRiders((v) => !v)}>
              {allRiders ? 'Show fewer' : `Show all ${riders.length}`}
            </Button>
          )}
        </Card>
      )}

      {canRename && !ended && (waitingOn || handoffTo || takers.length > 0) && (
        <Card>
          <SectionTitle hint="They become the organizer once they say yes. Until then, you are. After, you stay on as a leader.">
            Hand the ride to someone
          </SectionTitle>
          {handoffTo ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px] text-(--ev-ink-85)">
                <span className="font-semibold text-(--ev-ink)">Waiting for {waitingOn?.display_name || 'them'} to say yes.</span>{' '}
                You&apos;re still the organizer until they do. They answer in the Shift app.
              </p>
              <Button size="sm" variant="ghost" busy={busy === 'cancel-handoff'}
                onClick={() => void handoff('cancel-handoff', () => cancelHandoff(r.id), 'Cancelled. You still run the ride.')}>
                Cancel the hand-off
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field label="Someone on the ride" htmlFor="handoff-to">
                  <Select id="handoff-to" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">Choose someone</option>
                    {takers.map((m) => (
                      <option key={m.member_id} value={m.user_id!}>{m.display_name}{m.role === 'leader' ? ' (leader)' : ''}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button disabled={!pick} onClick={() => setAsking(takers.find((m) => m.user_id === pick) ?? null)}>
                <ArrowLeftRight className="h-4 w-4" aria-hidden />Ask them
              </Button>
            </div>
          )}
        </Card>
      )}

      <Dialog open={!!asking} onClose={() => setAsking(null)} title={`Hand ${r.name} to ${asking?.display_name ?? ''}?`}
        footer={<>
          <Button onClick={() => setAsking(null)}>Never mind</Button>
          <Button variant="primary" busy={busy === 'ask-handoff'}
            onClick={() => asking && void handoff('ask-handoff', () => requestHandoff(r.id, asking.user_id!), `Asked ${asking.display_name}. You're still the organizer until they say yes.`)}>
            Ask {asking?.display_name}
          </Button>
        </>}>
        <p className="text-[15px] leading-snug text-(--ev-ink-85)">
          {asking?.display_name} gets a notice in the Shift app and becomes the organizer when they say yes. You&apos;ll stay on as a leader.
        </p>
      </Dialog>
    </div>
  )
}
