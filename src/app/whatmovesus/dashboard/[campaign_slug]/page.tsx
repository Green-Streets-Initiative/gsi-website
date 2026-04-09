'use client'

import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { useEffect, useState, useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

// ── Types ───────────────────────────────────────────────────

interface Campaign {
  name: string
  status: string
  collection_start: string | null
  collection_end: string | null
  funder_name: string | null
  funder_logo_url: string | null
  description: string | null
  media_type: string
}

interface Funnel {
  invited: number
  viewed: number
  started: number
  completed: number
  clips_included: number
}

interface RecruitSource {
  count: number
  label: string
}

interface Assets {
  submit_url: string
  qr_code_svg: string
  social_share_text: string | null
  flyer_url: string | null
  recruitment_assets: Array<{ type: string; url: string }>
}

interface Submission {
  id: string
  display_name: string
  submitted_at: string
  status: string
  clip_count: number
  recruit_source: string | null
}

interface Pagination {
  page: number
  per_page: number
  total: number
}

interface DashboardData {
  campaign: Campaign
  funnel: Funnel
  recruit_sources: Record<string, RecruitSource>
  assets: Assets
  submissions: Submission[]
  pagination: Pagination
}

interface ClipDetail {
  prompt_text: string | null
  sort_order: number
  media_url: string | null
  media_type: string
  duration_seconds: number | null
  skipped: boolean
  transcript_text: string | null
}

// ── Constants ───────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  draft: 'bg-white/10 text-white/50',
  closed: 'bg-amber-500/20 text-amber-400',
  processing: 'bg-blue-500/20 text-blue-400',
  complete: 'bg-lime/20 text-lime',
  started: 'bg-blue-500/20 text-blue-400',
  abandoned: 'bg-red-500/20 text-red-400',
}

const CHART_COLORS = ['#BAF14D', '#2966E5', '#EDB93C', '#FF8C35', '#8B5CF6']

const SOURCE_LABELS: Record<string, string> = {
  app_targeted: 'App Targeted',
  deeplink: 'Deeplink',
  direct: 'Direct',
  trip_prompt: 'Trip Prompt',
  unknown: 'Unknown',
}

// ── Main Component ──────────────────────────────────────────

