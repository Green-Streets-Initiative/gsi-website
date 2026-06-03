// Seed a fully populated "Loomis Sayles" employer demo account.
//
// Creates 12 fake employees, an employer group, group memberships,
// an active challenge, ~90 trips, and a reward pool — enough data
// for the Impact dashboard, leaderboard, and Commute Advisor to
// look like a company 30 days into active use.
//
// Usage:
//   node scripts/seed-loomis-demo.mjs
//
// Prerequisites:
//   1. Paste supabase/migrations/20260603_employer_demo_prep.sql
//      into the Supabase SQL editor and run it.
//   2. .env.local must contain NEXT_PUBLIC_SUPABASE_URL and
//      SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ── env ─────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── constants ───────────────────────────────────────────────────

const ADMIN_EMAIL = 'info@gogreenstreets.org'
const GROUP_NAME = 'Loomis Sayles'

// id is populated at runtime after auth user creation/lookup
const EMPLOYEES = [
  { id: null, name: 'Sarah Mitchell',   email: 'sarah.mitchell@demo.shift.gsi' },
  { id: null, name: 'James Chen',       email: 'james.chen@demo.shift.gsi' },
  { id: null, name: 'Priya Sharma',     email: 'priya.sharma@demo.shift.gsi' },
  { id: null, name: 'Marcus Johnson',   email: 'marcus.johnson@demo.shift.gsi' },
  { id: null, name: 'Elena Rodriguez',  email: 'elena.rodriguez@demo.shift.gsi' },
  { id: null, name: 'David Kim',        email: 'david.kim@demo.shift.gsi' },
  { id: null, name: 'Amanda Foster',    email: 'amanda.foster@demo.shift.gsi' },
  { id: null, name: 'Ryan O\'Brien',    email: 'ryan.obrien@demo.shift.gsi' },
  { id: null, name: 'Mei-Lin Wu',       email: 'mei-lin.wu@demo.shift.gsi' },
  { id: null, name: 'Thomas Nguyen',    email: 'thomas.nguyen@demo.shift.gsi' },
  { id: null, name: 'Rachel Park',      email: 'rachel.park@demo.shift.gsi' },
  { id: null, name: 'Chris Andersson',  email: 'chris.andersson@demo.shift.gsi' },
]

// Each employee's commute profile: which modes they use and how often
const COMMUTE_PROFILES = [
  // Sarah — walker, short commute from Back Bay
  { empIdx: 0, trips: [
    { mode: 'walk', count: 5, distRange: [0.6, 1.2] },
    { mode: 'transit_train', count: 1, distRange: [3, 5] },
  ]},
  // James — bike commuter from Cambridge
  { empIdx: 1, trips: [
    { mode: 'bike', count: 5, distRange: [3.5, 5.5] },
    { mode: 'drive', count: 1, distRange: [5, 7] },
  ]},
  // Priya — commuter rail from suburbs
  { empIdx: 2, trips: [
    { mode: 'transit_commuter_rail', count: 5, distRange: [8, 14] },
    { mode: 'drive', count: 2, distRange: [12, 16] },
  ]},
  // Marcus — mixed bike + transit
  { empIdx: 3, trips: [
    { mode: 'bike', count: 3, distRange: [2.5, 4.5] },
    { mode: 'transit_bus', count: 3, distRange: [3, 6] },
    { mode: 'drive', count: 1, distRange: [6, 9] },
  ]},
  // Elena — walker + occasional drive
  { empIdx: 4, trips: [
    { mode: 'walk', count: 5, distRange: [0.8, 1.5] },
    { mode: 'drive', count: 3, distRange: [4, 8] },
  ]},
  // David — transit devotee (bus + train)
  { empIdx: 5, trips: [
    { mode: 'transit_bus', count: 3, distRange: [2.5, 5] },
    { mode: 'transit_train', count: 4, distRange: [3, 6] },
    { mode: 'drive', count: 1, distRange: [5, 8] },
  ]},
  // Amanda — bike + e-scooter
  { empIdx: 6, trips: [
    { mode: 'bike', count: 5, distRange: [2, 4] },
    { mode: 'escooter', count: 3, distRange: [1.2, 2.5] },
  ]},
  // Ryan — carpool mostly, some transit
  { empIdx: 7, trips: [
    { mode: 'carpool', count: 4, distRange: [8, 14] },
    { mode: 'transit_commuter_rail', count: 2, distRange: [10, 15] },
    { mode: 'drive', count: 2, distRange: [10, 14] },
  ]},
  // Mei-Lin — walk + bike
  { empIdx: 8, trips: [
    { mode: 'walk', count: 4, distRange: [0.5, 1.0] },
    { mode: 'bike', count: 3, distRange: [2, 3.5] },
  ]},
  // Thomas — mostly drives (shift target)
  { empIdx: 9, trips: [
    { mode: 'drive', count: 5, distRange: [6, 12] },
    { mode: 'transit_bus', count: 2, distRange: [4, 7] },
    { mode: 'carpool', count: 1, distRange: [8, 12] },
  ]},
  // Rachel — commuter rail rider
  { empIdx: 10, trips: [
    { mode: 'transit_bus', count: 2, distRange: [2, 4] },
    { mode: 'transit_train', count: 3, distRange: [4, 7] },
    { mode: 'drive', count: 3, distRange: [8, 12] },
  ]},
  // Chris — bike + walk
  { empIdx: 11, trips: [
    { mode: 'bike', count: 4, distRange: [3, 5] },
    { mode: 'walk', count: 4, distRange: [0.7, 1.3] },
  ]},
]

