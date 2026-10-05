'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  Download,
  Users,
  TrendingUp,
  X,
  Mail,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Send,
  Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import { formatDateShort } from '../_lib/portal-utils'
import PortalPageHead from '../_components/PortalPageHead'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import StatTile from '@/components/employer/StatTile'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import Avatar from '@/components/employer/Avatar'
import SegmentedControl from '@/components/employer/SegmentedControl'
import ProgressBar from '@/components/employer/ProgressBar'
import { useToast } from '@/components/employer/Toast'
import type { EmployerMember } from '../_lib/portal-types'
import InviteDialog, { InvitePanel } from './InviteDialog'
import InvitedCard from './InvitedCard'
import JoinRequestsCard from './JoinRequestsCard'
import JoinPolicyLine from '../_components/JoinPolicyLine'
import TabStrip, { tabPanelProps } from '../_components/TabStrip'

const EMPLOYEES = '/shift/employers/portal/employees'
const RANGE_STORAGE_KEY = 'portal.employees.range'
const PAGE_SIZE = 50

type MetricId = 'shift_rate' | 'active_trips' | 'miles' | 'co2'
type RangeId = '7' | '30' | 'all'
type SortKey = 'name' | 'joined' | 'metric'
type SortDir = 'asc' | 'desc'
/** The roster card's tabs: who joined, who was invited, who is waiting for a yes. */
type RosterTab = 'joined' | 'invited' | 'requests'

function shiftRate(m: EmployerMember): number {
  return m.trips_in_period ? m.active_trips_in_period / m.trips_in_period : 0
}

const LB_METRICS: {
  id: MetricId
  label: string
  get: (m: EmployerMember) => number
  fmt: (m: EmployerMember) => string
  unit?: string
}[] = [
  {
    id: 'shift_rate',
    label: 'Shift Rate',
    get: shiftRate,
    fmt: (m) => Math.round(shiftRate(m) * 100) + '%',
  },
  {
    id: 'active_trips',
    label: 'Active trips',
    get: (m) => m.active_trips_in_period,
    fmt: (m) => String(m.active_trips_in_period),
  },
  {
    id: 'miles',
    label: 'Miles shifted',
    get: (m) => m.miles_in_period,
    fmt: (m) => m.miles_in_period.toFixed(1),
    unit: 'mi',
  },
  {
    id: 'co2',
    label: 'CO₂ avoided',
    get: (m) => m.co2_avoided_in_period,
    fmt: (m) => m.co2_avoided_in_period.toFixed(1),
    unit: 'kg',
  },
]

const RANGE_OPTIONS: { value: RangeId; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'all', label: 'All time' },
]

const RANGE_DAYS: Record<RangeId, number> = { '7': 7, '30': 30, all: 9999 }
/** "the last 7 days" / "the last 30 days" / "all time", for sentences. */
const RANGE_PHRASE: Record<RangeId, string> = {
  '7': 'the last 7 days',
  '30': 'the last 30 days',
  all: 'all time',
}
const RANGE_SLUG: Record<RangeId, string> = {
  '7': 'last-7-days',
  '30': 'last-30-days',
  all: 'all-time',
}

function isRangeId(v: string | null): v is RangeId {
  return v === '7' || v === '30' || v === 'all'
}

