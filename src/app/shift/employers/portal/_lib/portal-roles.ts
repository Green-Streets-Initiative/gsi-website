import type { GroupAdmin } from './portal-types'

/**
 * Portal roles (Keith 2026-10-01): Admin, Manager, Viewer, plus the account
 * Owner — the person who signed up and paid, always an admin, and only
 * Green Streets can move or remove them.
 *
 * MANAGER_ROLE_ENABLED: flip to true in the push that ships after Shift
 * migration 01081 is applied (it adds 'manager' to the database's role check,
 * the owner marker and the owner's team-change email) and gsi-website's
 * `employer-invite` function is redeployed. While false the Team settings
 * never offer Manager, because the database would refuse it. Anyone who
 * already is a manager still shows as one either way.
 */
export const MANAGER_ROLE_ENABLED = true

export type PortalRole = 'admin' | 'manager' | 'viewer'

export const ROLE_LABEL: Record<PortalRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
}

/** One plain line per role, for Team settings and the help drawer. */
export const ROLE_SUMMARY: Record<PortalRole, string> = {
  admin: 'Can do everything: challenges, inviting employees, settings, billing and the team.',
  manager:
    "Can run challenges and prizes, invite employees and edit the Commute Advisor page. Can't change settings, billing or the team.",
  viewer: 'Can see everything and change nothing.',
}

export const OWNER_SUMMARY =
  'The person who signed up for Shift. Always an admin, and no one else on the team can remove them or change their role. To change the owner, email info@gogreenstreets.org.'

/** The role on a group_admins row; anything unexpected reads as viewer (least access). */
export function normalizeRole(raw: string | null | undefined): PortalRole {
  return raw === 'admin' || raw === 'manager' || raw === 'viewer' ? raw : 'viewer'
}

/** The roles an admin can choose from right now. */
export function assignableRoles(current?: PortalRole): PortalRole[] {
  return MANAGER_ROLE_ENABLED || current === 'manager' ? ['admin', 'manager', 'viewer'] : ['admin', 'viewer']
}

/**
 * Whether this row is the account owner. After migration 01081 the database
 * says so (is_owner). Before it, the owner is the admin whose email matches
 * the company's sign-up email, which is exactly what 01081 backfills.
 */
export function isOwnerRow(a: GroupAdmin, adminEmail: string | null | undefined): boolean {
  if (typeof a.is_owner === 'boolean') return a.is_owner
  return a.role === 'admin' && !!adminEmail && a.email.toLowerCase() === adminEmail.toLowerCase()
}

/** True once 01081 is applied (the rows carry is_owner). */
export function ownerColumnPresent(admins: GroupAdmin[]): boolean {
  return admins.some((a) => typeof a.is_owner === 'boolean')
}
