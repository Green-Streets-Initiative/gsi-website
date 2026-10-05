'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import Toggle from '@/components/employer/Toggle'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { GroupStandingsTable, type GroupStanding } from '@/app/events/shift-your-summer/LeaderboardTabs'
import { usePortal } from '../_lib/portal-context'
import type { Group } from '../_lib/portal-types'

/** Where a public workplace shows up, in plain words. */
const SURFACES = [
  'The Workplaces tab of Shift Your Summer and Walk/Ride Day standings on gogreenstreets.org, which anyone on the web can see and search engines index.',
  'Season pages on gogreenstreets.org, with members, participants and the share taking part.',
  'The workplace boards inside the Shift app, where your employees see your company against other companies and where it stands.',
]

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What exactly is shown?',
    a: "Your company name, logo, member count, Shift Rate and active trips for the period. Never a trip or a location. One exception: inside the Shift app, a person who taps your company on a citywide event board can see the first names of employees who have set their own profile to public. Anyone whose profile is private shows as 'Shift user'. Employees change that under Profile in the app.",
  },
  {
    q: 'Can we turn it off later?',
    a: "Yes, any time. The row disappears from the open web and from the in-app boards straight away, including your own employees' board.",
  },
  {
    q: 'Does it change our own challenges or this portal?',
    a: 'No. Your challenges, employee list and impact numbers are always private to your team whichever way this is set.',
  },
]

/**
 * Whether the company appears on Shift's public leaderboards (the Workplaces
 * tab on Walk/Ride Day and Shift Your Summer, the season pages, the in-app
 * workplace boards) with its combined numbers. A company setting, so it
 * lives here rather than on each challenge. Backed by
 * sync_group_public_leaderboard (Shift 00981).
 */
export default function PublicListingCard({
  group,
  canManage,
  onChanged,
}: {
  group: Group
  canManage: boolean
  onChanged: (g: Group) => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const { dashboard, memberCount } = usePortal()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function change(on: boolean) {
    if (!canManage || saving) return
    if (on) {
      const ok = await confirm({
        title: `Show ${group.name} on public leaderboards?`,
        body: `Anyone on the web, and every Shift user, will be able to see ${group.name}'s name, logo, member count, Shift Rate and active trips next to other workplaces. In the app, tapping your company also lists employees who keep a public profile, by first name.`,
        confirmLabel: 'Show us',
      })
      if (!ok) return
    }
    setSaving(true)
    setError('')
    const { error: rpcErr } = await supabase.rpc('sync_group_public_leaderboard', {
      p_group_id: group.id,
      p_wants_public: on,
    })
    setSaving(false)
    if (rpcErr) {
      const msg = "We couldn't save that. Try again, or write to info@gogreenstreets.org."
      setError(msg)
      toast(msg, { type: 'error' })
      return
    }
    onChanged({ ...group, public_leaderboard: on })
    toast(on ? `${group.name} is now on public leaderboards` : `${group.name} is off public leaderboards`, {
      type: 'success',
    })
  }

  // The preview: this company's real 30-day numbers between two neighbours
  // that don't exist, so the row reads the way the open web would show it.
  const preview: GroupStanding[] | null = dashboard
    ? (() => {
        const rate = Math.round(dashboard.shift_rate_trip_pct)
        const trips = dashboard.active_trips_this_period
        const you: GroupStanding = {
          groupId: group.id,
          groupName: group.name,
          groupType: 'corporate',
          logoUrl: group.logo_url,
          shiftRate: rate,
          activeTrips: trips,
          memberCount: dashboard.member_count || memberCount,
        }
        const neighbour = (id: string, dRate: number, dTrips: number): GroupStanding => ({
          groupId: id,
          groupName: 'Another workplace',
          groupType: 'corporate',
          logoUrl: null,
          shiftRate: Math.max(0, Math.min(100, rate + dRate)),
          activeTrips: Math.max(0, trips + dTrips),
          memberCount: Math.max(5, Math.round(you.memberCount * 1.2)),
        })
        return [neighbour('above', 6, Math.round(trips * 0.25) + 8), you, neighbour('below', -6, -Math.round(trips * 0.2) - 4)]
      })()
    : null

  return (
    <Card>
      <CardHead title="Public listing" sub="Whether other people can see your company on Shift" />
      <CardBody>
        <div aria-busy={saving} className={saving ? 'pointer-events-none opacity-80' : ''}>
          <Toggle
            on={group.public_leaderboard}
            onChange={(v) => void change(v)}
            title={`Show ${group.name} on public leaderboards`}
            desc="On the open web and inside the app, next to other workplaces"
          />
          <p className="mt-3 text-[13px] leading-[1.55] text-ink-muted">
            {group.public_leaderboard
              ? `Anyone on the web, and every Shift user, can see ${group.name}'s name, logo, member count, Shift Rate and active trips. In the app, tapping your company also lists employees who keep a public profile, by first name.`
              : `${group.name} doesn't appear on any public leaderboard, including the workplace board your own employees see in the app. Your challenges and this portal are unaffected; they're always private to your team.`}
          </p>
          {!canManage && <p className="mt-2 text-[12.5px] text-ink-muted">Ask an admin to change this.</p>}
          {error && <p className="mt-2 text-[12.5px] text-ep-danger">{error}</p>}
        </div>

        {/* What the row would look like, with this month's real numbers */}
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[13.5px] font-bold text-ink">How your row would look</p>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-muted">
            Your last 30 days, between two other workplaces. The real board ranks everyone by Shift Rate or active trips.
          </p>
          {preview ? (
            <div className="street mt-3 rounded-[10px] border border-line bg-white px-3">
              <GroupStandingsTable standings={preview} showLogo sortBy="shift_rate" rankLabel="—" />
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] text-ink-tertiary">The preview appears once this month&apos;s numbers have loaded.</p>
          )}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[13.5px] font-bold text-ink">Where this appears</p>
          <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-[13px] leading-[1.55] text-ink-muted">
            {SURFACES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <dl className="mt-5 grid gap-3 border-t border-line pt-4">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="text-[13.5px] font-bold text-ink">{f.q}</dt>
              <dd className="mt-0.5 text-[13px] leading-[1.55] text-ink-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  )
}
