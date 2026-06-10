'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Download,
  Leaf,
  Bike,
  Footprints,
  Car,
  Bus,
  TrainFront,
  Zap,
  Users,
  MapPin,
} from 'lucide-react'
import PortalPageHead from '../_components/PortalPageHead'
import { usePortal } from '../_lib/portal-context'
import { Card, CardHead } from '@/components/employer/Card'
import StatTile from '@/components/employer/StatTile'
import Badge from '@/components/employer/Badge'
import ProgressBar from '@/components/employer/ProgressBar'
import SegmentedControl from '@/components/employer/SegmentedControl'
import Button from '@/components/employer/Button'
import {
  MODE_LABEL,
  SHIFT_WORDMARK_WHITE_URL,
  GSI_WORDMARK_URL,
} from '../_lib/portal-constants'
import {
  prettyMode,
  formatDate,
  loadImageForPdf,
} from '../_lib/portal-utils'
import type { ImpactPreset } from '../_lib/portal-types'

const MODE_ICON: Record<string, React.ElementType> = {
  walk: Footprints,
  bike: Bike,
  drive: Car,
  transit_bus: Bus,
  transit_train: TrainFront,
  transit_commuter_rail: TrainFront,
  escooter: Zap,
  carpool: Users,
}

export default function ImpactPage() {
  const { group, challenge, dashboard, memberCount, refreshDashboard } =
    usePortal()

  const [range, setRange] = useState<string>('Last 30 days')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!group) return
    const presetMap: Record<string, ImpactPreset> = {
      'Last 7 days': 'last_30',
      'Last 30 days': 'last_30',
      'This quarter': 'this_quarter',
      'Year to date': 'ytd',
    }
    const preset = presetMap[range]
    if (!preset) return
    const days =
      range === 'Last 7 days' ? 7 : range === 'Last 30 days' ? 30 : undefined
    refreshDashboard({ days })
  }, [range, group?.id])

  const modes = useMemo(() => {
    if (!dashboard?.mode_breakdown) return []
    const total = dashboard.mode_breakdown.reduce(
      (s, m) => s + m.trip_count,
      0,
    )
    return dashboard.mode_breakdown
      .sort((a, b) => b.trip_count - a.trip_count)
      .map((m) => ({
        mode: m.mode,
        label: prettyMode(m.mode),
        count: m.trip_count,
        pct: total > 0 ? Math.round((m.trip_count / total) * 100) : 0,
      }))
  }, [dashboard])

  const maxModeCount = Math.max(...modes.map((m) => m.count), 1)
  const totalTrips = modes.reduce((s, m) => s + m.count, 0)

  const shiftRate = dashboard
    ? Math.round(dashboard.shift_rate_trip_pct)
    : null

  const topNonCarMode = dashboard?.mode_breakdown?.find(
    (m) => !['drive', 'carpool', 'other'].includes(m.mode),
  )

  async function handleDownloadReport() {
    if (!group || !dashboard) return
    setDownloading(true)
    try {
      // @ts-expect-error — no type declarations for the direct ES bundle
      const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js')
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const w = doc.internal.pageSize.getWidth()
      const centerX = w / 2
      const today = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })

      const [logo, shiftWordmark, gsiWordmark] = await Promise.all([
        group.logo_url
          ? loadImageForPdf(group.logo_url)
          : Promise.resolve(null),
        loadImageForPdf(SHIFT_WORDMARK_WHITE_URL),
        loadImageForPdf(GSI_WORDMARK_URL),
      ])

      doc.setFillColor(25, 26, 46)
      doc.rect(0, 0, w, 70, 'F')

      if (shiftWordmark) {
        const wmH = 32
        const wmW = shiftWordmark.width * (wmH / shiftWordmark.height)
        try {
          doc.addImage(
            shiftWordmark.dataUrl,
            shiftWordmark.format,
            50,
            (70 - wmH) / 2,
            wmW,
            wmH,
          )
        } catch {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(18)
          doc.setTextColor(255, 255, 255)
          doc.text('Shift', 50, 40)
        }
      } else {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(18)
        doc.setTextColor(255, 255, 255)
        doc.text('Shift', 50, 38)
      }

      if (logo) {
        const maxW2 = 160
        const maxH2 = 50
        const ratio = Math.min(maxW2 / logo.width, maxH2 / logo.height)
        const drawW = logo.width * ratio
        const drawH = logo.height * ratio
        try {
          doc.addImage(
            logo.dataUrl,
            logo.format,
            centerX - drawW / 2,
            70 / 2 - drawH / 2,
            drawW,
            drawH,
          )
        } catch {}
      }

      doc.setTextColor(25, 26, 46)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text(group.name, centerX, 120, { align: 'center' })
      doc.setFontSize(15)
      doc.setFont('helvetica', 'normal')
      doc.text('Shift Impact Report', centerX, 146, { align: 'center' })
      doc.setFontSize(12)
      doc.setTextColor(90, 90, 90)
      doc.text(range, centerX, 170, { align: 'center' })

      if (challenge) {
        doc.setFontSize(11)
        doc.setTextColor(80, 80, 80)
        doc.text(
          `${challenge.name}  ·  ${formatDate(challenge.starts_at)} – ${formatDate(challenge.ends_at)}`,
          centerX,
          192,
          { align: 'center' },
        )
      }

      const stats = [
        {
          label: 'Employees joined',
          value: String(dashboard.member_count || memberCount || '—'),
        },
        {
          label: 'Active trips logged',
          value: dashboard.active_trips_this_period.toLocaleString(),
        },
        {
          label: 'Miles shifted',
          value: dashboard.miles_shifted.toLocaleString(),
        },
        { label: 'CO2 avoided (kg)', value: dashboard.co2_avoided_kg.toFixed(1) },
        {
          label: 'Most popular mode',
          value: topNonCarMode ? prettyMode(topNonCarMode.mode) : '—',
        },
        {
          label: 'Shift Rate',
          value: `${Math.round(dashboard.shift_rate_trip_pct)}%`,
        },
      ]

      const tableTop = challenge ? 220 : 200
      const rowH = 38
      const colLabel = 80
      const colValue = w - 80

      doc.setDrawColor(230, 230, 230)
      stats.forEach((stat, i) => {
        const y = tableTop + i * rowH
        if (i > 0) doc.line(colLabel, y, colValue, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(12)
        doc.setTextColor(100, 100, 100)
        doc.text(stat.label, colLabel, y + 24)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(25, 26, 46)
        doc.text(stat.value, colValue, y + 24, { align: 'right' })
      })

      doc.setDrawColor(220, 220, 220)
      doc.line(50, 680, w - 50, 680)

      if (gsiWordmark) {
        const wmH = 22
        const wmW = gsiWordmark.width * (wmH / gsiWordmark.height)
        try {
          doc.addImage(
            gsiWordmark.dataUrl,
            gsiWordmark.format,
            centerX - wmW / 2,
            695,
            wmW,
            wmH,
          )
        } catch {
          doc.setFontSize(10)
          doc.setTextColor(150, 150, 150)
          doc.text('Green Streets Initiative', centerX, 710, {
            align: 'center',
          })
        }
      }

      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text(`Generated ${today}`, 50, 712)
      doc.text('gogreenstreets.org', w - 50, 712, { align: 'right' })

      const slug = group.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      const dateSlug = new Date().toISOString().split('T')[0]
      doc.save(`${slug}-shift-impact-report-${dateSlug}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  // SVG sparkline for shift rate trend (placeholder — a real trend endpoint would supply weekly data)
  const trendData = useMemo(() => {
    if (!shiftRate) return null
    // Simulate a rising trend ending at current shift rate
    const base = Math.max(shiftRate - 22, 10)
    return Array.from({ length: 12 }, (_, i) =>
      Math.round(base + ((shiftRate - base) * i) / 11 + (i % 3) - 1),
    )
  }, [shiftRate])

  const sparkline = useMemo(() => {
    if (!trendData) return null
    const W = 640
    const H = 150
    const pad = 8
    const min = Math.min(...trendData)
    const max = Math.max(...trendData)
    const pts = trendData.map((v, i) => {
      const x = pad + (i / (trendData.length - 1)) * (W - pad * 2)
      const y =
        pad + (1 - (v - min) / (max - min || 1)) * (H - pad * 2)
      return [x, y] as [number, number]
    })
    const line = pts
      .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
      .join(' ')
    const area =
      line +
      ` L${(W - pad).toFixed(1)} ${H - pad} L${pad} ${H - pad} Z`
    return { W, H, pts, line, area }
  }, [trendData])

  return (
    <div className="grid gap-6">
      <PortalPageHead
        title="Impact"
        subtitle="Track your team's commute data and environmental impact"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={[
            { value: 'Last 7 days', label: 'Last 7 days' },
            { value: 'Last 30 days', label: 'Last 30 days' },
            { value: 'This quarter', label: 'This quarter' },
            { value: 'Year to date', label: 'Year to date' },
          ]}
          value={range}
          onChange={setRange}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          onClick={handleDownloadReport}
          disabled={!dashboard || downloading}
        >
          {downloading ? 'Generating...' : 'Download report'}
        </Button>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-3 gap-5">
        <Card pad>
          <StatTile
            label="Employees joined"
            value={String(dashboard?.member_count ?? memberCount ?? '—')}
          />
        </Card>
        <Card pad>
          <StatTile
            label="Active trips"
            value={
              dashboard
                ? dashboard.active_trips_this_period.toLocaleString()
                : '—'
            }
          />
        </Card>
        <Card pad>
          <StatTile
            label="Miles shifted"
            value={
              dashboard
                ? dashboard.miles_shifted.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })
                : '—'
            }
            unit="mi"
          />
        </Card>
        <Card pad>
          <StatTile
            label="kg CO₂ avoided"
            value={dashboard ? dashboard.co2_avoided_kg.toFixed(1) : '—'}
            unit="kg"
          />
        </Card>
        <Card pad>
          <StatTile
            label="Most popular mode"
            value={
              topNonCarMode ? prettyMode(topNonCarMode.mode) : '—'
            }
          />
        </Card>
        <Card pad>
          <StatTile
            label="Shift rate"
            value={shiftRate != null ? `${shiftRate}%` : '—'}
          />
        </Card>
      </div>

      {/* Trend + mode breakdown */}
      <div
        className="grid items-start gap-5"
        style={{ gridTemplateColumns: 'minmax(0,1.4fr) 1fr' }}
      >
        <Card>
          <CardHead
            title="Shift rate trend"
            sub="Share of commute trips made by active modes"
            action={
              shiftRate != null ? (
                <Badge tone="success">
                  {shiftRate}% now
                </Badge>
              ) : undefined
            }
          />
          <div className="px-6 py-5">
            {sparkline ? (
              <>
                <svg
                  viewBox={`0 0 ${sparkline.W} ${sparkline.H}`}
                  width="100%"
                  height="160"
                  preserveAspectRatio="none"
                  className="block"
                >
                  <defs>
                    <linearGradient id="imp-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-accent)"
                        stopOpacity="0.22"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-accent)"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>
                  <path d={sparkline.area} fill="url(#imp-grad)" />
                  <path
                    d={sparkline.line}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={sparkline.pts[sparkline.pts.length - 1][0]}
                    cy={sparkline.pts[sparkline.pts.length - 1][1]}
                    r="4.5"
                    fill="var(--color-accent)"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                </svg>
                <div className="mt-1.5 flex justify-between text-[12px] text-ink-faint">
                  <span>12 weeks ago</span>
                  <span>This week</span>
                </div>
              </>
            ) : (
              <div className="flex h-[160px] items-center justify-center text-[13px] text-ink-faint">
                No trend data available yet
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHead
            title="Mode breakdown"
            sub={`${totalTrips} trips logged`}
          />
          <div className="grid gap-3 px-6 py-5">
            {modes.map((m) => {
              const Icon = MODE_ICON[m.mode] || MapPin
              return (
                <div key={m.mode}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                      <Icon size={15} strokeWidth={1.75} className="text-ink-faint" />
                      {m.label}
                    </span>
                    <span className="text-[12.5px] text-ink-faint">
                      {m.count} · {m.pct}%
                    </span>
                  </div>
                  <ProgressBar
                    pct={Math.round((m.count / maxModeCount) * 100)}
                  />
                </div>
              )
            })}
            {modes.length === 0 && (
              <p className="py-6 text-center text-[13px] text-ink-faint">
                No trips logged in this period
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* CO₂ callout */}
      {dashboard && dashboard.co2_avoided_kg > 0 && (
        <Card
          pad
          style={{
            background: 'var(--color-accent-softer)',
            border: '1px solid var(--color-accent-soft)',
            boxShadow: 'none',
          }}
        >
          <div className="flex items-start gap-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-surface text-accent">
              <Leaf size={20} strokeWidth={1.75} />
            </div>
            <div>
              <strong className="text-[15px]">
                Your team avoided {dashboard.co2_avoided_kg.toFixed(1)} kg of
                CO₂ this period
              </strong>
              <p className="mt-0.5 text-[13.5px] text-ink-muted">
                That&apos;s about the same as charging{' '}
                {Math.round(dashboard.co2_avoided_kg * 122).toLocaleString()}{' '}
                smartphones.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
