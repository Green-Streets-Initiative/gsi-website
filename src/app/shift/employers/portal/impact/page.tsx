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
  resolveImpactWindow,
} from '../_lib/portal-utils'

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
  const { group, challenges, dashboard, dashboardError, memberCount, refreshDashboard } =
    usePortal()

  const [range, setRange] = useState<string>('Last 30 days')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (!group) return
    if (range === 'Last 7 days') {
      refreshDashboard({ days: 7 })
      return
    }
    if (range === 'Last 30 days') {
      refreshDashboard({ days: 30 })
      return
    }
    // Quarter/YTD need an explicit window — the RPC's p_days fallback
    // would silently return 30-day data labeled with the longer range.
    const win = resolveImpactWindow(
      range === 'This quarter' ? 'this_quarter' : 'ytd',
      '',
      '',
    )
    if (win) {
      refreshDashboard({
        startDate: win.start.toISOString(),
        endDate: win.end.toISOString(),
      })
    }
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

  // "Goal: 35% of ~350 employees signed up (≈123). Currently 42 (12%)."
  const goalCard = useMemo(() => {
    const ob = group?.onboarding
    const signups = dashboard?.member_count ?? memberCount
    if (!ob?.headcount || !ob.target_signup_pct || ob.headcount < 1) return null
    const goalCount = Math.ceil((ob.headcount * ob.target_signup_pct) / 100)
    const currentPct = Math.round((signups / ob.headcount) * 100)
    return {
      title: `Sign-up goal: ${ob.target_signup_pct}% of ~${ob.headcount} employees (≈${goalCount})`,
      currentLabel: `${signups} joined · ${currentPct}%`,
      pct: Math.min(100, Math.round((signups / goalCount) * 100)),
      subtitle:
        signups >= goalCount
          ? 'Goal reached — nice work. Consider setting a weekly-active goal next.'
          : `Set on your success plan${ob.launch_date ? ` · launch ${ob.launch_date}` : ''} — update it any time from Setup.`,
    }
  }, [group?.onboarding, dashboard?.member_count, memberCount])

  async function handleDownloadReport() {
    if (!group || !dashboard) return
    setDownloading(true)
    setDownloadError(null)
    try {
      // @ts-expect-error — no type declarations for the direct ES bundle
      const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js')
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const W = doc.internal.pageSize.getWidth()  // 612
      const mx = 50
      const cw = W - mx * 2 // 512
      const cx = W / 2
      const today = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })

      // Colors
      const NAVY = [25, 26, 46] as const
      const ACCENT = [45, 106, 79] as const
      const CANVAS = [244, 246, 241] as const
      const ACCENT_SOFT = [231, 240, 234] as const
      const MUTED = [90, 92, 110] as const
      const FAINT = [138, 139, 154] as const
      const TILE_BORDER = [225, 226, 228] as const

      const [logo, shiftWordmark, gsiWordmark] = await Promise.all([
        group.logo_url
          ? loadImageForPdf(group.logo_url)
          : Promise.resolve(null),
        loadImageForPdf(SHIFT_WORDMARK_WHITE_URL),
        loadImageForPdf(GSI_WORDMARK_URL),
      ])

      // ── HEADER BAR ──────────────────────────────────────────
      doc.setFillColor(...NAVY)
      doc.rect(0, 0, W, 70, 'F')

      if (shiftWordmark) {
        const wmH = 28
        const wmW = shiftWordmark.width * (wmH / shiftWordmark.height)
        try {
          doc.addImage(shiftWordmark.dataUrl, shiftWordmark.format, mx, (70 - wmH) / 2, wmW, wmH)
        } catch {
          doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(255, 255, 255)
          doc.text('Shift', mx, 40)
        }
      } else {
        doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(255, 255, 255)
        doc.text('Shift', mx, 40)
      }

      if (logo) {
        const maxLW = 160, maxLH = 44
        const ratio = Math.min(maxLW / logo.width, maxLH / logo.height)
        const dw = logo.width * ratio, dh = logo.height * ratio
        try {
          doc.addImage(logo.dataUrl, logo.format, W - mx - dw, 35 - dh / 2, dw, dh)
        } catch {}
      }

      // ── TITLE BLOCK ─────────────────────────────────────────
      doc.setTextColor(...NAVY).setFontSize(20).setFont('helvetica', 'bold')
      doc.text(group.name, cx, 108, { align: 'center' })
      doc.setFontSize(13).setFont('helvetica', 'normal')
      doc.text('Shift Impact Report', cx, 128, { align: 'center' })
      doc.setFontSize(11).setTextColor(...MUTED)
      doc.text(range, cx, 148, { align: 'center' })

      const activeChallenge = challenges.find((c) => {
        const now = new Date()
        return new Date(c.starts_at) <= now && new Date(c.ends_at) >= now
      }) ?? challenges[0]
      let sectionY = 170
      if (activeChallenge) {
        doc.setFontSize(10).setTextColor(...FAINT)
        doc.text(
          `${activeChallenge.name}  ·  ${formatDate(activeChallenge.starts_at)} – ${formatDate(activeChallenge.ends_at)}`,
          cx, 166, { align: 'center' },
        )
        sectionY = 186
      }

      function drawCO2(x: number, y: number, fontSize: number, color: readonly [number, number, number], weight: 'normal' | 'bold' = 'normal') {
        doc.setFont('helvetica', weight).setFontSize(fontSize).setTextColor(...color)
        doc.text('CO', x, y)
        const coW = doc.getTextWidth('CO')
        doc.setFontSize(fontSize * 0.65)
        doc.text('2', x + coW, y + fontSize * 0.15)
        const subW = doc.getTextWidth('2')
        doc.setFontSize(fontSize)
        return coW + subW
      }

      // ── STAT TILES (3×2) ────────────────────────────────────
      const tileGap = 10
      const tileW = (cw - tileGap * 2) / 3
      const tileH = 58

      const stats = [
        { label: 'Employees joined', value: String(dashboard.member_count || memberCount || '—'), unit: '' },
        { label: 'Active trips', value: dashboard.active_trips_this_period.toLocaleString(), unit: '' },
        { label: 'Miles shifted', value: dashboard.miles_shifted.toLocaleString(undefined, { maximumFractionDigits: 1 }), unit: 'mi' },
        { label: 'kg CO2 avoided', value: dashboard.co2_avoided_kg.toFixed(1), unit: 'kg', co2Label: true },
        { label: 'Most popular mode', value: topNonCarMode ? prettyMode(topNonCarMode.mode) : '—', unit: '' },
        { label: 'Shift rate', value: `${Math.round(dashboard.shift_rate_trip_pct)}%`, unit: '' },
      ]

      stats.forEach((stat, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const tx = mx + col * (tileW + tileGap)
        const ty = sectionY + row * (tileH + tileGap)

        doc.setFillColor(...CANVAS)
        doc.setDrawColor(...TILE_BORDER)
        doc.setLineWidth(0.75)
        doc.roundedRect(tx, ty, tileW, tileH, 6, 6, 'FD')

        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...FAINT)
        if (stat.co2Label) {
          doc.text('kg ', tx + 14, ty + 18)
          const kgW = doc.getTextWidth('kg ')
          const co2W = drawCO2(tx + 14 + kgW, ty + 18, 9, FAINT)
          doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...FAINT)
          doc.text(' avoided', tx + 14 + kgW + co2W, ty + 18)
        } else {
          doc.text(stat.label, tx + 14, ty + 18)
        }

        doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...NAVY)
        doc.text(stat.value, tx + 14, ty + 44)

        if (stat.unit) {
          const valW = doc.getTextWidth(stat.value)
          doc.setFont('helvetica', 'normal').setFontSize(13).setTextColor(...FAINT)
          doc.text(` ${stat.unit}`, tx + 14 + valW, ty + 44)
        }
      })

      // ── TREND CHART + MODE BREAKDOWN ────────────────────────
      const cardsY = sectionY + tileH * 2 + tileGap * 2 + 16
      const leftW = 300
      const rightW = cw - leftW - tileGap
      const cardH = 230

      // Helper: card outline
      function drawCard(x: number, y: number, w: number, h: number) {
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(...TILE_BORDER)
        doc.setLineWidth(0.75)
        doc.roundedRect(x, y, w, h, 8, 8, 'FD')
      }

      // ── Left card: Shift rate trend ──
      drawCard(mx, cardsY, leftW, cardH)
      const lPad = 16
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY)
      doc.text('Shift rate trend', mx + lPad, cardsY + 22)
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...FAINT)
      doc.text('Share of commute trips made by active modes', mx + lPad, cardsY + 35)

      if (shiftRate != null) {
        const badgeText = `${shiftRate}% now`
        const bw = doc.getTextWidth(badgeText) + 12
        doc.setFillColor(...ACCENT_SOFT)
        doc.roundedRect(mx + leftW - lPad - bw, cardsY + 10, bw, 18, 9, 9, 'F')
        doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ACCENT)
        doc.text(badgeText, mx + leftW - lPad - bw / 2, cardsY + 22, { align: 'center' })
      }

      if (trendData && trendData.length > 1) {
        const chartX = mx + lPad
        const chartY = cardsY + 50
        const chartW = leftW - lPad * 2
        const chartH = 120
        const tMin = Math.min(...trendData)
        const tMax = Math.max(...trendData)
        const tRange = tMax - tMin || 1

        const pts = trendData.map((v, i) => ([
          chartX + (i / (trendData.length - 1)) * chartW,
          chartY + (1 - (v - tMin) / tRange) * chartH,
        ] as [number, number]))

        // Area fill
        doc.setFillColor(...ACCENT_SOFT)
        const areaVectors: [number, number][] = []
        for (let i = 1; i < pts.length; i++) areaVectors.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]])
        areaVectors.push([0, chartY + chartH - pts[pts.length - 1][1]])
        areaVectors.push([pts[0][0] - pts[pts.length - 1][0], 0])
        areaVectors.push([0, pts[0][1] - (chartY + chartH)])
        doc.lines(areaVectors, pts[0][0], pts[0][1], [1, 1], 'F', true)

        // Stroke line
        doc.setDrawColor(...ACCENT)
        doc.setLineWidth(2)
        const lineVectors: [number, number][] = []
        for (let i = 1; i < pts.length; i++) lineVectors.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]])
        doc.lines(lineVectors, pts[0][0], pts[0][1], [1, 1], 'S')
        doc.setLineWidth(0.75)

        // Endpoint dot
        const last = pts[pts.length - 1]
        doc.setFillColor(...ACCENT)
        doc.circle(last[0], last[1], 4, 'F')
        doc.setFillColor(255, 255, 255)
        doc.circle(last[0], last[1], 2, 'F')

        // Axis labels
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...FAINT)
        doc.text('12 weeks ago', chartX, cardsY + cardH - 14)
        doc.text('This week', chartX + chartW, cardsY + cardH - 14, { align: 'right' })
      } else {
        doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...FAINT)
        doc.text('Trend appears after a few weeks of commute activity.', mx + lPad, cardsY + 70)
      }

      // ── Right card: Mode breakdown ──
      const rightX = mx + leftW + tileGap
      drawCard(rightX, cardsY, rightW, cardH)
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY)
      doc.text('Mode breakdown', rightX + lPad, cardsY + 22)
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...FAINT)
      doc.text(`${totalTrips} trips logged`, rightX + lPad, cardsY + 35)

      const barPad = lPad
      const barMaxW = rightW - barPad * 2
      const rowH = 22
      const maxRows = Math.min(modes.length, 8)
      modes.slice(0, maxRows).forEach((m, i) => {
        const ry = cardsY + 48 + i * rowH

        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...NAVY)
        doc.text(m.label, rightX + barPad, ry + 6)

        const countText = `${m.count} · ${m.pct}%`
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...FAINT)
        doc.text(countText, rightX + rightW - barPad, ry + 6, { align: 'right' })

        // Bar
        const barY = ry + 10
        const barH = 6
        doc.setFillColor(...CANVAS)
        doc.roundedRect(rightX + barPad, barY, barMaxW, barH, 3, 3, 'F')
        const fillW = Math.max(4, (m.count / maxModeCount) * barMaxW)
        doc.setFillColor(...ACCENT)
        doc.roundedRect(rightX + barPad, barY, fillW, barH, 3, 3, 'F')
      })

      // ── CO₂ CALLOUT ─────────────────────────────────────────
      if (dashboard.co2_avoided_kg > 0) {
        const coY = cardsY + cardH + 14
        doc.setFillColor(...ACCENT_SOFT)
        doc.setDrawColor(210, 230, 218)
        doc.roundedRect(mx, coY, cw, 46, 8, 8, 'FD')

        doc.setFillColor(...ACCENT)
        doc.circle(mx + 26, coY + 23, 6, 'F')

        const prefix = `Your team avoided ${dashboard.co2_avoided_kg.toFixed(1)} kg of `
        doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY)
        doc.text(prefix, mx + 44, coY + 20)
        const prefixW = doc.getTextWidth(prefix)
        const co2W = drawCO2(mx + 44 + prefixW, coY + 20, 11, NAVY, 'bold')
        doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY)
        doc.text(' this period', mx + 44 + prefixW + co2W, coY + 20)
        doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTED)
        doc.text(
          `That's about the same as charging ${Math.round(dashboard.co2_avoided_kg * 122).toLocaleString()} smartphones.`,
          mx + 44, coY + 35,
        )
      }

      // ── FOOTER ──────────────────────────────────────────────
      doc.setDrawColor(220, 220, 220)
      doc.line(mx, 690, W - mx, 690)

      if (gsiWordmark) {
        const wmH = 20
        const wmW = gsiWordmark.width * (wmH / gsiWordmark.height)
        try {
          doc.addImage(gsiWordmark.dataUrl, gsiWordmark.format, cx - wmW / 2, 700, wmW, wmH)
        } catch {
          doc.setFontSize(10).setTextColor(150, 150, 150)
          doc.text('Green Streets Initiative', cx, 714, { align: 'center' })
        }
      }

      doc.setFontSize(9).setTextColor(150, 150, 150)
      doc.text(`Generated ${today}`, mx, 726)
      doc.text('gogreenstreets.org', W - mx, 726, { align: 'right' })

      // ── SAVE ────────────────────────────────────────────────
      const slug = group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const dateSlug = new Date().toISOString().split('T')[0]
      doc.save(`${slug}-shift-impact-report-${dateSlug}.pdf`)
    } catch {
      setDownloadError(
        "We couldn't generate the report. Try again — if this keeps happening, contact info@gogreenstreets.org.",
      )
    } finally {
      setDownloading(false)
    }
  }

  // Real 12-week trend from the dashboard RPC. Weeks with no trips carry a
  // null rate; require a few weeks of real activity before drawing a trend
  // so a new team sees an honest "not yet" state instead of a flat line.
  const trendData = useMemo(() => {
    const weeks = dashboard?.weekly_shift_rates
    if (!weeks || weeks.length < 2) return null
    const weeksWithTrips = weeks.filter((w) => w.trips > 0).length
    if (weeksWithTrips < 3) return null
    return weeks.map((w) => w.shift_rate_pct ?? 0)
  }, [dashboard])

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

      {dashboardError && (
        <Card pad>
          <p className="text-[13.5px] text-ep-danger">{dashboardError}</p>
        </Card>
      )}

      {/* Goal vs actual — driven by the success plan captured at setup */}
      {goalCard && (
        <Card pad>
          <div className="mb-1.5 flex items-center justify-between">
            <strong className="text-[14px]">{goalCard.title}</strong>
            <span className="text-[13px] font-semibold text-ink-muted">
              {goalCard.currentLabel}
            </span>
          </div>
          <ProgressBar pct={goalCard.pct} />
          <p className="mt-1.5 text-[12.5px] text-ink-faint">{goalCard.subtitle}</p>
        </Card>
      )}

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

      {downloadError && (
        <p className="text-[13px] text-ep-danger">{downloadError}</p>
      )}

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
                Trend appears after a few weeks of commute activity
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
