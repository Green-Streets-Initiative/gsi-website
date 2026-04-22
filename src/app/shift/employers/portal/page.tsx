'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { supabase } from '@/lib/supabase'
import type { EmployerBenefits, ShuttleRoute } from '@/lib/types/commute'

const BRAND_ASSETS_BASE =
  'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets'
const SHIFT_WORDMARK_WHITE_URL = `${BRAND_ASSETS_BASE}/shift-wordmark-white.png`
const GSI_WORDMARK_URL = `${BRAND_ASSETS_BASE}/gsi-wordmark.png`

/* ── types ─────────────────────────────────────────────────── */

type Group = {
  id: string
  name: string
  slug: string | null
  status: string
  admin_name: string | null
  admin_email: string
  admin_phone: string | null
  website_url: string | null
  logo_url: string | null
  invite_code: string
  tier: string
  access_starts_at: string | null
  access_ends_at: string | null
  public_leaderboard: boolean
}

type Challenge = {
  id: string
  name: string
  metric: string
  starts_at: string
  ends_at: string
  prize_description: string | null
  public_leaderboard: boolean
}

type DashboardData = {
  period_days: number
  member_count: number
  trips_this_period: number
  active_trips_this_period: number
  miles_shifted: number
  co2_avoided_kg: number
  mode_breakdown: Array<{ mode: string; trip_count: number }>
  // Trip-level shift rate over period_days — use this on the Impact card
  // so the percentage lines up with the rest of the period-aligned stats.
  shift_rate_trip_pct: number
  // Member-level engagement over last 7 days (kept for admin/portal contexts
  // that want "who's been active this week?").
  shift_rate_7d: number
}

type EmployerMember = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  joined_at: string
  trips_in_period: number
  active_trips_in_period: number
}

type FundingPool = {
  id: string
  name: string
  budget_total_cents: number
  budget_spent_cents: number
  budget_remaining_cents: number
  active: boolean
  valid_through: string | null
}

const MODE_LABEL: Record<string, string> = {
  walk: 'Walking',
  bike: 'Biking',
  transit_bus: 'Bus',
  transit_train: 'Train',
  transit_commuter_rail: 'Commuter rail',
  escooter: 'E-scooter',
  carpool: 'Carpool',
  drive: 'Drive',
  other: 'Other',
}

function prettyMode(mode: string): string {
  return MODE_LABEL[mode] ?? mode
}

function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

/**
 * Fetch an image URL and return a data URL + dimensions, or null if the
 * fetch fails (network error, CORS block, etc). Used to embed the
 * employer logo in PDFs. SVGs are rejected because jsPDF rasterizes
 * them only via canvas which loses fidelity — return null so the PDF
 * falls back to a text-only header.
 */
async function loadImageForPdf(
  url: string,
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG'; width: number; height: number } | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    const blob = await resp.blob()
    if (blob.type === 'image/svg+xml') return null
    const format = blob.type.includes('jpeg') ? 'JPEG' : 'PNG'
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => reject()
      reader.readAsDataURL(blob)
    })
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = () => reject()
      img.src = dataUrl
    })
    return { dataUrl, format, width: dims.width, height: dims.height }
  } catch {
    return null
  }
}

// Resolve an impact-report preset into a concrete {start, end, label}.
// Returns null when the preset is "custom" but the user hasn't filled in both
// dates yet — callers should skip the RPC in that case.
function resolveImpactWindow(
  preset:
    | 'last_30'
    | 'this_month'
    | 'last_month'
    | 'this_quarter'
    | 'last_quarter'
    | 'ytd'
    | 'custom',
  customStart: string,
  customEnd: string,
): { start: Date; end: Date; label: string } | null {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarterStartMonth = Math.floor(month / 3) * 3

  switch (preset) {
    case 'last_30': {
      const start = new Date(now.getTime() - 30 * 86400000)
      return { start, end: now, label: 'Last 30 days' }
    }
    case 'this_month': {
      const start = new Date(year, month, 1)
      return {
        start,
        end: now,
        label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }
    }
    case 'last_month': {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      return {
        start,
        end,
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }
    }
    case 'this_quarter': {
      const start = new Date(year, quarterStartMonth, 1)
      const q = Math.floor(quarterStartMonth / 3) + 1
      return { start, end: now, label: `Q${q} ${year}` }
    }
    case 'last_quarter': {
      const prevQuarterStartMonth = quarterStartMonth - 3
      const base = new Date(year, prevQuarterStartMonth, 1)
      const start = base
      const end = new Date(year, quarterStartMonth, 1)
      const q = Math.floor((base.getMonth() / 3)) + 1
      return { start, end, label: `Q${q} ${base.getFullYear()}` }
    }
    case 'ytd': {
      const start = new Date(year, 0, 1)
      return { start, end: now, label: `${year} year-to-date` }
    }
    case 'custom': {
      if (!customStart || !customEnd) return null
      const start = new Date(customStart + 'T00:00:00')
      const end = new Date(customEnd + 'T23:59:59')
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null
      return {
        start,
        end,
        label: `${start.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} – ${end.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`,
      }
    }
  }
}

/* ── helpers ───────────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

const METRIC_LABELS: Record<string, string> = {
  pct_non_car: 'Shift Rate',
  trips: 'Total active trips',
  active_days: 'Active days',
  miles: 'Miles shifted',
}

/* ── wrapper ───────────────────────────────────────────────── */

export default function PortalPageWrapper() {
  return (
    <Suspense
      fallback={
        <>
          <Nav />
          <main
            style={{ paddingTop: '60px' }}
            className="flex min-h-screen items-center justify-center bg-[#191A2E]"
          >
            <div className="text-white">Loading&hellip;</div>
          </main>
          <Footer />
        </>
      }
    >
      <PortalPage />
    </Suspense>
  )
}

/* ── main component ────────────────────────────────────────── */

function PortalPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Group | null>(null)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [memberCount, setMemberCount] = useState(0)

  // Invite code copy state
  const [copied, setCopied] = useState(false)

  // Challenge form state
  const [editingChallenge, setEditingChallenge] = useState(false)
  const [challengeForm, setChallengeForm] = useState({
    name: '',
    starts_at: '',
    ends_at: '',
    metric: 'pct_non_car',
    prize_description: '',
    public_leaderboard: false,
  })
  const [savingChallenge, setSavingChallenge] = useState(false)

  // Commute Advisor config state
  const [benefitsForm, setBenefitsForm] = useState<EmployerBenefits>({})
  const [savingBenefits, setSavingBenefits] = useState(false)
  const [benefitsSaved, setBenefitsSaved] = useState(false)
  const [advisorLinkCopied, setAdvisorLinkCopied] = useState(false)
  type AdvisorPlaceData = { placeId: string; lat: number; lng: number } | null
  const [advisorPlaceData, setAdvisorPlaceData] = useState<AdvisorPlaceData>(null)

  // Account settings state
  const [editingAccount, setEditingAccount] = useState(false)
  const [accountForm, setAccountForm] = useState({
    name: '',
    admin_name: '',
    admin_phone: '',
    website_url: '',
  })
  const [savingAccount, setSavingAccount] = useState(false)

  // Logo state (upload runs through uploadLogoDirect from the header control)
  const [logoError, setLogoError] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // End challenge modal
  const [showEndModal, setShowEndModal] = useState(false)
  const [endingChallenge, setEndingChallenge] = useState(false)

  // Leaderboard period
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'7' | '30' | 'all'>('30')

  // Impact dashboard + members (wired to RPCs)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [members, setMembers] = useState<EmployerMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Rewards pool (premium tier only)
  const [fundingPool, setFundingPool] = useState<FundingPool | null>(null)

  // Impact report period selection.
  // "custom" reveals two date pickers and holds its values in customStart/End.
  type ImpactPreset =
    | 'last_30'
    | 'this_month'
    | 'last_month'
    | 'this_quarter'
    | 'last_quarter'
    | 'ytd'
    | 'custom'
  const [impactPreset, setImpactPreset] = useState<ImpactPreset>('last_30')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [reloadingImpact, setReloadingImpact] = useState(false)

  /* ── data fetching ───────────────────────────────────────── */

  const fetchData = useCallback(
    async (email: string) => {
      // Link employer to auth user (enables RLS)
      try {
        await supabase.rpc('link_employer_on_login')
      } catch {}

      // If the admin happens to run more than one employer group with the
      // same email on file (rare — mostly happens when a single person
      // subscribes multiple test companies), pick the most recently
      // created one. We'll add a proper group-picker when real demand
      // shows up; for now "latest" beats non-deterministic.
      const { data: groupData } = await supabase
        .from('groups')
        .select(
          'id, name, slug, status, admin_name, admin_email, admin_phone, website_url, logo_url, invite_code, tier, access_starts_at, access_ends_at, public_leaderboard, employer_benefits'
        )
        .eq('admin_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!groupData) {
        router.push('/shift/employers')
        return
      }

      setGroup(groupData)
      setAccountForm({
        name: groupData.name || '',
        admin_name: groupData.admin_name || '',
        admin_phone: groupData.admin_phone || '',
        website_url: groupData.website_url || '',
      })
      // Initialize benefits form from stored data
      const eb = (groupData.employer_benefits || {}) as EmployerBenefits
      setBenefitsForm(eb)
      if (eb.destination_lat && eb.destination_lng) {
        setAdvisorPlaceData({ placeId: '', lat: eb.destination_lat, lng: eb.destination_lng })
      }

      // Fetch active challenge + member count + impact + members + pool (parallel)
      const now = new Date().toISOString()
      const poolPromise = groupData.tier === 'premium'
        ? supabase
            .from('funding_pools')
            .select(
              'id, name, budget_total_cents, budget_spent_cents, budget_remaining_cents, active, valid_through'
            )
            .eq('group_id', groupData.id)
            .eq('active', true)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const)

      const [challengeRes, memberRes, dashboardRes, membersRes, poolRes] = await Promise.all([
        supabase
          .from('competitions')
          .select('id, name, metric, starts_at, ends_at, prize_description')
          .eq('group_id', groupData.id)
          .gte('ends_at', now)
          .order('starts_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupData.id),
        supabase.rpc('get_employer_dashboard_data', {
          p_group_id: groupData.id,
          p_days: 30,
        }),
        supabase.rpc('get_employer_members', {
          p_group_id: groupData.id,
          p_days: 30,
        }),
        poolPromise,
      ])

      if (challengeRes.data) {
        setChallenge({
          ...challengeRes.data,
          public_leaderboard: groupData.public_leaderboard ?? false,
        })
        setChallengeForm({
          name: challengeRes.data.name,
          starts_at: challengeRes.data.starts_at.split('T')[0],
          ends_at: challengeRes.data.ends_at.split('T')[0],
          metric: challengeRes.data.metric,
          prize_description: challengeRes.data.prize_description || '',
          public_leaderboard: groupData.public_leaderboard ?? false,
        })
      }

      setMemberCount(memberRes.count ?? 0)

      if (dashboardRes.data && !(dashboardRes.data as { error?: string }).error) {
        setDashboard(dashboardRes.data as DashboardData)
      }

      if (membersRes.data) {
        setMembers(membersRes.data as EmployerMember[])
      }

      if (poolRes && 'data' in poolRes && poolRes.data) {
        setFundingPool(poolRes.data as FundingPool)
      }

      setLoading(false)
    },
    [router]
  )

  /* ── refetch members when period changes ─────────────────── */

  useEffect(() => {
    if (!group) return
    const days = leaderboardPeriod === '7' ? 7 : leaderboardPeriod === '30' ? 30 : 9999
    // Skip first fire: initial 30d fetch happens in fetchData.
    if (days === 30 && members.length > 0) return

    let cancelled = false
    setLoadingMembers(true)
    supabase
      .rpc('get_employer_members', { p_group_id: group.id, p_days: days })
      .then(({ data }) => {
        if (cancelled) return
        if (data) setMembers(data as EmployerMember[])
        setLoadingMembers(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardPeriod, group?.id])

  /* ── refetch dashboard when impact range changes ─────────── */

  useEffect(() => {
    if (!group) return
    // Initial 30d fetch already happened in fetchData — don't redo it.
    if (impactPreset === 'last_30' && dashboard) return

    const window = resolveImpactWindow(impactPreset, customStart, customEnd)
    if (!window) return

    let cancelled = false
    setReloadingImpact(true)
    supabase
      .rpc('get_employer_dashboard_data', {
        p_group_id: group.id,
        p_days: 30,
        p_starts_at: window.start.toISOString(),
        p_ends_at: window.end.toISOString(),
      })
      .then(({ data }) => {
        if (cancelled) return
        if (data && !(data as { error?: string }).error) {
          setDashboard(data as DashboardData)
        }
        setReloadingImpact(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impactPreset, customStart, customEnd, group?.id])

  /* ── auth flow ───────────────────────────────────────────── */

  useEffect(() => {
    async function checkAuth() {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (tokenHash && type === 'magiclink') {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink',
        })
        if (error) {
          console.error('Magic link verification failed:', error.message)
          router.push('/shift/employers')
          return
        }
        window.history.replaceState({}, '', window.location.pathname)
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        router.push('/shift/employers')
        return
      }
      fetchData(session.user.email)
    }
    checkAuth()
  }, [fetchData, router, searchParams])

  /* ── actions ─────────────────────────────────────────────── */

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/shift/employers')
  }

  function copyInviteCode() {
    if (!group) return
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveChallenge() {
    if (!group || !challengeForm.name.trim() || !challengeForm.starts_at || !challengeForm.ends_at)
      return
    setSavingChallenge(true)

    const payload = {
      group_id: group.id,
      name: challengeForm.name.trim(),
      metric: challengeForm.metric,
      starts_at: new Date(challengeForm.starts_at).toISOString(),
      ends_at: new Date(challengeForm.ends_at + 'T23:59:59').toISOString(),
      is_public: false,
      event_type: 'employer',
      prize_description: challengeForm.prize_description.trim() || null,
    }

    if (challenge) {
      // Update existing
      await supabase.from('competitions').update(payload).eq('id', challenge.id)
      setChallenge({
        ...challenge,
        name: payload.name,
        metric: payload.metric,
        starts_at: payload.starts_at,
        ends_at: payload.ends_at,
        prize_description: payload.prize_description,
      })
    } else {
      // Create new
      const { data } = await supabase
        .from('competitions')
        .insert(payload)
        .select('id, name, metric, starts_at, ends_at, prize_description')
        .single()
      if (data) {
        setChallenge({ ...data, public_leaderboard: false })
      }
    }

    // Handle public leaderboard opt-in — wire to matchup_group_ids
    const wasPublic = group.public_leaderboard ?? false
    const wantsPublic = challengeForm.public_leaderboard

    if (wantsPublic !== wasPublic) {
      // Update the group's public_leaderboard flag
      await supabase
        .from('groups')
        .update({ public_leaderboard: wantsPublic })
        .eq('id', group.id)

      // Find the active flagship competition
      const now = new Date().toISOString()
      const { data: flagship } = await supabase
        .from('competitions')
        .select('id, matchup_group_ids')
        .eq('is_public', true)
        .is('group_id', null)
        .gte('ends_at', now)
        .order('starts_at', { ascending: true })
        .limit(1)
        .single()

      if (flagship) {
        const currentIds: string[] = flagship.matchup_group_ids ?? []
        let newIds: string[]

        if (wantsPublic && !currentIds.includes(group.id)) {
          newIds = [...currentIds, group.id]
        } else if (!wantsPublic) {
          newIds = currentIds.filter((id) => id !== group.id)
        } else {
          newIds = currentIds
        }

        if (newIds !== currentIds) {
          await supabase
            .from('competitions')
            .update({ matchup_group_ids: newIds })
            .eq('id', flagship.id)
        }
      }

      setGroup({ ...group, public_leaderboard: wantsPublic })
    }

    setEditingChallenge(false)
    setSavingChallenge(false)
  }

  async function endChallenge() {
    if (!challenge) return
    setEndingChallenge(true)
    await supabase
      .from('competitions')
      .update({ ends_at: new Date().toISOString() })
      .eq('id', challenge.id)
    setChallenge(null)
    setShowEndModal(false)
    setEndingChallenge(false)
  }

  /* ── PDF generation ──────────────────────────────────────── */

  async function downloadInvitationPdf() {
    if (!group) return
    // Use ES build to avoid Node.js fflate worker issue with Turbopack
    // @ts-expect-error — no type declarations for the direct ES bundle
    const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js')
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const w = doc.internal.pageSize.getWidth()
    const centerX = w / 2

    // Header bar
    doc.setFillColor(25, 26, 46) // #191A2E
    doc.rect(0, 0, w, 90, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.setTextColor(255, 255, 255)
    doc.text('Shift', 50, 55)
    doc.setFontSize(11)
    doc.setTextColor(186, 241, 77) // #BAF14D
    doc.text('Green Streets Initiative', 50, 73)

    // Main content
    doc.setTextColor(25, 26, 46)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('Join your team on Shift', centerX, 160, { align: 'center' })

    doc.setFontSize(16)
    doc.setFont('helvetica', 'normal')
    doc.text(group.name, centerX, 195, { align: 'center' })

    // Invite code box
    doc.setFillColor(245, 245, 245)
    doc.roundedRect(centerX - 130, 230, 260, 70, 8, 8, 'F')
    doc.setFont('courier', 'bold')
    doc.setFontSize(36)
    doc.setTextColor(25, 26, 46)
    doc.text(group.invite_code, centerX, 275, { align: 'center' })

    // Label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(120, 120, 120)
    doc.text('Your invite code', centerX, 325, { align: 'center' })

    // Instructions
    doc.setTextColor(25, 26, 46)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('How to join', centerX, 380, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    const steps = [
      '1.  Download the Shift app from the App Store or Google Play',
      '2.  Open the app and create your account',
      `3.  Enter your invite code: ${group.invite_code}`,
    ]
    steps.forEach((step, i) => {
      doc.text(step, centerX, 415 + i * 28, { align: 'center' })
    })

    // What is Shift?
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('What is Shift?', centerX, 520, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(80, 80, 80)
    const desc = doc.splitTextToSize(
      'Shift tracks your commute automatically and rewards you for walking, biking, and taking transit. ' +
        'Earn points, compete with your team, and help reduce congestion and emissions.',
      420
    )
    doc.text(desc, centerX, 545, { align: 'center' })

    // Footer
    doc.setDrawColor(220, 220, 220)
    doc.line(50, 680, w - 50, 680)
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text('gogreenstreets.org', centerX, 705, { align: 'center' })
    doc.text('Shift by Green Streets Initiative', centerX, 720, { align: 'center' })

    const slug = group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    doc.save(`${slug}-shift-invitation.pdf`)
  }

  async function downloadImpactReportPdf() {
    if (!group) return
    // Use ES build to avoid Node.js fflate worker issue with Turbopack
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

    // Resolve the active impact window so the report title reflects the
    // on-screen selection rather than hard-coded "last 30 days".
    const windowInfo = resolveImpactWindow(impactPreset, customStart, customEnd)
    const windowLabel = windowInfo?.label ?? 'Last 30 days'

    // Load brand wordmarks + employer logo in parallel. All three are
    // best-effort — a null result just means we fall back to helvetica
    // text for that slot so the PDF always renders something.
    const [logo, shiftWordmark, gsiWordmark] = await Promise.all([
      group.logo_url ? loadImageForPdf(group.logo_url) : Promise.resolve(null),
      loadImageForPdf(SHIFT_WORDMARK_WHITE_URL),
      loadImageForPdf(GSI_WORDMARK_URL),
    ])

    // Dark strip header: Shift wordmark on the left, employer logo on
    // the right. GSI wordmark lives in the footer on white so its dark
    // navy "Initiative" text stays readable.
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
        // jsPDF choked — fall back to plain text.
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
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(186, 241, 77)
      doc.text('Green Streets Initiative', 50, 54)
    }

    if (logo) {
      // Fit inside a 160x50 box centered in the dark strip, preserving
      // aspect. Centered placement puts the employer's brand in the
      // hero position; Shift sits left as a secondary platform mark.
      const maxW = 160
      const maxH = 50
      const ratio = Math.min(maxW / logo.width, maxH / logo.height)
      const drawW = logo.width * ratio
      const drawH = logo.height * ratio
      const x = centerX - drawW / 2
      const y = 70 / 2 - drawH / 2
      try {
        doc.addImage(logo.dataUrl, logo.format, x, y, drawW, drawH)
      } catch {
        // jsPDF rejected the image for some reason — silently skip.
      }
    }

    // Title block
    doc.setTextColor(25, 26, 46)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text(group.name, centerX, 120, { align: 'center' })
    doc.setFontSize(15)
    doc.setFont('helvetica', 'normal')
    doc.text('Shift Impact Report', centerX, 146, { align: 'center' })

    // Reporting period (replaces the old "generated-on" line as the primary
    // subtitle — the PDF is about the window, not the export moment).
    doc.setFontSize(12)
    doc.setTextColor(90, 90, 90)
    doc.text(windowLabel, centerX, 170, { align: 'center' })

    // Challenge info
    if (challenge) {
      doc.setFontSize(11)
      doc.setTextColor(80, 80, 80)
      doc.text(
        `${challenge.name}  ·  ${formatDate(challenge.starts_at)} – ${formatDate(challenge.ends_at)}`,
        centerX,
        192,
        { align: 'center' }
      )
    }

    // Stats table. Use plain "CO2" — jsPDF's default Helvetica doesn't
    // carry the U+2082 subscript glyph, and some viewers render the
    // fallback as letter-spaced gibberish.
    const topMode = dashboard?.mode_breakdown?.find(
      (m) => !['drive', 'carpool', 'other'].includes(m.mode),
    )
    const stats = [
      {
        label: 'Employees joined',
        value: dashboard
          ? String(dashboard.member_count)
          : memberCount > 0
            ? String(memberCount)
            : '\u2014',
      },
      {
        label: 'Active trips logged',
        value: dashboard
          ? dashboard.active_trips_this_period.toLocaleString()
          : '\u2014',
      },
      {
        label: 'Miles shifted',
        value: dashboard ? dashboard.miles_shifted.toLocaleString() : '\u2014',
      },
      {
        label: 'CO2 avoided (kg)',
        value: dashboard ? dashboard.co2_avoided_kg.toFixed(1) : '\u2014',
      },
      {
        label: 'Most popular mode',
        value: topMode ? prettyMode(topMode.mode) : '\u2014',
      },
      {
        label: 'Shift Rate',
        value: dashboard ? `${Math.round(dashboard.shift_rate_trip_pct)}%` : '\u2014',
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

    // Footer. GSI wordmark centered (the "Initiative" text is dark navy,
    // so this has to live on the white area, not the dark header strip).
    // Date left, domain right — flanking the wordmark.
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
        doc.text('Green Streets Initiative', centerX, 710, { align: 'center' })
      }
    } else {
      doc.setFontSize(10)
      doc.setTextColor(150, 150, 150)
      doc.text('Green Streets Initiative', centerX, 710, { align: 'center' })
    }

    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)
    doc.text(`Generated ${today}`, 50, 712)
    doc.text('gogreenstreets.org', w - 50, 712, { align: 'right' })

    const slug = group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const dateSlug = new Date().toISOString().split('T')[0]
    doc.save(`${slug}-shift-impact-report-${dateSlug}.pdf`)
  }

  async function saveAccount() {
    if (!group) return
    setSavingAccount(true)

    // Logo is saved independently via uploadLogoDirect() from the header.
    await supabase
      .from('groups')
      .update({
        name: accountForm.name.trim(),
        admin_name: accountForm.admin_name.trim() || null,
        admin_phone: accountForm.admin_phone.trim() || null,
        website_url: accountForm.website_url.trim() || null,
      })
      .eq('id', group.id)

    setGroup({
      ...group,
      name: accountForm.name.trim(),
      admin_name: accountForm.admin_name.trim() || null,
      admin_phone: accountForm.admin_phone.trim() || null,
      website_url: accountForm.website_url.trim() || null,
    })
    setEditingAccount(false)
    setSavingAccount(false)
  }

  /**
   * One-shot logo upload triggered from the portal header. Uploads to
   * Storage, patches `groups.logo_url`, refreshes local state — no need
   * to enter Account Settings edit mode.
   */
  async function uploadLogoDirect(file: File) {
    if (!group) return
    setLogoError('')

    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setLogoError('Logo must be PNG, JPG, SVG, or WebP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo must be under 5 MB')
      return
    }

    setUploadingLogo(true)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const mimeMap: Record<string, string> = {
      svg: 'image/svg+xml',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    }
    const contentType = mimeMap[ext] || file.type
    const path = `logos/${Date.now()}-${group.id.slice(0, 8)}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('employer-logos')
      .upload(path, file, { contentType })

    if (uploadErr) {
      setLogoError(uploadErr.message)
      setUploadingLogo(false)
      return
    }

    const publicUrl = supabase.storage
      .from('employer-logos')
      .getPublicUrl(path).data.publicUrl

    const { error: updateErr } = await supabase
      .from('groups')
      .update({ logo_url: publicUrl })
      .eq('id', group.id)

    if (updateErr) {
      setLogoError(updateErr.message)
      setUploadingLogo(false)
      return
    }

    setGroup({ ...group, logo_url: publicUrl })
    setUploadingLogo(false)
  }


  /* ── access check ────────────────────────────────────────── */

  function hasAccess(g: Group): boolean {
    if (g.status !== 'active' && g.status !== 'cancelled') return false
    if (!g.access_ends_at) return true
    return new Date(g.access_ends_at) > new Date()
  }

  function isTierAtLeast(required: 'basic' | 'standard' | 'premium'): boolean {
    if (!group) return false
    const order = { basic: 0, standard: 1, premium: 2 }
    return (order[group.tier as keyof typeof order] ?? 0) >= order[required]
  }

  /* ── loading / empty states ──────────────────────────────── */

  if (loading) {
    return (
      <>
        <Nav />
        <main
          style={{ paddingTop: '60px' }}
          className="flex min-h-screen items-center justify-center bg-[#191A2E]"
        >
          <div className="text-white">Loading&hellip;</div>
        </main>
        <Footer />
      </>
    )
  }

  if (!group) return null

  /* ── expired access ──────────────────────────────────────── */

  if (!hasAccess(group)) {
    return (
      <>
        <Nav />
        <main style={{ paddingTop: '60px' }} className="min-h-screen bg-[#191A2E]">
          <div className="mx-auto max-w-[800px] px-8 py-16 text-center">
            <h1 className="mb-4 font-display text-2xl font-extrabold text-white">
              Your access has expired
            </h1>
            <p className="mb-8 text-[0.9375rem] text-white">
              Contact us at info@gogreenstreets.org to renew your subscription.
            </p>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white"
            >
              Sign out
            </button>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  /* ── main render ─────────────────────────────────────────── */

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }} className="min-h-screen bg-[#191A2E]">
        <div className="mx-auto max-w-[800px] px-8 py-16">
          {/* Cancelled banner */}
          {group.status === 'cancelled' && group.access_ends_at && (
            <div className="mb-6 rounded-xl border border-[#EDB93C]/30 bg-[#EDB93C]/10 px-5 py-3 text-sm text-[#EDB93C]">
              Your subscription has been cancelled. Access ends on{' '}
              {formatDate(group.access_ends_at)}.
            </div>
          )}

          {/* ── Header ─────────────────────────────────────── */}
          <div id="portal-header" className="mb-10 flex scroll-mt-24 items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Logo control — click to upload or replace */}
              <label
                className="group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/[0.12] bg-white/[0.04] transition-colors hover:bg-white/[0.08]"
                aria-label={group.logo_url ? 'Replace company logo' : 'Upload company logo'}
                title={group.logo_url ? 'Replace company logo' : 'Upload company logo'}
              >
                {group.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.logo_url}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-1 text-center text-[10px] font-medium leading-tight text-white/60">
                    Upload logo
                  </span>
                )}
                {/* Hover overlay: camera icon + caption */}
                <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <svg
                    className="mb-0.5 h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {group.logo_url ? 'Replace' : 'Upload'}
                </span>
                {uploadingLogo && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-[10px] font-medium text-white">
                    Saving&hellip;
                  </span>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadLogoDirect(file)
                    e.target.value = ''
                  }}
                />
              </label>
              <div>
                <h1 className="font-display text-[clamp(1.75rem,3vw,2.25rem)] font-extrabold tracking-tight text-white">
                  {group.name}
                </h1>
                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                    group.status === 'active'
                      ? 'bg-[#BAF14D]/15 text-[#BAF14D]'
                      : group.status === 'cancelled'
                        ? 'bg-[#EDB93C]/15 text-[#EDB93C]'
                        : 'bg-white/10 text-white'
                  }`}
                >
                  {group.status === 'active'
                    ? 'Active'
                    : group.status === 'cancelled'
                      ? 'Cancelled'
                      : 'Inactive'}
                </span>
                {logoError && (
                  <p className="mt-1 text-xs text-[#E05252]">{logoError}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-white"
            >
              Sign out
            </button>
          </div>

          {/* ── Setup checklist + subscription (top-of-portal overview) ── */}
          <SetupOverview
            group={group}
            memberCount={memberCount}
            hasChallenge={!!challenge}
            benefits={benefitsForm}
          />

          {/* ── Section 1: Invite code ─────────────────────── */}
          <section
            id="invite-code"
            className="mb-8 scroll-mt-24 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
          >
            <h2 className="mb-5 font-display text-base font-bold text-white">Your invite code</h2>

            <div className="mb-4 flex items-center gap-4">
              <span className="font-mono text-3xl font-extrabold tracking-[0.2em] text-[#BAF14D]">
                {group.invite_code}
              </span>
              <button
                onClick={copyInviteCode}
                className="rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <p className="text-[0.9375rem] leading-[1.6] text-white">
              Share this code with your employees. They&apos;ll enter it in the Shift app during
              onboarding or from the Community tab to join your group.
            </p>

            {memberCount > 0 && (
              <p className="mt-3 text-sm text-white/60">
                {memberCount} employee{memberCount !== 1 ? 's' : ''} joined
              </p>
            )}

            {isTierAtLeast('standard') ? (
              <button
                onClick={downloadInvitationPdf}
                className="mt-4 rounded-full border border-white/[0.12] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
              >
                Download employee invitation
              </button>
            ) : (
              <p className="mt-4 text-sm text-white/40">
                Employee invitation PDF available on Standard and above.{' '}
                <a href="mailto:info@gogreenstreets.org" className="underline">
                  Contact us to upgrade
                </a>
                .
              </p>
            )}
          </section>

          {/* ── Section 2: Your challenge ──────────────────── */}
          <section
            id="your-challenge"
            className="mb-8 scroll-mt-24 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
          >
            <h2 className="mb-5 font-display text-base font-bold text-white">Your challenge</h2>

            {editingChallenge ? (
              /* ── Challenge form (Section 3) ────────────── */
              <div className="space-y-4">
                <DashField
                  label="Challenge name"
                  value={challengeForm.name}
                  onChange={(v) => setChallengeForm({ ...challengeForm, name: v })}
                  placeholder="e.g. Summer Active Commute Challenge 2026"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white">
                      Start date <span className="text-[#E05252]">*</span>
                    </label>
                    <input
                      type="date"
                      value={challengeForm.starts_at}
                      onChange={(e) =>
                        setChallengeForm({ ...challengeForm, starts_at: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none focus:border-[#BAF14D] [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white">
                      End date <span className="text-[#E05252]">*</span>
                    </label>
                    <input
                      type="date"
                      value={challengeForm.ends_at}
                      onChange={(e) =>
                        setChallengeForm({ ...challengeForm, ends_at: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none focus:border-[#BAF14D] [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white">
                    Metric <span className="text-[#E05252]">*</span>
                  </label>
                  <select
                    value={challengeForm.metric}
                    onChange={(e) =>
                      setChallengeForm({ ...challengeForm, metric: e.target.value })
                    }
                    className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none focus:border-[#BAF14D]"
                  >
                    <option value="pct_non_car">Shift Rate (% active trips) — recommended</option>
                    <option value="trips">Total active trips</option>
                    <option value="active_days">Active days</option>
                    <option value="miles">Miles shifted</option>
                  </select>
                </div>
                <DashField
                  label="Prize description (optional)"
                  value={challengeForm.prize_description}
                  onChange={(v) => setChallengeForm({ ...challengeForm, prize_description: v })}
                  placeholder="e.g. Gift cards for top 3 finishers"
                />

                {/* Public leaderboard toggle */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={challengeForm.public_leaderboard}
                      onChange={(e) =>
                        setChallengeForm({
                          ...challengeForm,
                          public_leaderboard: e.target.checked,
                        })
                      }
                      className="mt-1 h-4 w-4 rounded accent-[#BAF14D]"
                    />
                    <div>
                      <span className="text-sm font-medium text-white">
                        Include our company in the Shift Your Summer public leaderboard
                      </span>
                      <p className="mt-1 text-xs leading-[1.5] text-white/50">
                        If enabled, your company will appear on the Corporate Challenge tab at
                        gogreenstreets.org/events/shift-your-summer alongside other participating
                        employers. Individual employee data is never shown publicly — only your
                        company&apos;s aggregate Shift Rate and trip count.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={saveChallenge}
                    disabled={
                      !challengeForm.name.trim() ||
                      !challengeForm.starts_at ||
                      !challengeForm.ends_at ||
                      savingChallenge
                    }
                    className="rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    {savingChallenge
                      ? 'Saving\u2026'
                      : challenge
                        ? 'Save changes'
                        : 'Create challenge'}
                  </button>
                  <button
                    onClick={() => setEditingChallenge(false)}
                    className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : challenge ? (
              /* ── Active challenge view ─────────────────── */
              <div>
                <h3 className="mb-1 text-lg font-bold text-white">{challenge.name}</h3>
                <p className="mb-1 text-sm text-white/60">
                  {formatDate(challenge.starts_at)} &ndash; {formatDate(challenge.ends_at)}
                </p>
                <p className="mb-4 text-sm text-white/60">
                  {METRIC_LABELS[challenge.metric] || challenge.metric}
                  {challenge.prize_description && ` · Prize: ${challenge.prize_description}`}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setChallengeForm({
                        name: challenge.name,
                        starts_at: challenge.starts_at.split('T')[0],
                        ends_at: challenge.ends_at.split('T')[0],
                        metric: challenge.metric,
                        prize_description: challenge.prize_description || '',
                        public_leaderboard: false,
                      })
                      setEditingChallenge(true)
                    }}
                    className="rounded-full border border-white/[0.12] px-5 py-2 text-sm font-medium text-white"
                  >
                    Edit challenge
                  </button>
                  <button
                    onClick={() => setShowEndModal(true)}
                    className="rounded-full border border-[#E05252]/30 px-5 py-2 text-sm font-medium text-[#E05252]"
                  >
                    End challenge early
                  </button>
                </div>
              </div>
            ) : (
              /* ── No challenge ──────────────────────────── */
              <div>
                <p className="mb-4 text-[0.9375rem] text-white">
                  You haven&apos;t set up a challenge yet.
                </p>
                <button
                  onClick={() => {
                    setChallengeForm({
                      name: '',
                      starts_at: '',
                      ends_at: '',
                      metric: 'pct_non_car',
                      prize_description: '',
                      public_leaderboard: false,
                    })
                    setEditingChallenge(true)
                  }}
                  className="rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
                >
                  Create a challenge &rarr;
                </button>
              </div>
            )}
          </section>

          {/* ── Section: Commute Advisor ──────────────────── */}
          <section
            id="commute-advisor"
            className="mb-8 scroll-mt-24 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
          >
            <h2 className="mb-2 font-display text-base font-bold text-white">Commute Advisor</h2>
            <p className="mb-4 text-[0.8125rem] text-white/50">
              Customize the Commute Advisor for your employees. Share this link in your onboarding kit or HR portal:
            </p>
            {group.slug && (
              <div className="mb-6 flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-white/[0.06] px-3 py-2 text-[0.8125rem] text-white/70">
                  gogreenstreets.org/commute-advisor/{group.slug}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://www.gogreenstreets.org/commute-advisor/${group.slug}`)
                    setAdvisorLinkCopied(true)
                    setTimeout(() => setAdvisorLinkCopied(false), 2000)
                  }}
                  className="rounded-lg border border-white/[0.12] px-3 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-white/[0.05]"
                >
                  {advisorLinkCopied ? 'Copied!' : 'Copy link'}
                </button>
                <a
                  href={`/commute-advisor/${group.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-white/[0.12] px-3 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-white/[0.05]"
                >
                  Preview
                </a>
              </div>
            )}

            {/* Workplace address */}
            <div className="mb-5">
              <AddressAutocomplete
                value={benefitsForm.destination_address || ''}
                onChange={(val) => setBenefitsForm({ ...benefitsForm, destination_address: val || null })}
                onPlaceSelected={(place) => {
                  setAdvisorPlaceData(place)
                  setBenefitsForm({
                    ...benefitsForm,
                    destination_address: '', // will be set by onChange
                    destination_lat: place.lat,
                    destination_lng: place.lng,
                  })
                }}
                label="Workplace address"
                variant="dark"
                placeholder="Office address for pre-fill"
              />
            </div>

            {/* Transit benefits */}
            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">Monthly transit subsidy ($)</label>
              <input
                type="number"
                value={benefitsForm.transit_subsidy_monthly ?? ''}
                onChange={e => setBenefitsForm({ ...benefitsForm, transit_subsidy_monthly: parseFloat(e.target.value) || null })}
                placeholder="0"
                className="w-32 rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white transition-colors focus:border-[#BAF14D] focus:outline-none"
              />
            </div>
            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">Subsidy type</label>
              <select
                value={benefitsForm.transit_subsidy_type || ''}
                onChange={e => setBenefitsForm({ ...benefitsForm, transit_subsidy_type: (e.target.value || null) as EmployerBenefits['transit_subsidy_type'] })}
                className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white transition-colors focus:border-[#BAF14D] focus:outline-none"
              >
                <option value="">None</option>
                <option value="pre_tax">Pre-tax benefit</option>
                <option value="direct">Direct subsidy</option>
              </select>
            </div>
            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">Subsidy display label</label>
              <input
                type="text"
                value={benefitsForm.transit_subsidy_label || ''}
                onChange={e => setBenefitsForm({ ...benefitsForm, transit_subsidy_label: e.target.value || null })}
                placeholder="e.g., Pre-tax transit benefit (saves ~$15/month in taxes)"
                className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none"
              />
            </div>

            {/* Bike benefits */}
            <div className="mb-4 flex flex-col gap-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={benefitsForm.bluebikes_subsidized || false}
                  onChange={e => setBenefitsForm({ ...benefitsForm, bluebikes_subsidized: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 accent-[#BAF14D]" />
                <span className="text-sm text-white">Bluebikes membership subsidized</span>
              </label>
              {benefitsForm.bluebikes_subsidized && (
                <input type="text" value={benefitsForm.bluebikes_subsidy_label || ''}
                  onChange={e => setBenefitsForm({ ...benefitsForm, bluebikes_subsidy_label: e.target.value || null })}
                  placeholder="e.g., Free Bluebikes annual membership for all employees"
                  className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none" />
              )}
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={benefitsForm.bike_parking || false}
                  onChange={e => setBenefitsForm({ ...benefitsForm, bike_parking: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 accent-[#BAF14D]" />
                <span className="text-sm text-white">Bike parking available</span>
              </label>
              {benefitsForm.bike_parking && (
                <input type="text" value={benefitsForm.bike_parking_details || ''}
                  onChange={e => setBenefitsForm({ ...benefitsForm, bike_parking_details: e.target.value || null })}
                  placeholder="e.g., Secure cage, Level B1, Building A"
                  className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none" />
              )}
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={benefitsForm.showers || false}
                  onChange={e => setBenefitsForm({ ...benefitsForm, showers: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 accent-[#BAF14D]" />
                <span className="text-sm text-white">Showers available</span>
              </label>
              {benefitsForm.showers && (
                <input type="text" value={benefitsForm.shower_details || ''}
                  onChange={e => setBenefitsForm({ ...benefitsForm, shower_details: e.target.value || null })}
                  placeholder="e.g., 2nd floor locker rooms, Building A"
                  className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none" />
              )}
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={benefitsForm.free_parking || false}
                  onChange={e => setBenefitsForm({ ...benefitsForm, free_parking: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 accent-[#BAF14D]" />
                <span className="text-sm text-white">Free parking offered</span>
              </label>
            </div>

            {/* Shuttle routes */}
            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">Shuttle routes</label>
              {(benefitsForm.shuttle_routes || []).map((route: ShuttleRoute, i: number) => (
                <div key={i} className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[0.75rem] font-semibold text-white/50">Route {i + 1}</span>
                    <button onClick={() => {
                      const updated = [...(benefitsForm.shuttle_routes || [])]
                      updated.splice(i, 1)
                      setBenefitsForm({ ...benefitsForm, shuttle_routes: updated })
                    }} className="text-[0.75rem] text-[#FF6B6B] hover:underline">Remove</button>
                  </div>
                  <div className="space-y-2">
                    <input type="text" value={route.name} placeholder="Route name"
                      onChange={e => { const u = [...(benefitsForm.shuttle_routes || [])]; u[i] = { ...u[i], name: e.target.value }; setBenefitsForm({ ...benefitsForm, shuttle_routes: u }) }}
                      className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-[#BAF14D] focus:outline-none" />
                    <input type="text" value={route.from_stop} placeholder="From stop (e.g., South Station)"
                      onChange={e => { const u = [...(benefitsForm.shuttle_routes || [])]; u[i] = { ...u[i], from_stop: e.target.value }; setBenefitsForm({ ...benefitsForm, shuttle_routes: u }) }}
                      className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-[#BAF14D] focus:outline-none" />
                    <input type="text" value={route.schedule} placeholder="Schedule"
                      onChange={e => { const u = [...(benefitsForm.shuttle_routes || [])]; u[i] = { ...u[i], schedule: e.target.value }; setBenefitsForm({ ...benefitsForm, shuttle_routes: u }) }}
                      className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-[#BAF14D] focus:outline-none" />
                  </div>
                </div>
              ))}
              {(benefitsForm.shuttle_routes || []).length < 3 && (
                <button onClick={() => setBenefitsForm({
                  ...benefitsForm,
                  shuttle_routes: [...(benefitsForm.shuttle_routes || []), { name: '', from_stop: '', schedule: '', details: '' }]
                })} className="text-[0.8125rem] font-semibold text-[#BAF14D] hover:underline">
                  + Add shuttle route
                </button>
              )}
            </div>

            {/* HR Contact */}
            <div className="mb-5 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">HR contact name</label>
                <input type="text" value={benefitsForm.hr_contact_name || ''}
                  onChange={e => setBenefitsForm({ ...benefitsForm, hr_contact_name: e.target.value || null })}
                  placeholder="Sarah Johnson"
                  className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">HR contact email</label>
                <input type="email" value={benefitsForm.hr_contact_email || ''}
                  onChange={e => setBenefitsForm({ ...benefitsForm, hr_contact_email: e.target.value || null })}
                  placeholder="benefits@company.com"
                  className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none" />
              </div>
            </div>

            {/* Other benefits */}
            <div className="mb-6">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">Other benefits</label>
              <textarea value={benefitsForm.other_benefits || ''}
                onChange={e => setBenefitsForm({ ...benefitsForm, other_benefits: e.target.value || null })}
                placeholder="Any other commute benefits not listed above"
                rows={2}
                className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none" />
            </div>

            {/* Save */}
            <button
              onClick={async () => {
                if (!group) return
                setSavingBenefits(true)
                setBenefitsSaved(false)
                // Include lat/lng from place data
                const toSave = { ...benefitsForm }
                if (advisorPlaceData) {
                  toSave.destination_lat = advisorPlaceData.lat
                  toSave.destination_lng = advisorPlaceData.lng
                }
                await supabase.from('groups').update({ employer_benefits: toSave }).eq('id', group.id)
                setSavingBenefits(false)
                setBenefitsSaved(true)
                setTimeout(() => setBenefitsSaved(false), 3000)
              }}
              disabled={savingBenefits}
              className="rounded-xl bg-[#BAF14D] px-6 py-2.5 text-[0.875rem] font-bold text-[#191A2E] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingBenefits ? 'Saving...' : benefitsSaved ? 'Saved!' : 'Save benefits'}
            </button>
          </section>

          {/* ── Section 4: Employee leaderboard ──────────────── */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              Employee leaderboard
            </h2>

            {/* Period toggle */}
            <div className="mb-4 flex gap-2">
              {(
                [
                  ['7', '7 days'],
                  ['30', '30 days'],
                  ['all', 'Full challenge'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setLeaderboardPeriod(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    leaderboardPeriod === key
                      ? 'bg-[#BAF14D] text-[#191A2E]'
                      : 'border border-white/[0.12] text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loadingMembers ? (
              <p className="py-6 text-center text-sm text-white/50">Loading…</p>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/50">
                No employees have joined yet. Share your invite code above to get started.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-white/50">
                    <tr>
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-4 py-2 text-right">Trips</th>
                      <th className="px-4 py-2 text-right">Active trips</th>
                      <th className="px-4 py-2 text-left">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {members.map((m) => (
                      <tr key={m.user_id} className="text-white">
                        <td className="px-4 py-2 font-medium">{m.display_name ?? '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.trips_in_period}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#BAF14D]">
                          {m.active_trips_in_period}
                        </td>
                        <td className="px-4 py-2 text-white/60">
                          {formatDate(m.joined_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-4 text-xs leading-[1.5] text-white/30">
              This leaderboard is visible only to you as the group administrator. Employees cannot
              see each other&apos;s data except through the shared in-app leaderboard.
            </p>
          </section>

          {/* ── Section 5: Impact stats ─────────────────────── */}
          <section
            id="impact-report"
            className="mb-8 scroll-mt-24 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h2 className="font-display text-base font-bold text-white">Impact report</h2>
              {reloadingImpact && (
                <span className="text-xs text-white/40">Loading&hellip;</span>
              )}
            </div>
            {(() => {
              const win = resolveImpactWindow(impactPreset, customStart, customEnd)
              return (
                <p className="mb-5 text-xs text-white/50">
                  {win ? win.label : 'Pick a date range'}
                </p>
              )
            })()}

            {/* Period presets */}
            <div className="mb-3 flex flex-wrap gap-2">
              {(
                [
                  ['last_30', 'Last 30 days'],
                  ['this_month', 'This month'],
                  ['last_month', 'Last month'],
                  ['this_quarter', 'This quarter'],
                  ['last_quarter', 'Last quarter'],
                  ['ytd', 'Year to date'],
                  ['custom', 'Custom\u2026'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setImpactPreset(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    impactPreset === key
                      ? 'bg-[#BAF14D] text-[#191A2E]'
                      : 'border border-white/[0.12] text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {impactPreset === 'custom' && (
              <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">Start</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded-lg border border-white/[0.12] bg-white/[0.07] px-3 py-1.5 text-sm text-white outline-none focus:border-[#BAF14D]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">End</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded-lg border border-white/[0.12] bg-white/[0.07] px-3 py-1.5 text-sm text-white outline-none focus:border-[#BAF14D]"
                  />
                </div>
                {!resolveImpactWindow('custom', customStart, customEnd) && (
                  <span className="text-xs text-white/40">
                    Pick a valid start and end date.
                  </span>
                )}
              </div>
            )}

            {/* spacer to keep the original layout below the controls */}
            <div className="mb-5" />

            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              {(() => {
                const topMode = dashboard?.mode_breakdown?.find(
                  (m) => !['drive', 'carpool', 'other'].includes(m.mode),
                )
                const stats: Array<{ label: string; value: string }> = [
                  {
                    label: 'Employees joined',
                    value: dashboard
                      ? String(dashboard.member_count)
                      : memberCount > 0
                        ? String(memberCount)
                        : '\u2014',
                  },
                  {
                    label: 'Active trips',
                    value: dashboard
                      ? dashboard.active_trips_this_period.toLocaleString()
                      : '\u2014',
                  },
                  {
                    label: 'Miles shifted',
                    value: dashboard ? dashboard.miles_shifted.toLocaleString() : '\u2014',
                  },
                  {
                    label: 'CO\u2082 avoided (kg)',
                    value: dashboard ? dashboard.co2_avoided_kg.toFixed(1) : '\u2014',
                  },
                  {
                    label: 'Most popular mode',
                    value: topMode ? prettyMode(topMode.mode) : '\u2014',
                  },
                  {
                    label: 'Shift Rate',
                    value: dashboard ? `${Math.round(dashboard.shift_rate_trip_pct)}%` : '\u2014',
                  },
                ]
                return stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-white/[0.06] p-4 text-center">
                    <div className="text-2xl font-extrabold text-white">{stat.value}</div>
                    <div className="mt-1 text-xs text-white/60">{stat.label}</div>
                  </div>
                ))
              })()}
            </div>

            {!dashboard || dashboard.trips_this_period === 0 ? (
              <p className="text-sm text-white/50">
                Impact data will appear here once employees start logging trips in the Shift app.
              </p>
            ) : null}

            {/* Mode breakdown bars — only show when we have data */}
            {dashboard && dashboard.mode_breakdown.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Mode breakdown
                </h3>
                {(() => {
                  const total = dashboard.mode_breakdown.reduce(
                    (s, m) => s + m.trip_count,
                    0,
                  )
                  return dashboard.mode_breakdown.map((m) => {
                    const pct = total > 0 ? Math.round((m.trip_count / total) * 100) : 0
                    return (
                      <div key={m.mode}>
                        <div className="flex items-center justify-between text-xs text-white">
                          <span>{prettyMode(m.mode)}</span>
                          <span className="text-white/60">
                            {m.trip_count} · {pct}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full bg-[#BAF14D]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}

            {isTierAtLeast('standard') ? (
              <button
                onClick={downloadImpactReportPdf}
                className="mt-4 rounded-full border border-white/[0.12] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
              >
                Download impact report
              </button>
            ) : (
              <p className="mt-4 text-sm text-white/40">
                Impact report PDF available on Standard and above.{' '}
                <a href="mailto:info@gogreenstreets.org" className="underline">
                  Contact us to upgrade
                </a>
                .
              </p>
            )}
          </section>

          {/* ── Section 5b: Employee rewards pool (Premium only) */}
          {group.tier === 'premium' && (
            <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
              <h2 className="mb-1 font-display text-base font-bold text-white">
                Employee rewards pool
              </h2>
              <p className="mb-5 text-xs text-white/50">
                Funds you&apos;ve contributed for employees to redeem as gift cards and transit
                passes via the Shift app.
              </p>

              {fundingPool ? (
                (() => {
                  const total = fundingPool.budget_total_cents
                  const remaining = fundingPool.budget_remaining_cents
                  const spent = fundingPool.budget_spent_cents
                  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0
                  const depletionLabel =
                    remaining === 0
                      ? 'Depleted'
                      : remaining < 1000
                        ? 'Nearly depleted'
                        : remaining < 5000
                          ? 'Running low'
                          : 'Active'
                  const depletionColor =
                    remaining === 0
                      ? 'text-white/50'
                      : remaining < 1000
                        ? 'text-[#E05252]'
                        : remaining < 5000
                          ? 'text-[#EDB93C]'
                          : 'text-[#BAF14D]'
                  return (
                    <>
                      <div className="mb-4 flex items-baseline justify-between">
                        <div>
                          <div className="text-3xl font-extrabold text-white">
                            {centsToDollars(remaining)}
                          </div>
                          <div className="text-xs text-white/60">
                            remaining of {centsToDollars(total)} ·{' '}
                            {centsToDollars(spent)} redeemed
                          </div>
                        </div>
                        <span
                          className={`rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold ${depletionColor}`}
                        >
                          {depletionLabel}
                        </span>
                      </div>

                      <div className="mb-6 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className={`h-full ${
                            pct >= 20
                              ? 'bg-[#BAF14D]'
                              : pct >= 5
                                ? 'bg-[#EDB93C]'
                                : 'bg-[#E05252]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                        <button
                          type="button"
                          disabled
                          className="rounded-full bg-white/[0.08] px-5 py-2 text-sm font-medium text-white/40"
                          title="Top-up UI ships in the upcoming Stripe integration"
                        >
                          Top up pool
                        </button>
                        <p className="mt-2 text-xs text-white/40">
                          Stripe top-up is coming soon. For now, email{' '}
                          <a
                            href="mailto:info@gogreenstreets.org"
                            className="underline"
                          >
                            info@gogreenstreets.org
                          </a>{' '}
                          to add funds.
                        </p>
                      </div>
                    </>
                  )
                })()
              ) : (
                <p className="text-sm text-white/50">
                  Your rewards pool hasn&apos;t been provisioned yet. Contact{' '}
                  <a href="mailto:info@gogreenstreets.org" className="underline">
                    info@gogreenstreets.org
                  </a>{' '}
                  to activate it.
                </p>
              )}
            </section>
          )}

          {/* ── Section 6: Account settings ────────────────── */}
          <section
            id="account-settings"
            className="mb-8 scroll-mt-24 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
          >
            <h2 className="mb-5 font-display text-base font-bold text-white">Account settings</h2>

            {editingAccount ? (
              <div className="space-y-4">
                <DashField
                  label="Company name"
                  value={accountForm.name}
                  onChange={(v) => setAccountForm({ ...accountForm, name: v })}
                  required
                />
                <DashField
                  label="Admin name"
                  value={accountForm.admin_name}
                  onChange={(v) => setAccountForm({ ...accountForm, admin_name: v })}
                />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white">Admin email</label>
                  <p className="text-[0.9375rem] text-white/60">{group.admin_email}</p>
                  <p className="mt-1 text-xs text-white/40">
                    Contact GSI at info@gogreenstreets.org to change your email.
                  </p>
                </div>
                <DashField
                  label="Admin phone"
                  value={accountForm.admin_phone}
                  onChange={(v) => setAccountForm({ ...accountForm, admin_phone: v })}
                />
                <DashField
                  label="Website URL"
                  value={accountForm.website_url}
                  onChange={(v) => setAccountForm({ ...accountForm, website_url: v })}
                  placeholder="https://"
                />

                {/* Logo is now uploaded from the portal header (click the
                    logo thumbnail next to your company name). Keeping it
                    top-of-page makes onboarding one click and avoids the
                    "settings edit mode required" hop employers hit before. */}

                <div className="flex gap-3">
                  <button
                    onClick={saveAccount}
                    disabled={!accountForm.name.trim() || savingAccount}
                    className="rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    {savingAccount ? 'Saving\u2026' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => {
                      setAccountForm({
                        name: group.name || '',
                        admin_name: group.admin_name || '',
                        admin_phone: group.admin_phone || '',
                        website_url: group.website_url || '',
                      })
                      setEditingAccount(false)
                    }}
                    className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="space-y-3">
                  <InfoRow label="Company" value={group.name} />
                  <InfoRow label="Admin" value={group.admin_name || '\u2014'} />
                  <InfoRow label="Email" value={group.admin_email} />
                  <InfoRow label="Phone" value={group.admin_phone || '\u2014'} />
                  <InfoRow label="Website" value={group.website_url || '\u2014'} />
                  <InfoRow label="Tier" value={group.tier.charAt(0).toUpperCase() + group.tier.slice(1)} />
                </div>
                <button
                  onClick={() => setEditingAccount(true)}
                  className="mt-5 rounded-full border border-white/[0.12] px-5 py-2 text-sm font-medium text-white"
                >
                  Edit settings
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />

      {/* ── End challenge modal ─────────────────────────────── */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[420px] rounded-[18px] bg-[#242538] p-8">
            <h3 className="mb-3 font-display text-lg font-bold text-white">End challenge early?</h3>
            <p className="mb-6 text-sm leading-relaxed text-white">
              This will end your current challenge immediately. Employee standings will be finalized
              as of now. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={endChallenge}
                disabled={endingChallenge}
                className="rounded-full bg-[#E05252] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {endingChallenge ? 'Ending\u2026' : 'End challenge'}
              </button>
              <button
                onClick={() => setShowEndModal(false)}
                className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── shared helpers ────────────────────────────────────────── */

function DashField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white">
        {label}
        {required && <span className="text-[#E05252]"> *</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none placeholder:text-white/45 focus:border-[#BAF14D]"
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/[0.04] pb-2">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  )
}

/* ── Setup overview: checklist + subscription status ───────── */

const TIER_LABEL: Record<string, string> = {
  basic: 'Basic',
  standard: 'Standard',
  premium: 'Premium',
}

const TIER_ANNUAL_PRICE: Record<string, string> = {
  basic: '$1,000 / year',
  standard: '$3,000 / year',
  premium: '$5,000 / year',
}

function SetupOverview({
  group,
  memberCount,
  hasChallenge,
  benefits,
}: {
  group: Group
  memberCount: number
  hasChallenge: boolean
  benefits: EmployerBenefits
}) {
  const [openingPortal, setOpeningPortal] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  async function openCustomerPortal() {
    setPortalError(null)
    setOpeningPortal(true)
    try {
      // functions.invoke() attaches both the session JWT and the anon
      // apikey header, which the Supabase gateway requires for
      // JWT-verified functions. A raw fetch with only Authorization
      // bounces at the gateway with 401 before the function runs.
      const { data, error } = await supabase.functions.invoke<{
        url?: string
        error?: string
      }>('employer-portal-session', {
        body: { return_url: window.location.href },
      })

      if (error) {
        // 409 = comped / invoiced group with no Stripe customer on file.
        // Fall back to the mailto path so they can still reach GSI.
        const status = (error as { context?: { status?: number } }).context?.status
        if (status === 409) {
          window.location.href =
            'mailto:info@gogreenstreets.org?subject=Shift%20Employer%20renewal'
          return
        }
        throw new Error(
          (data?.error as string | undefined) ??
            error.message ??
            "Couldn't open billing portal",
        )
      }
      if (!data?.url) throw new Error('Billing portal URL missing')
      window.location.href = data.url
    } catch (err: unknown) {
      setPortalError(err instanceof Error ? err.message : String(err))
      setOpeningPortal(false)
    }
  }
  // Checklist heuristics — each item becomes ✓ when the underlying signal is true.
  const items: Array<{ label: string; done: boolean; anchor: string }> = [
    {
      label: 'Company profile complete',
      done: Boolean(group.admin_name && group.website_url),
      anchor: '#account-settings',
    },
    {
      label: 'Logo uploaded',
      done: Boolean(group.logo_url),
      anchor: '#portal-header',
    },
    {
      label: 'Employees joined',
      done: memberCount > 0,
      anchor: '#invite-code',
    },
    {
      label: 'Active challenge running',
      done: hasChallenge,
      anchor: '#your-challenge',
    },
    {
      label: 'Commute Advisor configured',
      done: Boolean(
        benefits?.destination_lat &&
          benefits?.destination_lng,
      ),
      anchor: '#commute-advisor',
    },
  ]
  const completed = items.filter((i) => i.done).length
  const total = items.length
  const allDone = completed === total
  const pct = Math.round((completed / total) * 100)

  // Subscription status card math
  const endsAt = group.access_ends_at ? new Date(group.access_ends_at) : null
  const startsAt = group.access_starts_at ? new Date(group.access_starts_at) : null
  const now = new Date()
  const daysUntilRenewal = endsAt
    ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86400000))
    : null
  const renewalTone =
    daysUntilRenewal == null
      ? 'neutral'
      : daysUntilRenewal <= 30
        ? 'warn'
        : 'ok'
  const subscriptionBadge =
    group.status === 'cancelled'
      ? { label: 'Cancelled', className: 'bg-[#EDB93C]/15 text-[#EDB93C]' }
      : renewalTone === 'warn'
        ? { label: 'Renewal due soon', className: 'bg-[#EDB93C]/15 text-[#EDB93C]' }
        : { label: 'Active', className: 'bg-[#BAF14D]/15 text-[#BAF14D]' }

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* Checklist */}
      <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-base font-bold text-white">
            {allDone ? 'Setup complete' : 'Finish setup'}
          </h2>
          <span className="text-xs text-white/50">
            {completed} / {total}
          </span>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full bg-[#BAF14D] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.label}>
              <a
                href={item.anchor}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.04]"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    item.done
                      ? 'bg-[#BAF14D] text-[#191A2E]'
                      : 'border border-white/20 text-white/40'
                  }`}
                  aria-hidden
                >
                  {item.done ? '\u2713' : ''}
                </span>
                <span className={item.done ? 'text-white/80' : 'text-white'}>
                  {item.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Subscription */}
      <aside className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-base font-bold text-white">Subscription</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${subscriptionBadge.className}`}
          >
            {subscriptionBadge.label}
          </span>
        </div>

        <div className="mb-1 text-lg font-bold text-white">
          {TIER_LABEL[group.tier] ?? group.tier}
        </div>
        <div className="mb-4 text-xs text-white/50">
          {TIER_ANNUAL_PRICE[group.tier] ?? ''}
        </div>

        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-white/50">Started</dt>
            <dd className="text-white">
              {startsAt
                ? startsAt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '\u2014'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-white/50">
              {group.status === 'cancelled' ? 'Access ends' : 'Renews'}
            </dt>
            <dd className="text-white">
              {endsAt
                ? endsAt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '\u2014'}
            </dd>
          </div>
          {daysUntilRenewal != null && (
            <div className="flex justify-between">
              <dt className="text-white/50">Days left</dt>
              <dd
                className={
                  daysUntilRenewal <= 30 ? 'text-[#EDB93C]' : 'text-white'
                }
              >
                {daysUntilRenewal}
              </dd>
            </div>
          )}
        </dl>

        <button
          type="button"
          onClick={openCustomerPortal}
          disabled={openingPortal}
          className="mt-4 inline-flex rounded-full border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {openingPortal ? 'Opening\u2026' : 'Manage billing'}
        </button>
        {portalError && (
          <p className="mt-2 text-xs text-[#E05252]">{portalError}</p>
        )}
      </aside>
    </div>
  )
}