export default function EmployeesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { group, memberCount, members: contextMembers, loading, canInviteEmployees, canManageAccount, sessionEmail } = usePortal()
  // Invitations and join requests: admins, managers and GSI staff. Who can
  // join is an account setting (admins only).
  const canManage = canInviteEmployees

  const [inviteOpen, setInviteOpen] = useState(false)
  // Bumped after the invite dialog sends so the Invited card reloads.
  const [invitedVersion, setInvitedVersion] = useState(0)
  const [rosterTab, setRosterTab] = useState<RosterTab>('joined')
  // Counts the Invited and Join requests tabs report, for their labels.
  const [invitedWaiting, setInvitedWaiting] = useState<number | null>(null)
  const [requestsWaiting, setRequestsWaiting] = useState<number | null>(null)
  const onInvitedCount = useCallback((n: number) => setInvitedWaiting(n), [])
  const onRequestsCount = useCallback((n: number) => setRequestsWaiting(n), [])
  const [metricId, setMetricId] = useState<MetricId>('active_trips')
  const [range, setRange] = useState<RangeId>('30')
  // Rows for the chosen range live here, never in the shared context: the
  // Home page reads the context's 30-day list and must not see another
  // range under its "Last 30 days" heading. null = use the context's list.
  const [localRows, setLocalRows] = useState<EmployerMember[] | null>(null)
  const [loadingRows, setLoadingRows] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('metric')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<EmployerMember | null>(null)
  const openedFromUrl = useRef(false)

  const members = localRows ?? contextMembers

  const fetchRange = useCallback(
    async (val: RangeId) => {
      if (!group) return
      setLoadingRows(true)
      const { data } = await supabase.rpc('get_employer_members', {
        p_group_id: group.id,
        p_days: RANGE_DAYS[val],
      })
      if (data) setLocalRows(data as EmployerMember[])
      setLoadingRows(false)
    },
    [group],
  )

  // Remembered range: restore it once the group is known.
  useEffect(() => {
    if (!group) return
    let stored: string | null = null
    try {
      stored = sessionStorage.getItem(RANGE_STORAGE_KEY)
    } catch {}
    if (isRangeId(stored) && stored !== '30') {
      setRange(stored)
      void fetchRange(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id])

  // ?member=<user_id> (from the command palette) opens that person.
  useEffect(() => {
    if (openedFromUrl.current) return
    const id = searchParams.get('member')
    if (!id || contextMembers.length === 0) return
    const m = contextMembers.find((x) => x.user_id === id)
    if (m) {
      openedFromUrl.current = true
      setSel(m)
    }
  }, [searchParams, contextMembers])

  // Arriving with ?invite=1 or #invite (Home's quick action, the palette,
  // the Share kit): open the invite dialog. Until the first person joins
  // the invite panel is the page itself, so there is nothing to open.
  const inviteFromUrl = useRef(false)
  useEffect(() => {
    if (loading || !group || inviteFromUrl.current) return
    inviteFromUrl.current = true
    const asked = searchParams.get('invite') === '1' || window.location.hash === '#invite'
    if (!asked) return
    if ((memberCount || contextMembers.length) > 0) setInviteOpen(true)
    router.replace(EMPLOYEES)
  }, [loading, group, searchParams, memberCount, contextMembers.length, router])

  function handleRangeChange(val: RangeId) {
    setRange(val)
    setVisible(PAGE_SIZE)
    try {
      sessionStorage.setItem(RANGE_STORAGE_KEY, val)
    } catch {}
    void fetchRange(val)
  }

  const metric = LB_METRICS.find((m) => m.id === metricId)!

  // Rank is always by the chosen metric, highest first, whatever the table
  // is sorted by.
  const ranked = useMemo(() => [...members].sort((a, b) => metric.get(b) - metric.get(a)), [members, metric])
  const rankOf = useMemo(() => {
    const map = new Map<string, number>()
    ranked.forEach((m, i) => map.set(m.user_id, i + 1))
    return map
  }, [ranked])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? ranked.filter((m) => (m.display_name || '').toLowerCase().includes(needle))
      : [...ranked]
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'name') {
      list.sort((a, b) => dir * (a.display_name || '').localeCompare(b.display_name || ''))
    } else if (sortKey === 'joined') {
      list.sort((a, b) => dir * (new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()))
    } else if (sortDir === 'asc') {
      list.reverse()
    }
    return list
  }, [ranked, q, sortKey, sortDir])

  const shown = filtered.slice(0, visible)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  function handleMetricChange(id: MetricId) {
    setMetricId(id)
    setSortKey('metric')
    setSortDir('desc')
  }

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-tertiary">Loading...</span>
      </div>
    )
  }

  const effectiveCount = memberCount || members.length
  const activeCount = members.filter((m) => m.active_trips_in_period > 0).length
  const rangePhrase = RANGE_PHRASE[range]

  function csvCell(v: string | number): string {
    return `"${String(v).replace(/"/g, '""')}"`
  }

  function exportCsv() {
    if (filtered.length === 0) return
    const header = [
      'Rank',
      'Name',
      'Joined',
      'Active trips',
      'Total trips',
      'Shift Rate',
      'Miles shifted',
      'CO2 avoided (kg)',
    ]
    const rows = filtered.map((m) => [
      rankOf.get(m.user_id) ?? '',
      m.display_name || 'Unnamed',
      m.joined_at.split('T')[0],
      m.active_trips_in_period,
      m.trips_in_period,
      `${Math.round(shiftRate(m) * 100)}%`,
      m.miles_in_period.toFixed(1),
      m.co2_avoided_in_period.toFixed(1),
    ])
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const company = (group!.name || 'employees').replace(/\s+/g, '-').toLowerCase()
    a.download = `${company}-employees-${RANGE_SLUG[range]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = sortDir === 'asc' ? ArrowUp : ArrowDown
  const headerButton =
    'inline-flex items-center gap-1 rounded-[6px] px-1 py-0.5 text-[12.5px] font-semibold text-ink-tertiary hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

  const policy = group.join_policy ?? 'open'
  const rosterTabs = [
    { id: 'joined', label: 'Joined', count: effectiveCount },
    { id: 'invited', label: 'Invited', count: invitedWaiting ?? undefined },
    ...(policy === 'approval' || (requestsWaiting ?? 0) > 0
      ? [{ id: 'requests', label: 'Join requests', count: requestsWaiting ?? undefined }]
      : []),
  ]
  // If the policy changes under an open Join requests tab, fall back to Joined.
  const activeRosterTab: RosterTab = rosterTabs.some((t) => t.id === rosterTab) ? rosterTab : 'joined'

  const invitePanelProps = {
    groupId: group.id,
    groupName: group.name,
    inviteCode: group.invite_code,
    joinPolicy: policy,
    sessionEmail,
    canSend: canManage,
    canManageAccount,
    onSent: () => setInvitedVersion((v) => v + 1),
  }

  return (
    <>
      <PortalPageHead
        title="Employees"
        subtitle="Who has joined and how they're getting around"
        actions={
          effectiveCount > 0 ? (
            <Button variant="primary" icon={Mail} onClick={() => setInviteOpen(true)}>
              Invite
            </Button>
          ) : undefined
        }
      />

      {/* Who the invite code lets in: a control, under the title (Keith 2026-10-05). */}
      <div className="-mt-2 mb-6">
        <JoinPolicyLine policy={policy} canManage={canManageAccount} groupId={group.id} />
      </div>

      {effectiveCount === 0 ? (
        /* Nobody yet: the invite panel is the page (Keith 2026-10-05). */
        <div className="space-y-6">
          {policy === 'approval' && (
            <JoinRequestsCard groupId={group.id} policy={policy} canManage={canManage} />
          )}
          <Card>
            <CardHead
              title="Invite your first employees"
              sub="Give us a list and we send the invitations, or share the link, code or a flyer yourself."
            />
            <CardBody>
              <InvitePanel {...invitePanelProps} prefix="invite-inline" />
            </CardBody>
          </Card>
        </div>
      ) : (
      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Card pad>
            <StatTile label="Joined" value={String(effectiveCount)} labelIcon={Users} />
            <p className="mt-1 text-[12.5px] text-ink-tertiary">People on the team in Shift</p>
          </Card>
          <Card pad>
            <StatTile
              label="Active this period"
              value={`${activeCount} of ${effectiveCount}`}
              labelIcon={TrendingUp}
            />
            <p className="mt-1 text-[12.5px] text-ink-tertiary">Logged a trip in {rangePhrase}</p>
          </Card>
        </div>

        {/* The roster: joined, invited and (when the policy needs it) join requests, as tabs at the top */}
        <Card>
          <TabStrip
            tabs={rosterTabs}
            value={activeRosterTab}
            onChange={setRosterTab}
            label="Employees"
            prefix="roster"
            className="px-4"
          />

          {/* Joined: the leaderboard */}
          <div {...tabPanelProps('roster', 'joined')} hidden={activeRosterTab !== 'joined'} className="outline-none">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-[18px]">
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Employee leaderboard</h3>
              <p className="mt-0.5 text-[13px] text-ink-tertiary">
                Only portal admins and viewers see this list. Employees never see each other&apos;s numbers here.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={exportCsv}
                disabled={filtered.length === 0 || loadingRows}
              >
                Export CSV
              </Button>
              {filtered.length === 0 && !loadingRows && (
                <span className="text-[12px] text-ink-tertiary">Nothing to export yet</span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3 border-b border-line-2 px-6 py-3.5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <SegmentedControl
                options={LB_METRICS.map((m) => ({ value: m.id, label: m.label }))}
                value={metricId}
                onChange={handleMetricChange}
              />
              <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={handleRangeChange} />
            </div>
            <div className="relative w-full md:w-[220px]">
              <Search
                size={16}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-icon"
              />
              <input
                type="search"
                aria-label="Search employees"
                placeholder="Search employees"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setVisible(PAGE_SIZE)
                }}
                className="h-[34px] w-full rounded-[10px] border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-tertiary outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </div>
          </div>

          {/* Table */}
          {loadingRows ? (
            <div className="px-6 py-10 text-center text-[14px] text-ink-tertiary">Loading...</div>
          ) : filtered.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead>
                    <tr className="border-b border-line-2 bg-surface-2">
                      <th scope="col" className="w-1 py-2.5 pl-6 pr-2 text-[12.5px] font-semibold text-ink-tertiary">
                        #
                      </th>
                      <th scope="col" className="py-2.5" aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className={headerButton} onClick={() => toggleSort('name')}>
                          Employee
                          {sortKey === 'name' && <SortIcon size={13} strokeWidth={2} />}
                        </button>
                      </th>
                      <th scope="col" className="py-2.5" aria-sort={sortKey === 'joined' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className={headerButton} onClick={() => toggleSort('joined')}>
                          Joined
                          {sortKey === 'joined' && <SortIcon size={13} strokeWidth={2} />}
                        </button>
                      </th>
                      <th scope="col" className="py-2.5 pr-6 text-right" aria-sort={sortKey === 'metric' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className={headerButton} onClick={() => toggleSort('metric')}>
                          {metric.label}
                          {sortKey === 'metric' && <SortIcon size={13} strokeWidth={2} />}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((m) => {
                      const rank = rankOf.get(m.user_id) ?? 0
                      return (
                        <tr
                          key={m.user_id}
                          className="relative border-b border-line-2 last:border-0 transition-colors hover:bg-accent-softer focus-within:bg-accent-softer"
                        >
                          <td className="py-3 pl-6 pr-2">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[12px] font-bold ${
                                rank <= 3 ? 'bg-accent text-white' : 'bg-surface-2 text-ink-muted'
                              }`}
                            >
                              {rank}
                            </span>
                          </td>
                          <td className="py-3">
                            {/* The button stretches over the whole row (after:inset-0) so
                                the row opens by click or keyboard without nesting controls. */}
                            <button
                              type="button"
                              onClick={() => setSel(m)}
                              className="flex items-center gap-2.5 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent"
                            >
                              <Avatar name={m.display_name || 'User'} />
                              <span>
                                <span className="block text-[14px] font-semibold text-ink">{m.display_name || 'Unnamed'}</span>
                                <span className="block text-[12px] text-ink-tertiary">
                                  {m.active_trips_in_period} active · {m.trips_in_period} trips
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="py-3 text-[13px] text-ink-tertiary">{formatDateShort(m.joined_at)}</td>
                          <td className="py-3 pr-6 text-right">
                            <strong className="text-[15px] text-ink">{metric.fmt(m)}</strong>
                            {metric.unit && <span className="text-ink-tertiary"> {metric.unit}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length > shown.length && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-2 px-6 py-3">
                  <span className="text-[12.5px] text-ink-tertiary">
                    Showing {shown.length} of {filtered.length}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                    Show more
                  </Button>
                </div>
              )}
            </>
          ) : members.length === 0 ? (
            <div className="px-6 py-10 text-center text-[14px] text-ink-tertiary">Loading...</div>
          ) : (
            <div className="px-6 py-10 text-center text-[14px] text-ink-tertiary">
              No employees match your search.
            </div>
          )}
          </div>

          {/* Invited, not joined yet */}
          <div {...tabPanelProps('roster', 'invited')} hidden={activeRosterTab !== 'invited'} className="outline-none">
            <InvitedCard
              embedded
              groupId={group.id}
              groupName={group.name}
              canManage={canManage}
              version={invitedVersion}
              onInvite={() => setInviteOpen(true)}
              onCount={onInvitedCount}
            />
          </div>

          {/* Waiting for an admin's yes. Always mounted so its count is known;
              the tab shows only when the policy asks for approval or someone waits. */}
          <div {...tabPanelProps('roster', 'requests')} hidden={activeRosterTab !== 'requests'} className="outline-none">
            <JoinRequestsCard
              embedded
              groupId={group.id}
              policy={policy}
              canManage={canManage}
              onCount={onRequestsCount}
            />
          </div>
        </Card>
      </div>
      )}

      {/* Employee drawer */}
      {sel && <EmployeeDrawer member={sel} rangePhrase={rangePhrase} onClose={() => setSel(null)} />}

      {/* Paste or upload a list (GSI sends the invitations), or share the link, code or a flyer */}
      {inviteOpen && <InviteDialog {...invitePanelProps} onClose={() => setInviteOpen(false)} />}
    </>
  )
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function EmployeeDrawer({
  member,
  rangePhrase,
  onClose,
}: {
  member: EmployerMember
  rangePhrase: string
  onClose: () => void
}) {
  const { group, challenges, dashboard, members: teamMembers, canInviteEmployees } = usePortal()
  const toast = useToast()
  const canNudge = canInviteEmployees
  const rate = Math.round(shiftRate(member) * 100)
  const activeThisPeriod = member.active_trips_in_period > 0

  const now = new Date()
  const activeChallenges = (challenges ?? []).filter(
    (c) => new Date(c.starts_at) <= now && new Date(c.ends_at) >= now,
  )
  const teamSize = dashboard?.member_count ?? teamMembers.length

  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastNudged, setLastNudged] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Focus moves into the drawer, Tab stays inside it, Escape closes it,
  // and focus returns to whatever opened it. Runs once per open.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  // "Last nudged" when the database lets us read it; otherwise it is left out.
  useEffect(() => {
    if (!group || !canNudge) return
    let cancelled = false
    supabase
      .from('group_members')
      .select('last_nudged_at')
      .eq('group_id', group.id)
      .eq('user_id', member.user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.last_nudged_at) setLastNudged(data.last_nudged_at as string)
      })
    return () => {
      cancelled = true
    }
  }, [group, member.user_id, canNudge])

  const sendNudge = useCallback(async () => {
    if (!group || sending || sent) return
    setSending(true)
    setSendError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setSendError('Your session expired. Refresh the page and try again.')
        return
      }
      const res = await fetch('/api/employer/nudge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: member.user_id, groupId: group.id }),
      })
      if (res.ok) {
        setSent(true)
        setLastNudged(new Date().toISOString())
        toast(`Nudge sent to ${member.display_name || 'this employee'}`, { type: 'success' })
      } else {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; next_allowed_at?: string }
          | null
        const msg =
          res.status === 429 && body?.next_allowed_at
            ? `Already nudged this week. You can send another after ${formatDateShort(body.next_allowed_at)}.`
            : body?.error ?? "We couldn't send the nudge. Please try again."
        setSendError(msg)
        toast(msg, { type: 'error' })
      }
    } catch {
      setSendError("We couldn't send the nudge. Please try again.")
    } finally {
      setSending(false)
    }
  }, [group, member.user_id, member.display_name, sending, sent, toast])

  const groupName = group?.name ?? 'your team'
  const employeeName = member.display_name
  const greeting = employeeName ? `Hi ${employeeName},` : 'Hi there,'

  return (
    <>
      {/* Scrim */}
      <div className="fixed inset-0 z-40 bg-ink/30 transition-opacity" onClick={onClose} />
      {/* Drawer */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-y-auto bg-surface shadow-lg sm:w-[440px]"
        style={{ animation: 'slide-in-right 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={member.display_name || 'User'} size={40} />
            <div className="min-w-0">
              <div id="employee-drawer-title" className="truncate text-[16px] font-bold text-ink">
                {member.display_name || 'Unnamed'}
              </div>
              <div className="text-[12.5px] text-ink-tertiary">Joined {formatDateShort(member.joined_at)}</div>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          <p className="text-[12.5px] text-ink-tertiary">Numbers below are for {rangePhrase}.</p>

          <div className="grid grid-cols-2 gap-3">
            <Card pad>
              <StatTile label="Active trips" value={String(member.active_trips_in_period)} />
            </Card>
            <Card pad>
              <StatTile label="Total trips" value={String(member.trips_in_period)} />
            </Card>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] font-semibold text-ink-muted">Shift Rate</span>
              <span className="text-[14px] font-bold text-ink">{rate}%</span>
            </div>
            <ProgressBar pct={rate} />
            <p className="mt-1.5 text-[12px] text-ink-tertiary">
              The share of this person&apos;s trips that weren&apos;t driving alone.
            </p>
          </div>

          <Card pad className="bg-surface-2 shadow-none">
            <div className="flex items-center justify-between gap-3 text-[13.5px]">
              <span className="text-ink-muted">Status</span>
              <Badge tone={activeThisPeriod ? 'success' : 'neutral'}>
                {activeThisPeriod ? 'Active this period' : 'No trips this period'}
              </Badge>
            </div>
            {lastNudged && (
              <div className="mt-2.5 flex items-center justify-between gap-3 text-[13.5px]">
                <span className="text-ink-muted">Last nudged</span>
                <span className="font-semibold text-ink">{formatDateShort(lastNudged)}</span>
              </div>
            )}
          </Card>

          <p className="text-[12.5px] leading-relaxed text-ink-tertiary">
            Trip details are added up to protect employee privacy. Each person controls what they
            share inside the Shift app.
          </p>

          {/* Nudge: only for people with nothing logged in the period */}
          {activeThisPeriod ? (
            <p className="text-[12.5px] text-ink-tertiary">
              {member.display_name || 'This employee'} has been active in {rangePhrase}, so there&apos;s no
              reminder to send.
            </p>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                aria-expanded={showPreview}
                onClick={() => setShowPreview(!showPreview)}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-center gap-2.5">
                  <Mail size={16} strokeWidth={1.75} className="text-ink-muted" />
                  <span className="text-[13.5px] font-semibold text-ink">Send a nudge</span>
                </div>
                {showPreview ? (
                  <ChevronUp size={16} className="text-ink-icon" />
                ) : (
                  <ChevronDown size={16} className="text-ink-icon" />
                )}
              </button>

              {showPreview && (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-xl border border-line">
                    <div className="bg-[#191A2E] px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-wordmark-white.png?v=20260422"
                          alt="Shift"
                          className="h-[18px] w-auto"
                        />
                        <span className="text-[11px] font-bold text-[#52B788]">Green Streets</span>
                      </div>
                    </div>
                    <div className="bg-white px-4 py-4 text-[12.5px] leading-relaxed text-[#1a1a2e]">
                      <p className="mb-2.5">{greeting}</p>
                      <p className="mb-2.5">
                        Just checking in. Your team at <strong>{groupName}</strong> is logging trips with
                        Shift, and every walk, bike ride, bus or train trip you take counts toward the
                        team&apos;s numbers.
                      </p>

                      {activeChallenges.length > 0 && (
                        <div className="mb-3 rounded-lg bg-[#E7F0EA] px-3.5 py-3">
                          <div className="mb-1.5 text-[11px] font-bold text-[#2D6A4F]">
                            Challenge{activeChallenges.length > 1 ? 's' : ''} under way
                          </div>
                          {activeChallenges.map((c) => (
                            <div key={c.id} className="mb-1 last:mb-0">
                              <span className="font-semibold">{c.name}</span>
                              {c.prize_description && (
                                <span className="text-[#2D6A4F]"> — {c.prize_description}</span>
                              )}
                              <br />
                              <span className="text-[10.5px] text-[#6b7280]">Ends {formatDateShort(c.ends_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {teamSize > 1 && (
                        <div className="mb-3 rounded-lg bg-[#F0F4FF] px-3.5 py-3">
                          <div className="mb-1 text-[11px] font-bold text-[#3B5998]">Team leaderboard</div>
                          <p className="text-[12px]">
                            {teamSize} people from {groupName} are on the leaderboard. Every active trip
                            you log moves you up.
                          </p>
                        </div>
                      )}

                      <p className="mb-2.5">
                        Shift tracks your trips automatically, so all you have to do is choose how you get
                        around.
                      </p>
                      <p className="mb-3">
                        Your trips help {groupName} see its impact and unlock rewards for the whole team.
                      </p>
                      <span className="inline-block rounded-lg bg-[#2D6A4F] px-4 py-2 text-[12px] font-semibold text-white">
                        Open Shift &rarr;
                      </span>
                    </div>
                    <div className="border-t border-line bg-[#f9fafb] px-4 py-2.5 text-center text-[10px] text-[#5B6075]">
                      Sent on behalf of {groupName}
                    </div>
                  </div>

                  <p className="text-[11.5px] leading-relaxed text-ink-tertiary">
                    Subject: A quick hello from your team at {groupName}
                  </p>

                  {sent ? (
                    <div className="flex items-center gap-2 rounded-xl bg-accent-softer px-4 py-3">
                      <Check size={16} className="text-accent" />
                      <span className="text-[13px] font-medium text-accent">Nudge sent</span>
                    </div>
                  ) : canNudge ? (
                    <>
                      <Button variant="primary" icon={Send} onClick={sendNudge} disabled={sending}>
                        {sending ? 'Sending...' : 'Send this email'}
                      </Button>
                      {sendError && <p className="text-[12.5px] text-ep-danger">{sendError}</p>}
                    </>
                  ) : (
                    <p className="text-[12.5px] text-ink-tertiary">Only portal admins can send nudges.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