export default function FunderDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [clipDetails, setClipDetails] = useState<Record<string, ClipDetail[]>>(
    {},
  )
  const [clipLoading, setClipLoading] = useState<string | null>(null)

  const getToken = useCallback(() => {
    // Token is in httpOnly cookie — not accessible from JS.
    // We pass it via the Edge Function which reads from cookie.
    // Actually, the middleware sets x-wmu-token header but that's
    // only available server-side. We'll pass the token from cookie
    // by having the Edge Function accept it from the cookie too.
    // Since the cookie is httpOnly, we can't read it from JS.
    // Instead, we'll use a Next.js API route to proxy, OR
    // we read the token from the URL on first load before redirect.
    //
    // Simplest approach: store token in sessionStorage on first visit
    // (middleware redirects, but we can also keep it client-side).
    // Actually, the cleanest approach: use a Next.js route handler
    // that reads the cookie and proxies to the Edge Function.
    return null
  }, [])

  const fetchDashboard = useCallback(
    async (pageNum: number) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/whatmovesus/dashboard/api/data?page=${pageNum}`,
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        const json = await res.json()
        setData(json)
      } catch (e: any) {
        setError(e.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchDashboard(page)
  }, [page, fetchDashboard])

  const fetchClipDetail = async (submissionId: string) => {
    if (clipDetails[submissionId]) return
    setClipLoading(submissionId)
    try {
      const res = await fetch(
        `/whatmovesus/dashboard/api/submission?submission_id=${submissionId}`,
      )
      if (res.ok) {
        const json = await res.json()
        setClipDetails((prev) => ({ ...prev, [submissionId]: json.clips }))
      }
    } finally {
      setClipLoading(null)
    }
  }

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      fetchClipDetail(id)
    }
  }

  if (loading && !data) {
    return (
      <>
        <Nav />
        <main style={{ paddingTop: '60px' }}>
          <section className="px-8 py-16">
            <div className="mx-auto max-w-[1120px]">
              <SkeletonDashboard />
            </div>
          </section>
        </main>
        <Footer />
      </>
    )
  }

  if (error) {
    return (
      <>
        <Nav />
        <main style={{ paddingTop: '60px' }}>
          <section className="flex min-h-[40vh] items-center justify-center px-8 py-16">
            <div className="text-center">
              <p className="mb-2 text-sm text-red-400">{error}</p>
              <button
                onClick={() => fetchDashboard(page)}
                className="text-sm text-lime underline"
              >
                Try again
              </button>
            </div>
          </section>
        </main>
        <Footer />
      </>
    )
  }

  if (!data) return null

  const { campaign, funnel, recruit_sources, assets, submissions, pagination } =
    data
  const totalPages = Math.ceil(pagination.total / pagination.per_page)

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        {/* Campaign Header */}
        <section className="border-b border-white/[0.07] px-8 py-12 md:py-16">
          <div className="mx-auto max-w-[1120px]">
            <div className="flex items-start gap-6">
              {campaign.funder_logo_url && (
                <img
                  src={campaign.funder_logo_url}
                  alt=""
                  className="h-16 w-16 flex-shrink-0 rounded-xl object-contain"
                />
              )}
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
                    {campaign.name}
                  </h1>
                  <StatusBadge status={campaign.status} />
                </div>
                {campaign.funder_name && (
                  <p className="mb-1 text-sm text-white/50">
                    {campaign.funder_name}
                  </p>
                )}
                {(campaign.collection_start || campaign.collection_end) && (
                  <p className="text-sm text-white/40">
                    {formatDateRange(
                      campaign.collection_start,
                      campaign.collection_end,
                    )}
                  </p>
                )}
                {campaign.description && (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
                    {campaign.description.slice(0, 280)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Funnel Stats */}
        <section className="border-b border-white/[0.07] px-8 py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-lime">
              Submission Funnel
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <FunnelCard label="Invited" value={funnel.invited} />
              <FunnelCard label="Viewed" value={funnel.viewed} />
              <FunnelCard label="Started" value={funnel.started} />
              <FunnelCard label="Completed" value={funnel.completed} />
              <FunnelCard
                label="Clips Included"
                value={funnel.clips_included}
              />
            </div>
            {funnel.started > 0 && (
              <p className="mt-4 text-xs text-white/40">
                Completion rate:{' '}
                {Math.round((funnel.completed / funnel.started) * 100)}%
              </p>
            )}
          </div>
        </section>

        {/* Recruit Source Chart */}
        <section className="border-b border-white/[0.07] px-8 py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-lime">
              Recruit Sources
            </h2>
            <RecruitSourceChart sources={recruit_sources} />
          </div>
        </section>

        {/* Recruitment Assets */}
        <section className="border-b border-white/[0.07] px-8 py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-lime">
              Recruitment Assets
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <AssetCard
                label="Submission Intake URL"
                value={assets.submit_url}
                copyable
              />
              {assets.social_share_text && (
                <AssetCard
                  label="Social Share Text"
                  value={assets.social_share_text}
                  copyable
                />
              )}
              <AssetCard
                label="QR Code"
                value=""
                qrSvg={assets.qr_code_svg}
              />
              {assets.flyer_url && (
                <AssetCard
                  label="Campaign Flyer"
                  value={assets.flyer_url}
                  downloadable
                />
              )}
              {assets.recruitment_assets.map((a) => (
                <AssetCard
                  key={a.type}
                  label={formatAssetType(a.type)}
                  value={a.url}
                  downloadable
                />
              ))}
            </div>
          </div>
        </section>

        {/* Submissions Table */}
        <section className="px-8 py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-lime">
              Submissions
            </h2>
            <p className="mb-6 text-xs text-white/40">
              {pagination.total} total submission
              {pagination.total !== 1 ? 's' : ''}
            </p>

            {submissions.length === 0 ? (
              <p className="py-12 text-center text-sm text-white/40">
                No submissions yet
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wider text-white/40">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Clips</th>
                        <th className="px-4 py-3 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => (
                        <SubmissionRow
                          key={sub.id}
                          submission={sub}
                          expanded={expandedId === sub.id}
                          onToggle={() => toggleExpand(sub.id)}
                          clips={clipDetails[sub.id]}
                          clipLoading={clipLoading === sub.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.05] disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-white/40">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.05] disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'bg-white/10 text-white/50'
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${color}`}
    >
      {status}
    </span>
  )
}

function FunnelCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="mb-1 text-xs text-white/40">{label}</p>
      <p className="font-display text-2xl font-bold tracking-tight text-white">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function RecruitSourceChart({
  sources,
}: {
  sources: Record<string, RecruitSource>
}) {
  const chartData = Object.entries(sources).map(([key, src]) => ({
    name: src.label || SOURCE_LABELS[key] || key,
    value: src.count,
  }))

  if (chartData.length === 0) {
    return <p className="text-sm text-white/40">No recruitment data yet</p>
  }

  const total = chartData.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex flex-col items-start gap-8 md:flex-row">
      <div className="h-[220px] w-[220px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#242538',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#fff',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2">
        {chartData.map((d, i) => (
          <div key={d.name} className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-sm"
              style={{
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
            <span className="text-sm text-white/70">{d.name}</span>
            <span className="text-sm font-medium text-white">{d.value}</span>
            <span className="text-xs text-white/30">
              ({Math.round((d.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AssetCard({
  label,
  value,
  copyable,
  downloadable,
  qrSvg,
}: {
  label: string
  value: string
  copyable?: boolean
  downloadable?: boolean
  qrSvg?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </p>
      {qrSvg ? (
        <div className="flex items-center gap-4">
          <div
            className="h-24 w-24 rounded-lg bg-white p-2"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <button
            onClick={() => {
              const blob = new Blob([qrSvg], { type: 'image/svg+xml' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'qr-code.svg'
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="text-xs font-medium text-lime hover:underline"
          >
            Download SVG
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-white/70">
            {value}
          </p>
          {copyable && (
            <button
              onClick={() => handleCopy(value)}
              className="flex-shrink-0 rounded-lg border border-white/[0.1] px-3 py-1 text-xs text-white/60 transition hover:bg-white/[0.05]"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          {downloadable && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 rounded-lg border border-white/[0.1] px-3 py-1 text-xs text-white/60 transition hover:bg-white/[0.05]"
            >
              Download
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function SubmissionRow({
  submission,
  expanded,
  onToggle,
  clips,
  clipLoading,
}: {
  submission: Submission
  expanded: boolean
  onToggle: () => void
  clips?: ClipDetail[]
  clipLoading: boolean
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]"
      >
        <td className="px-4 py-3 text-white/80">{submission.display_name}</td>
        <td className="px-4 py-3 text-white/50">
          {formatDate(submission.submitted_at)}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={submission.status} />
        </td>
        <td className="px-4 py-3 text-white/50">{submission.clip_count}</td>
        <td className="px-4 py-3 text-white/50">
          {submission.recruit_source
            ? SOURCE_LABELS[submission.recruit_source] ||
              submission.recruit_source
            : '—'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-white/[0.02] px-4 py-4">
            {clipLoading ? (
              <div className="flex items-center gap-2 py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-lime border-t-transparent" />
                <span className="text-xs text-white/40">Loading clips…</span>
              </div>
            ) : clips && clips.length > 0 ? (
              <div className="space-y-4">
                {clips.map((clip, i) => (
                  <ClipCard key={i} clip={clip} />
                ))}
              </div>
            ) : (
              <p className="py-2 text-xs text-white/40">No clips available</p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function ClipCard({ clip }: { clip: ClipDetail }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-4">
      {clip.prompt_text && (
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-lime/70">
          {clip.prompt_text}
        </p>
      )}
      {clip.skipped ? (
        <p className="text-xs italic text-white/30">Skipped</p>
      ) : (
        <>
          {clip.media_url && (
            <div className="mb-3">
              {clip.media_type === 'video' ? (
                <video
                  src={clip.media_url}
                  controls
                  preload="metadata"
                  className="max-h-[300px] w-full rounded-lg bg-black"
                />
              ) : (
                <audio
                  src={clip.media_url}
                  controls
                  preload="metadata"
                  className="w-full"
                />
              )}
              {clip.duration_seconds && (
                <p className="mt-1 text-xs text-white/30">
                  {formatDuration(clip.duration_seconds)}
                </p>
              )}
            </div>
          )}
          {clip.transcript_text && (
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-white/30">
                Transcript
              </p>
              <p className="text-sm leading-relaxed text-white/60">
                {clip.transcript_text}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SkeletonDashboard() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 w-64 rounded bg-white/[0.05]" />
      <div className="h-4 w-48 rounded bg-white/[0.03]" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/[0.03]" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-white/[0.03]" />
      <div className="h-64 rounded-xl bg-white/[0.03]" />
    </div>
  )
}

// ── Utility functions ───────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateRange(
  start: string | null,
  end: string | null,
): string {
  if (!start && !end) return ''
  if (start && !end) return `Started ${formatDate(start)}`
  if (!start && end) return `Ends ${formatDate(end)}`
  return `${formatDate(start)} — ${formatDate(end)}`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatAssetType(type: string): string {
  const labels: Record<string, string> = {
    email_template: 'Email Template',
    flyer_pdf: 'Flyer PDF',
    social_card: 'Social Card',
    qr_code: 'QR Code',
  }
  return labels[type] || type
}
