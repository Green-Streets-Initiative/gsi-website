'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { errorText } from '@/lib/organizers/api'
import { getGroupTeam, inviteGroupOrganizer, revokeGroupInvite, stepDownFromGroup, type GroupTeam as Team } from '@/lib/organizers/group'
import type { OrgClaim } from '@/lib/organizers/types'
import { Badge, Button, Card, Dialog, Field, Input, Notice, SectionTitle, Spinner } from './ui'

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

function dayText(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '' }
}

/** Rides you set up under the group, each with a link to hand it over. */
function MyRides({ rides }: { rides: Team['my_rides'] }) {
  if (!rides.length) return null
  return (
    <div className="mt-4">
      <p className="text-[15px] leading-snug text-(--ev-ink-85)">
        Rides you set up stay yours, and you keep running them. To pass one on too, open its Team tab, add a co-organizer, then hand the ride to them:
      </p>
      <ul className="mt-2 grid gap-1">
        {rides.map((r) => (
          <li key={r.id}>
            <Link href={`/organizers/rides/${r.id}/team`} className="inline-flex min-h-[36px] items-center text-[15px] font-semibold text-(--ev-accent) hover:underline">{r.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Who runs a group on Shift, on its Host page (Shift 01866): its organizers,
 * the people asked to join or take over, and adding someone, handing the
 * group on or stepping down, all without writing to Green Streets.
 */
export default function GroupTeam({ org, onSteppedDown }: { org: OrgClaim; onSteppedDown: () => void }) {
  const [team, setTeam] = useState<Team | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'good' | 'off' | 'plain'; text: string } | null>(null)
  const [confirm, setConfirm] = useState<'handoff' | 'stepdown' | null>(null)

  const load = useCallback(async () => {
    try { setTeam(await getGroupTeam(org.id)); setErr(null) } catch (e) { setErr(errorText(e, "We couldn't load who runs the group.")) }
  }, [org.id])
  useEffect(() => { void load() }, [load])

  const me = team?.organizers.find((o) => o.is_you) ?? null
  const onlyOne = !!me && team!.organizers.length === 1
  const others = (team?.organizers ?? []).filter((o) => !o.is_you).map((o) => o.name || o.email)
  const othersText = others.length > 2 ? `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}` : others.join(' and ')
  const address = email.trim().toLowerCase()

  async function invite(handoff: boolean) {
    if (!looksLikeEmail(address)) { setMsg({ tone: 'off', text: "That email address doesn't look right." }); return }
    setBusy(handoff ? 'handoff' : 'add')
    setMsg(null)
    try {
      const r = await inviteGroupOrganizer(org.id, address, handoff)
      if (r.status === 'yourself') setMsg({ tone: 'plain', text: "That's your own address. You're already an organizer." })
      else if (r.status === 'already_organizer') setMsg({ tone: 'plain', text: `${address} is already an organizer for ${org.name}.` })
      else {
        const told = r.emailed
          ? `We emailed ${address}.`
          : r.already_emailed ? `${address} already has an email from us today.` : `Ask them to open gogreenstreets.org/organizers.`
        setMsg({
          tone: 'good',
          text: handoff
            ? `${told} When they sign in with that address, ${org.name} is theirs to run and you step down. Until then, you still run it.`
            : `${told} They're an organizer as soon as they sign in with that address.`,
        })
        setEmail('')
      }
      setConfirm(null)
      await load()
    } catch (e) {
      setMsg({ tone: 'off', text: errorText(e) })
      setConfirm(null)
    } finally {
      setBusy(null)
    }
  }

  async function revoke(id: string) {
    setBusy(`revoke-${id}`)
    setMsg(null)
    try { await revokeGroupInvite(id); await load() } catch (e) { setMsg({ tone: 'off', text: errorText(e) }) } finally { setBusy(null) }
  }

  async function stepDown() {
    setBusy('stepdown')
    try {
      await stepDownFromGroup(org.id)
      setConfirm(null)
      onSteppedDown()
    } catch (e) {
      setConfirm(null)
      setMsg({ tone: 'off', text: errorText(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <SectionTitle hint="Organizers set up the group's rides and walks, keep this page up to date, and add other organizers.">
        Who runs {org.name}
      </SectionTitle>

      {err && <Notice tone="off">{err} <button type="button" className="font-semibold underline" onClick={() => void load()}>Try again</button></Notice>}
      {!team && !err && <Spinner label="Loading" />}

      {team && (
        <>
          <ul className="divide-y divide-(--ev-line) rounded-xl border border-(--ev-line-mid)">
            {team.organizers.map((o) => (
              <li key={o.user_id} className="px-4 py-3">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-(--ev-ink)">
                  <span className="min-w-0 break-all">{o.name || o.email}</span>
                  {o.is_you && <Badge tone="good">You</Badge>}
                </p>
                {o.name && <p className="break-all text-[14px] text-(--ev-ink-75)">{o.email}</p>}
                <p className="text-[14px] text-(--ev-ink-75)">Organizer since {dayText(o.since)}</p>
              </li>
            ))}
            {team.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="break-all text-[15px] font-semibold text-(--ev-ink)">{i.email}</p>
                  <p className="text-[14px] text-(--ev-ink-75)">
                    Asked {dayText(i.sent_at)} · {i.handoff ? `takes over ${org.name} when they sign in` : 'an organizer once they sign in'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" busy={busy === `revoke-${i.id}`} onClick={() => void revoke(i.id)} aria-label={`Take back the invite to ${i.email}`}>
                    <X className="h-4 w-4" aria-hidden />Take back
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <Field label="Add someone" htmlFor="group-add-email" hint="We email them. They sign in with this address and the group shows up in their organizer tools.">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="group-add-email" type="email" inputMode="email" autoComplete="off" value={email}
                  onChange={(e) => { setEmail(e.target.value); if (msg?.tone !== 'off') setMsg(null) }} placeholder="name@example.org"
                  onKeyDown={(e) => { if (e.key === 'Enter' && address) void invite(false) }} />
                <Button variant="primary" className="shrink-0" busy={busy === 'add'} disabled={!address || !!busy} onClick={() => void invite(false)}>
                  <UserPlus className="h-4 w-4" aria-hidden />Add as organizer
                </Button>
              </div>
            </Field>
            {me && (
              <button type="button" disabled={!address || !!busy}
                onClick={() => { if (!looksLikeEmail(address)) setMsg({ tone: 'off', text: "That email address doesn't look right." }); else setConfirm('handoff') }}
                className="mt-2 min-h-[44px] text-[15px] font-semibold text-(--ev-accent) hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline">
                Hand {org.name} to them instead
              </button>
            )}
          </div>

          {msg && <div className="mt-4"><Notice tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Notice></div>}

          {me && (
            <div className="mt-6 border-t border-(--ev-line) pt-4">
              {onlyOne ? (
                <p className="text-[14px] leading-snug text-(--ev-ink-75)">
                  {team.invites.length
                    ? `You're the only organizer for ${org.name} until someone you asked signs in. Then you can step down.`
                    : `You're the only organizer for ${org.name}. To step down, add someone first, or hand the group to them.`}
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[14px] leading-snug text-(--ev-ink-75)">{othersText} {others.length === 1 ? 'keeps' : 'keep'} running {org.name} if you step down.</p>
                  <Button size="sm" variant="danger" onClick={() => setConfirm('stepdown')}>Step down</Button>
                </div>
              )}
            </div>
          )}

          <Dialog open={confirm === 'handoff'} onClose={() => setConfirm(null)} title={`Hand ${org.name} to them?`}
            footer={<>
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant="primary" busy={busy === 'handoff'} onClick={() => void invite(true)}>Hand it over</Button>
            </>}>
            <p className="text-[15px] leading-snug text-(--ev-ink-85)">
              We email <b className="font-semibold text-(--ev-ink)">{address}</b>. When they sign in with that address, they run {org.name} and you step down as its organizer. Until then, you still run it, and you can take the invite back.
            </p>
            <MyRides rides={team.my_rides} />
          </Dialog>

          <Dialog open={confirm === 'stepdown'} onClose={() => setConfirm(null)} title={`Step down from ${org.name}?`}
            footer={<>
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant="danger" busy={busy === 'stepdown'} onClick={() => void stepDown()}>Step down</Button>
            </>}>
            <p className="text-[15px] leading-snug text-(--ev-ink-85)">
              You stop being an organizer for {org.name}. {othersText} {others.length === 1 ? 'keeps' : 'keep'} running it.
            </p>
            <MyRides rides={team.my_rides} />
          </Dialog>
        </>
      )}
    </Card>
  )
}