const EMPLOYER_BENEFITS = {
  destination_address: 'One Financial Center, Boston, MA 02111',
  destination_lat: 42.3525,
  destination_lng: -71.0558,
  transit_subsidy_monthly: 150,
  transit_subsidy_type: 'pre_tax',
  transit_subsidy_label: 'Pre-tax commuter benefit up to $150/month',
  bluebikes_subsidized: true,
  bluebikes_subsidy_label: 'Annual Bluebikes membership covered for all employees',
  bike_parking: true,
  bike_parking_details: 'Secure bike cage in garage level B1, keycard access',
  showers: true,
  shower_details: 'Locker rooms with showers on floors 3 and 7',
  free_parking: false,
  parking_cost_monthly: 400,
  hr_contact_name: 'Benefits Team',
  hr_contact_email: 'benefits@loomissayles.com',
  other_benefits: 'Flexible start times between 7:30 and 9:30 AM',
}

// ── helpers ─────────────────────────────────────────────────────

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function roundTo(n, decimals) {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

function speedMph(mode) {
  const speeds = {
    walk: 3.2, bike: 12, transit_bus: 14, transit_train: 22,
    transit_commuter_rail: 30, escooter: 10, carpool: 28, drive: 28,
  }
  return speeds[mode] ?? 15
}

function generateTrips(groupId) {
  const trips = []
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  for (const profile of COMMUTE_PROFILES) {
    const emp = EMPLOYEES[profile.empIdx]

    for (const slot of profile.trips) {
      for (let i = 0; i < slot.count; i++) {
        const dist = roundTo(randomBetween(slot.distRange[0], slot.distRange[1]), 2)
        const speed = speedMph(slot.mode)
        const durationMin = Math.round((dist / speed) * 60)

        // Random day in the last 30 days
        const dayOffset = Math.floor(Math.random() * 30)
        const baseDate = new Date(thirtyDaysAgo + dayOffset * 24 * 60 * 60 * 1000)

        // Morning or evening commute
        const isMorning = Math.random() > 0.4
        const hourBase = isMorning
          ? 7 + Math.random() * 2.5   // 7:00 – 9:30
          : 16.5 + Math.random() * 2.5 // 4:30 – 7:00
        const hour = Math.floor(hourBase)
        const minute = Math.floor((hourBase - hour) * 60)
        baseDate.setHours(hour, minute, 0, 0)

        const startedAt = baseDate.toISOString()
        const endedAt = new Date(baseDate.getTime() + durationMin * 60 * 1000).toISOString()

        trips.push({
          user_id: emp.id,
          mode: slot.mode,
          distance_miles: dist,
          duration_minutes: durationMin,
          detection_method: 'manual',
          user_confirmed: true,
          started_at: startedAt,
          ended_at: endedAt,
        })
      }
    }
  }

  return trips
}

// ── main ────────────────────────────────────────────────────────

async function main() {
  console.log('Shift Employer Platform — Loomis Sayles demo seed\n')

  // 1. Idempotency check
  const { data: existing } = await sb
    .from('groups')
    .select('id')
    .eq('name', GROUP_NAME)
    .eq('type', 'workplace')
    .maybeSingle()

  if (existing) {
    console.log(`Group "${GROUP_NAME}" already exists (${existing.id}). Exiting.`)
    console.log('To re-seed, delete the group first or run the cleanup script.')
    process.exit(0)
  }

  // 2. Create auth users and resolve their IDs
  console.log('Creating 12 auth users...')
  for (const emp of EMPLOYEES) {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: emp.email,
      email_confirm: true,
      user_metadata: { display_name: emp.name },
    })
    if (error) {
      if (error.message?.includes('already been registered') || error.status === 422) {
        console.log(`  ${emp.name} — auth user exists, looking up ID`)
      } else {
        console.error(`  Failed to create auth user for ${emp.name}:`, error.message)
        process.exit(1)
      }
    } else {
      emp.id = created.user.id
      console.log(`  ${emp.name} — created (${emp.id})`)
    }
  }

  // Resolve IDs for any pre-existing users
  const unresolved = EMPLOYEES.filter((e) => !e.id)
  if (unresolved.length > 0) {
    const { data: allUsers } = await sb.auth.admin.listUsers({ perPage: 1000 })
    const byEmail = new Map(allUsers.users.map((u) => [u.email, u.id]))
    for (const emp of unresolved) {
      emp.id = byEmail.get(emp.email)
      if (!emp.id) {
        console.error(`  Could not find auth user for ${emp.email}`)
        process.exit(1)
      }
      console.log(`  ${emp.name} — resolved (${emp.id})`)
    }
  }

  // 3. Create public users
  console.log('Creating public user profiles...')
  const { error: usersErr } = await sb.from('users').upsert(
    EMPLOYEES.map((e) => ({
      id: e.id,
      email: e.email,
      display_name: e.name,
    })),
    { onConflict: 'id' },
  )
  if (usersErr) {
    console.error('Failed to create public users:', usersErr.message)
    process.exit(1)
  }
  console.log('  12 public user profiles ready')

  // 4. Create employer group
  console.log('Creating Loomis Sayles employer group...')
  const now = new Date()
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  const { data: group, error: groupErr } = await sb
    .from('groups')
    .insert({
      name: GROUP_NAME,
      slug: 'loomis-sayles',
      description: 'Loomis Sayles & Company, L.P.',
      type: 'workplace',
      visibility: 'gated',
      tier: 'premium',
      status: 'active',
      admin_email: ADMIN_EMAIL,
      admin_name: 'Keith Anderson',
      city: 'Boston',
      state: 'MA',
      website_url: 'https://www.loomissayles.com',
      public_leaderboard: false,
      access_starts_at: now.toISOString(),
      access_ends_at: oneYearFromNow.toISOString(),
      employer_benefits: EMPLOYER_BENEFITS,
      commute_advisor_enabled: true,
    })
    .select('id, invite_code, slug')
    .single()

  if (groupErr) {
    console.error('Failed to create group:', groupErr.message)
    process.exit(1)
  }
  console.log(`  Group created: ${group.id}`)
  console.log(`  Invite code: ${group.invite_code}`)
  console.log(`  Commute Advisor: /commute-advisor/${group.slug}`)

  // 5. Create group members (stagger join dates over past 3 weeks)
  console.log('Adding 12 employees as group members...')
  const threeWeeksAgo = now.getTime() - 21 * 24 * 60 * 60 * 1000
  const { error: membersErr } = await sb.from('group_members').insert(
    EMPLOYEES.map((emp, i) => {
      const joinOffset = Math.floor((i / EMPLOYEES.length) * 21)
      const joinDate = new Date(threeWeeksAgo + joinOffset * 24 * 60 * 60 * 1000)
      return {
        group_id: group.id,
        user_id: emp.id,
        role: 'member',
        joined_at: joinDate.toISOString(),
      }
    }),
  )
  if (membersErr) {
    console.error('Failed to add group members:', membersErr.message)
    process.exit(1)
  }
  console.log('  12 members added')

  // 6. Create active competition
  console.log('Creating Summer Commute Challenge...')
  const { error: compErr } = await sb.from('competitions').insert({
    group_id: group.id,
    name: 'Summer Commute Challenge 2026',
    metric: 'pct_non_car',
    duration_type: 'fixed',
    starts_at: '2026-06-01T04:00:00Z',
    ends_at: '2026-08-31T03:59:59Z',
    event_type: 'employer',
    is_public: false,
    verified_only: false,
    prize_description: 'Top 3 finishers receive $100 gift cards',
  })
  if (compErr) {
    console.error('Failed to create competition:', compErr.message)
    if (compErr.message?.includes('prize_description')) {
      console.error('\n  The prize_description column is missing on the competitions table.')
      console.error('  Paste supabase/migrations/20260603_employer_demo_prep.sql into the')
      console.error('  Supabase SQL editor and run it, then re-run this script.\n')
    }
    process.exit(1)
  }
  console.log('  Challenge created: Summer Commute Challenge 2026')

  // 7. Generate and insert trips
  console.log('Generating trip data...')
  const trips = generateTrips(group.id)
  const { error: tripsErr } = await sb.from('trips').insert(trips)
  if (tripsErr) {
    console.error('Failed to insert trips:', tripsErr.message)
    process.exit(1)
  }

  const activeTrips = trips.filter(
    (t) => !['drive', 'carpool', 'other'].includes(t.mode),
  )
  const shiftRate = Math.round((activeTrips.length / trips.length) * 100)
  console.log(`  ${trips.length} trips inserted (${activeTrips.length} active, ${shiftRate}% shift rate)`)

  // 8. Create reward pool
  console.log('Creating reward pool ($500)...')
  const { error: poolErr } = await sb.from('reward_pools').insert({
    name: 'Loomis Sayles Employee Rewards',
    owner_type: 'employer',
    owner_group_id: group.id,
    balance_cents: 50000,
    lifetime_funded_cents: 50000,
    lifetime_spent_cents: 0,
    active: true,
  })
  if (poolErr) {
    console.error('Failed to create reward pool:', poolErr.message)
    // Non-fatal — the portal handles a missing pool gracefully
    console.error('  (Continuing — reward pool section will be empty in portal)')
  } else {
    console.log('  Reward pool created: $500.00 balance')
  }

  // 9. Verify RPCs
  console.log('\nVerifying employer RPCs...')

  const { data: dashData, error: dashErr } = await sb.rpc(
    'get_employer_dashboard_data',
    { p_group_id: group.id, p_days: 30 },
  )
  if (dashErr) {
    console.error('  get_employer_dashboard_data FAILED:', dashErr.message)
    if (dashErr.message?.includes('does not exist') || dashErr.message?.includes('not found')) {
      console.error('  This RPC needs to be deployed. Paste the SQL from:')
      console.error('  ShiftApp/supabase/migrations/00236_employer_dashboard_custom_range.sql')
    }
  } else if (dashData?.error) {
    // RPC exists but returned an app-level error (e.g. "forbidden")
    // This is expected since the service role doesn't match auth.uid()
    console.log('  get_employer_dashboard_data — deployed (auth check expected in service-role context)')
  } else {
    console.log(`  get_employer_dashboard_data — OK`)
    console.log(`    ${dashData.member_count} members, ${dashData.trips_this_period} trips, ${dashData.shift_rate_trip_pct}% shift rate`)
  }

  const { data: membData, error: membErr } = await sb.rpc(
    'get_employer_members',
    { p_group_id: group.id, p_days: 30 },
  )
  if (membErr) {
    console.error('  get_employer_members FAILED:', membErr.message)
    if (membErr.message?.includes('does not exist') || membErr.message?.includes('not found')) {
      console.error('  This RPC needs to be deployed. Paste the SQL from:')
      console.error('  ShiftApp/supabase/migrations/00234_employer_rpcs_with_period.sql')
    }
  } else {
    console.log(`  get_employer_members — OK (${membData?.length ?? 0} members returned)`)
  }

  // 10. Summary
  console.log('\n' + '='.repeat(60))
  console.log('Seed complete!')
  console.log('='.repeat(60))
  console.log(`\n  Group:        ${GROUP_NAME}`)
  console.log(`  Group ID:     ${group.id}`)
  console.log(`  Invite code:  ${group.invite_code}`)
  console.log(`  Tier:         Premium`)
  console.log(`  Employees:    12`)
  console.log(`  Trips:        ${trips.length}`)
  console.log(`  Shift rate:   ~${shiftRate}%`)
  console.log(`  Reward pool:  $500.00`)
  console.log(`  Challenge:    Summer Commute Challenge 2026 (Jun 1 – Aug 31)`)
  console.log(`\n  Commute Advisor: https://gogreenstreets.org/commute-advisor/${group.slug}`)
  console.log(`\n  To demo:`)
  console.log(`    1. Go to https://gogreenstreets.org/shift/employers`)
  console.log(`    2. Enter: ${ADMIN_EMAIL}`)
  console.log(`    3. Click the magic link in your email`)
  console.log(`    4. The portal will load with all demo data populated\n`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
