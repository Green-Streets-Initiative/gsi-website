'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import type { GroupAdmin } from '../_lib/portal-types'
import {
  OWNER_SUMMARY,
  ROLE_LABEL,
  ROLE_SUMMARY,
  assignableRoles,
  isOwnerRow,
  normalizeRole,
  ownerColumnPresent,
  type PortalRole,
} from '../_lib/portal-roles'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'

const LOGIN_URL = '/shift/employers/login'
const OWNER_REASON = 'The account owner. Only Green Streets can change the owner: email info@gogreenstreets.org.'
const OWNER_REASON_GSI = 'The account owner is always an admin. Make someone else the owner first.'

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-[10px] text-[14px] text-ink outline-none transition-shadow placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent-soft'
const selectClass =
  'w-full rounded-[10px] border border-line bg-surface px-3 py-[10px] text-[14px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-60'

function personName(a: GroupAdmin): string {
  return a.name || a.email
}

function aRole(r: PortalRole): string {
  return r === 'admin' ? 'an admin' : r === 'manager' ? 'a manager' : 'a viewer'
}

const ROLE_TONE: Record<PortalRole, 'info' | 'success' | 'neutral'> = {
  admin: 'info',
  manager: 'success',
  viewer: 'neutral',
}

/** The database's own words for the owner/team rules (01081), or a plain fallback. */
function friendlyTeamError(message: string | undefined, fallback: string): string {
  if (message && /account owner|Only an admin|Green Streets/i.test(message)) return message
  return fallback
}

/**
 * Who can open this portal: the people list with role changes and removal,
 * and the invite form. Used to be its own Team page; it is a section of
 * Settings now (Keith 2026-09-30). Managers and viewers see the list
 * read-only. The account owner can't be removed or given another role by
 * anyone but Green Streets, and the database enforces that too (01081).
 */
