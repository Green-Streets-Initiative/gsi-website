'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Copy,
  Link as LinkIcon,
  Search,
  Download,
  Users,
  TrendingUp,
  X,
  Mail,
  Bike,
  Footprints,
  Bus,
  TrainFront,
  Car,
  MapPin,
  Share2,
  ArrowRight,
} from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import { formatDateShort } from '../_lib/portal-utils'
import PortalPageHead from '../_components/PortalPageHead'
import { Card, CardHead } from '@/components/employer/Card'
import StatTile from '@/components/employer/StatTile'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import CodeChip from '@/components/employer/CodeChip'
import Avatar from '@/components/employer/Avatar'
import SegmentedControl from '@/components/employer/SegmentedControl'
import ProgressBar from '@/components/employer/ProgressBar'
import type { EmployerMember } from '../_lib/portal-types'

const MODE_ICON_MAP: Record<string, React.ElementType> = {
  walk: Footprints,
  bike: Bike,
  transit_bus: Bus,
  transit_train: TrainFront,
  transit_commuter_rail: TrainFront,
  escooter: Bike,
  carpool: Car,
  drive: Car,
}

const MODE_LABEL_MAP: Record<string, string> = {
  walk: 'Walking',
  bike: 'Biking',
  transit_bus: 'Bus',
  transit_train: 'Train',
  transit_commuter_rail: 'Rail',
  escooter: 'E-scooter',
  carpool: 'Carpool',
  drive: 'Drive',
}

type MetricId = 'shift_rate' | 'active_trips' | 'miles' | 'co2'

const LB_METRICS: {
  id: MetricId
  label: string
  get: (m: EmployerMember) => number
  fmt: (m: EmployerMember) => string
  unit?: string
}[] = [
  {
    id: 'shift_rate',
    label: 'Shift rate',
    get: (m) => (m.trips_in_period ? m.active_trips_in_period / m.trips_in_period : 0),
    fmt: (m) =>
      m.trips_in_period ? Math.round((m.active_trips_in_period / m.trips_in_period) * 100) + '%' : '0%',
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
    get: (m) => (m as EmployerMember & { miles_in_period?: number }).miles_in_period ?? 0,
    fmt: (m) => ((m as EmployerMember & { miles_in_period?: number }).miles_in_period ?? 0).toFixed(1),
    unit: 'mi',
  },
  {
    id: 'co2',
    label: 'CO₂ avoided',
    get: (m) => (m as EmployerMember & { co2_avoided_in_period?: number }).co2_avoided_in_period ?? 0,
    fmt: (m) => ((m as EmployerMember & { co2_avoided_in_period?: number }).co2_avoided_in_period ?? 0).toFixed(1),
    unit: 'kg',
  },
]

const RANGE_OPTIONS = [
  { value: '7' as const, label: '7 days' },
  { value: '30' as const, label: '30 days' },
  { value: 'all' as const, label: 'Full challenge' },
]