export default function TeamCard() {
  const { group, admins, setAdmins, sessionEmail, canManageTeam, isGsiAdmin } = usePortal()
  const toast = useToast()
  const confirm = useConfirm()
  const canManage = canManageTeam

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<PortalRole>('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<React.ReactNode>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (!group) return null

  const adminCount = admins.filter((a) => a.role === 'admin').length
  const me = (sessionEmail ?? '').toLowerCase()
  const ownerLive = ownerColumnPresent(admins)
  const inviteRoles = assignableRoles()
  // The legend lists the roles you can give, plus any role someone already has.
  const legendRoles = (['admin', 'manager', 'viewer'] as PortalRole[]).filter(
    (r) => inviteRoles.includes(r) || admins.some((a) => normalizeRole(a.role) === r),
  )
  const hasOwner = admins.some((a) => isOwnerRow(a, group.admin_email))

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault()
    if (!group || inviting) return
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      setInviteError('Enter a valid email address.')
      return
    }
    if (admins.some((a) => a.email.toLowerCase() === email)) {
      setInviteError('This person is already on the team.')
      return
    }
    setInviting(true)
    setInviteError(null)
    try {
      // The function owns the insert AND the invitation email. A bare insert
      // would grant silent access the invitee never learns about.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setInviteError('Your session expired. Refresh the page and try again.')
        return
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ group_id: group.id, email, role: inviteRole }),
      })
      const payload = (await res.json().catch(() => null)) as
        | { admin_row?: GroupAdmin; email_sent?: boolean; error?: string }
        | null
      if (!res.ok || !payload?.admin_row) {
        const msg = payload?.error ?? "We couldn't send the invite. Please try again."
        setInviteError(msg)
        toast(msg, { type: 'error' })
        return
      }
      setAdmins([...admins, payload.admin_row])
      setInviteEmail('')
      setInviteRole('viewer')
      if (payload.email_sent) {
        toast(`Invite sent to ${email}`, { type: 'success' })
      } else {
        setInviteError(
          <>
            {email} is on the team, but the invite email didn&apos;t send. Send them the{' '}
            <Link href={LOGIN_URL} className="font-semibold text-accent hover:underline">
              sign-in page
            </Link>{' '}
            and they can sign in with this email address.
          </>,
        )
        toast("The invite email didn't send", { type: 'error' })
      }
    } catch {
      setInviteError("We couldn't send the invite. Please try again.")
    } finally {
      setInviting(false)
    }
  }

  async function changeRole(a: GroupAdmin, newRole: PortalRole) {
    if (newRole === a.role || busyId) return
    const name = personName(a)
    const ok = await confirm({
      title: `Make ${name} ${aRole(newRole)}?`,
      body:
        newRole === 'viewer'
          ? `${name} will still see everything in this portal but won't be able to change anything.`
          : `${name} ${ROLE_SUMMARY[newRole].charAt(0).toLowerCase()}${ROLE_SUMMARY[newRole].slice(1)}`,
      confirmLabel: `Make ${ROLE_LABEL[newRole].toLowerCase()}`,
    })
    if (!ok) return
    setBusyId(a.id)
    const { error } = await supabase.from('group_admins').update({ role: newRole }).eq('id', a.id)
    setBusyId(null)
    if (error) {
      toast(friendlyTeamError(error.message, `We couldn't change ${name}'s role. Please try again.`), { type: 'error' })
      return
    }
    setAdmins(admins.map((x) => (x.id === a.id ? { ...x, role: newRole } : x)))
    toast(`${name} is now ${aRole(newRole)}`, { type: 'success' })
  }

  async function removeMember(a: GroupAdmin) {
    if (busyId) return
    const name = personName(a)
    const ok = await confirm({
      title: `Remove ${name} from the portal?`,
      body: `${name} will lose access right away. You can invite them again later.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(a.id)
    const { error } = await supabase.from('group_admins').delete().eq('id', a.id)
    setBusyId(null)
    if (error) {
      toast(friendlyTeamError(error.message, `We couldn't remove ${name}. Please try again.`), { type: 'error' })
      return
    }
    setAdmins(admins.filter((x) => x.id !== a.id))
    toast(`${name} removed`, { type: 'success' })
  }

  /** GSI staff only: move the account owner to another person on the team. */
  async function makeOwner(a: GroupAdmin) {
    if (!group || busyId) return
    const name = personName(a)
    const ok = await confirm({
      title: `Make ${name} the account owner?`,
      body: `${name} becomes an admin if they aren't one, and no one else on the team will be able to remove them or change their role. The current owner stays on the team as an admin.`,
      confirmLabel: 'Make owner',
    })
    if (!ok) return
    setBusyId(a.id)
    const { data, error } = await supabase.rpc('transfer_group_owner', { p_group_id: group.id, p_admin_id: a.id })
    setBusyId(null)
    if (error || (data as { ok?: boolean } | null)?.ok === false) {
      toast(`We couldn't make ${name} the owner. Please try again.`, { type: 'error' })
      return
    }
    setAdmins(
      admins.map((x) =>
        x.id === a.id ? { ...x, role: 'admin', is_owner: true } : x.is_owner ? { ...x, is_owner: false } : x,
      ),
    )
    toast(`${name} is now the account owner`, { type: 'success' })
  }

  return (
    <>
      <Card>
        <CardHead
          title="Team"
          sub={`Who can open this portal · ${admins.length} ${admins.length === 1 ? 'person' : 'people'}`}
        />
        <CardBody>
          <dl className="mb-4 grid gap-1.5 text-[13.5px] leading-[1.55]">
            {legendRoles.map((r) => (
              <div key={r} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 font-semibold text-ink sm:w-[72px]">{ROLE_LABEL[r]}</dt>
                <dd className="text-ink-muted">{ROLE_SUMMARY[r]}</dd>
              </div>
            ))}
            {hasOwner && (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 font-semibold text-ink sm:w-[72px]">Owner</dt>
                <dd className="text-ink-muted">{OWNER_SUMMARY}</dd>
              </div>
            )}
          </dl>
          {ownerLive && hasOwner && (
            <p className="mb-4 text-[13.5px] text-ink-muted">
              The account owner gets an email whenever someone is added, removed or given a different role.
            </p>
          )}
          {!canManage && (
            <p className="mb-4 text-[13.5px] text-ink-muted">Ask an admin to make changes.</p>
          )}
          <ul className="divide-y divide-line-2">
            {admins.map((a) => {
              const role = normalizeRole(a.role)
              const isSelf = a.email.toLowerCase() === me
              const isOwner = isOwnerRow(a, group.admin_email)
              const isLastAdmin = role === 'admin' && adminCount <= 1
              // GSI staff can move the owner, but even they can't make the
              // owner anything but an admin or remove them while they own it.
              const locked = isSelf || isLastAdmin || isOwner
              const reason = isOwner
                ? isGsiAdmin
                  ? OWNER_REASON_GSI
                  : OWNER_REASON
                : isSelf
                  ? 'This is you. Another admin can change your role or remove you.'
                  : isLastAdmin
                    ? 'The only admin. Make someone else an admin before changing this.'
                    : null
              const roleOptions = assignableRoles(role)
              return (
                <li key={a.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-ink">{personName(a)}</span>
                        <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>
                        {isOwner && <Badge tone="warn">Owner</Badge>}
                        {isSelf && <span className="text-[12px] text-ink-muted">(you)</span>}
                      </div>
                      {a.name && <div className="text-[12.5px] text-ink-muted">{a.email}</div>}
                      {canManage && reason && (
                        <p className="mt-1 text-[12.5px] text-ink-muted">{reason}</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`role-${a.id}`}>
                          Role for {personName(a)}
                        </label>
                        <select
                          id={`role-${a.id}`}
                          value={role}
                          onChange={(e) => void changeRole(a, e.target.value as PortalRole)}
                          disabled={locked || busyId === a.id}
                          title={reason ?? undefined}
                          className="rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13px] text-ink outline-none focus:border-accent disabled:opacity-60"
                        >
                          {roleOptions.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void removeMember(a)}
                          disabled={locked || busyId === a.id}
                          title={reason ?? undefined}
                        >
                          Remove
                        </Button>
                        {isGsiAdmin && ownerLive && !isOwner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void makeOwner(a)}
                            disabled={busyId === a.id}
                          >
                            Make owner
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardBody>
      </Card>

      {canManage && (
        <Card>
          <CardHead title="Invite someone" sub="They get an email with a sign-in link" />
          <CardBody>
            <form onSubmit={inviteMember} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">Email address</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value)
                    setInviteError(null)
                  }}
                  placeholder="name@yourcompany.com"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">Role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as PortalRole)}
                  className={selectClass}
                >
                  {(['viewer', 'manager', 'admin'] as PortalRole[])
                    .filter((r) => inviteRoles.includes(r))
                    .map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                type="submit"
                variant="primary"
                icon={UserPlus}
                disabled={inviting || !inviteEmail.trim()}
                className="w-full sm:w-auto"
              >
                {inviting ? 'Sending...' : 'Send invite'}
              </Button>
            </form>
            <p className="mt-3 text-[12.5px] leading-[1.55] text-ink-muted">
              <strong className="font-semibold text-ink">{ROLE_LABEL[inviteRole]}:</strong> {ROLE_SUMMARY[inviteRole]}
            </p>
            {inviteError && <p className="mt-2 text-[13px] text-ep-danger">{inviteError}</p>}
          </CardBody>
        </Card>
      )}
    </>
  )
}