export default function EmployeesPage() {
  const { group, memberCount, members, loading, loadingMembers, refreshMembers, dashboard } = usePortal()
  const [metricId, setMetricId] = useState<MetricId>('active_trips')
  const [range, setRange] = useState<'7' | '30' | 'all'>('30')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<EmployerMember | null>(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-faint">Loading...</span>
      </div>
    )
  }

  const metric = LB_METRICS.find((m) => m.id === metricId)!
  const sorted = [...members].sort((a, b) => metric.get(b) - metric.get(a))
  const filtered = sorted.filter((m) =>
    (m.display_name || '').toLowerCase().includes(q.toLowerCase()),
  )

  function handleRangeChange(val: '7' | '30' | 'all') {
    setRange(val)
    const days = val === '7' ? 7 : val === '30' ? 30 : 9999
    refreshMembers(days)
  }

  function copyCode() {
    navigator.clipboard.writeText(group!.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareLink() {
    const url = `https://shift.gogreenstreets.org/join/${group!.invite_code}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: `Join ${group!.name} on Shift`, url }); return } catch {}
    }
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const effectiveCount = memberCount || members.length
  const activeCount = members.filter((m) => m.active_trips_in_period > 0).length
  const activeRate = effectiveCount > 0 ? Math.round((activeCount / effectiveCount) * 100) : 0

  function exportCsv() {
    if (filtered.length === 0) return
    const header = ['Rank', 'Name', 'Joined', 'Active trips', 'Total trips', 'Shift rate']
    const rows = filtered.map((m, i) => {
      const rank = sorted.indexOf(m) + 1
      const rate = m.trips_in_period
        ? Math.round((m.active_trips_in_period / m.trips_in_period) * 100)
        : 0
      return [
        rank,
        m.display_name || 'Unnamed',
        m.joined_at.split('T')[0],
        m.active_trips_in_period,
        m.trips_in_period,
        `${rate}%`,
      ]
    })
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(group!.name || 'employees').replace(/\s+/g, '-').toLowerCase()}-employees.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PortalPageHead
        title="Employees"
        subtitle="Invite your team, track participation, and celebrate top performers"
        actions={
          <Button variant="primary" icon={Users} onClick={shareLink}>
            {linkCopied ? 'Link copied!' : 'Invite employees'}
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Invite strip */}
        <div className="grid gap-6" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
          <Card pad>
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
              Your invite code
            </div>
            <div className="flex flex-wrap items-center gap-3.5">
              <CodeChip code={group.invite_code} />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={Copy} onClick={copyCode}>
                  {copied ? 'Copied!' : 'Copy code'}
                </Button>
                <Button variant="primary" size="sm" icon={LinkIcon} onClick={shareLink}>
                  {linkCopied ? 'Copied!' : 'Share join link'}
                </Button>
              </div>
            </div>
            <p className="mt-3.5 text-[13.5px] leading-relaxed text-ink-muted" style={{ textWrap: 'pretty' }}>
              Employees with Shift installed jump straight into the join flow; everyone else
              gets a page with App Store + Play Store buttons.
            </p>
            <Link
              href="/shift/employers/portal/share-kit"
              className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent no-underline hover:underline"
            >
              <Share2 size={14} strokeWidth={2} />
              Open your Share Kit for posters, email templates, and more
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
          </Card>
          <div className="grid grid-cols-2 gap-6">
            <Card pad>
              <StatTile label="Joined" value={String(effectiveCount)} labelIcon={Users} />
            </Card>
            <Card pad>
              <StatTile label="Active rate" value={`${activeRate}%`} labelIcon={TrendingUp}
                delta={`${activeCount} of ${effectiveCount} active`} up={activeRate > 0} />
            </Card>
          </div>
        </div>

        {/* Leaderboard */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-[18px]">
            <div>
              <h3 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Employee leaderboard</h3>
              <p className="mt-0.5 text-[13px] text-ink-faint">
                Visible only to you — employees never see each other&apos;s data here.
              </p>
            </div>
            <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>Export</Button>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 px-6 py-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <SegmentedControl
                options={LB_METRICS.map((m) => ({ value: m.id, label: m.label }))}
                value={metricId}
                onChange={setMetricId}
              />
              <SegmentedControl
                options={RANGE_OPTIONS}
                value={range}
                onChange={handleRangeChange}
              />
            </div>
            <div className="relative">
              <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="text"
                placeholder="Search employees"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-[34px] w-[200px] rounded-[10px] border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </div>
          </div>

          {/* Table */}
          {loadingMembers ? (
            <div className="px-6 py-10 text-center text-[14px] text-ink-faint">Loading...</div>
          ) : filtered.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line-2 bg-surface-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint">
                  <th className="w-1 py-2.5 pl-6 pr-2">#</th>
                  <th className="py-2.5">Employee</th>
                  <th className="py-2.5">Joined</th>
                  <th className="py-2.5 pr-6 text-right">{metric.label}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const rank = sorted.indexOf(m) + 1
                  return (
                    <tr
                      key={m.user_id}
                      className="cursor-pointer border-b border-line-2 last:border-0 transition-colors hover:bg-accent-softer"
                      onClick={() => setSel(m)}
                    >
                      <td className="py-3 pl-6 pr-2">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[12px] font-bold ${
                            rank <= 3
                              ? 'bg-accent text-white'
                              : 'bg-surface-2 text-ink-muted'
                          }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.display_name || 'User'} />
                          <div>
                            <div className="text-[14px] font-semibold text-ink">{m.display_name || 'Unnamed'}</div>
                            <div className="text-[12px] text-ink-faint">
                              {m.active_trips_in_period} active · {m.trips_in_period} trips
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-[13px] text-ink-faint">{formatDateShort(m.joined_at)}</td>
                      <td className="py-3 pr-6 text-right">
                        <strong className="text-[15px] text-ink">{metric.fmt(m)}</strong>
                        {metric.unit && <span className="text-ink-faint"> {metric.unit}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-10 text-center text-[14px] text-ink-faint">
              {members.length === 0
                ? 'No employees have joined yet. Share your invite code to get started.'
                : 'No employees match your search.'}
            </div>
          )}
        </Card>
      </div>

      {/* Employee drawer */}
      {sel && <EmployeeDrawer member={sel} onClose={() => setSel(null)} />}
    </>
  )
}

function EmployeeDrawer({ member, onClose }: { member: EmployerMember; onClose: () => void }) {
  const rate = member.trips_in_period
    ? Math.round((member.active_trips_in_period / member.trips_in_period) * 100)
    : 0

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-40 bg-ink/30 transition-opacity"
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-[440px] flex-col overflow-y-auto bg-surface shadow-lg"
        style={{ animation: 'slide-in-right 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div className="flex items-center gap-3">
            <Avatar name={member.display_name || 'User'} size={40} />
            <div>
              <div className="text-[16px] font-bold text-ink">{member.display_name || 'Unnamed'}</div>
              <div className="text-[12.5px] text-ink-faint">{member.user_id.slice(0, 8)}...</div>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <Card pad>
              <StatTile label="Active trips" value={String(member.active_trips_in_period)} />
            </Card>
            <Card pad>
              <StatTile label="Total trips" value={String(member.trips_in_period)} />
            </Card>
            <Card pad>
              <StatTile label="Active rate" value={`${rate}%`} />
            </Card>
            <Card pad>
              <StatTile label="Joined" value={formatDateShort(member.joined_at)} />
            </Card>
          </div>

          <div>
            <div className="mb-2 text-[12.5px] font-semibold text-ink-muted">Active-trip rate</div>
            <ProgressBar pct={rate} />
          </div>

          <Card pad className="bg-surface-2 shadow-none">
            <div className="space-y-2.5 text-[13.5px]">
              <div className="flex justify-between">
                <span className="text-ink-muted">Joined</span>
                <span className="font-semibold text-ink">{formatDateShort(member.joined_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Status</span>
                <Badge tone={member.active_trips_in_period > 0 ? 'success' : 'neutral'}>
                  {member.active_trips_in_period > 0 ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </Card>

          <p className="text-[12.5px] leading-relaxed text-ink-faint">
            Trip details are aggregated to protect employee privacy. Individuals control
            what they share inside the Shift app.
          </p>

          <Button variant="secondary" icon={Mail}>Send a nudge</Button>
        </div>
      </aside>

    </>
  )
}
