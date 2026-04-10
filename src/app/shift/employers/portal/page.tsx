'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { supabase } from '@/lib/supabase'
import type { EmployerBenefits, ShuttleRoute } from '@/lib/types/commute'

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

  // Logo state
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoError, setLogoError] = useState('')

  // End challenge modal
  const [showEndModal, setShowEndModal] = useState(false)
  const [endingChallenge, setEndingChallenge] = useState(false)

  // Leaderboard period
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'7' | '30' | 'all'>('30')

  /* ── data fetching ───────────────────────────────────────── */

  const fetchData = useCallback(
    async (email: string) => {
      // Link employer to auth user (enables RLS)
      try {
        await supabase.rpc('link_employer_on_login')
      } catch {}

      const { data: groupData } = await supabase
        .from('groups')
        .select(
          'id, name, slug, status, admin_name, admin_email, admin_phone, website_url, logo_url, invite_code, tier, access_starts_at, access_ends_at, public_leaderboard, employer_benefits'
        )
        .eq('admin_email', email)
        .limit(1)
        .single()

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

      // Fetch active challenge for this group
      const now = new Date().toISOString()
      const [challengeRes, memberRes] = await Promise.all([
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
      setLoading(false)
    },
    [router]
  )

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

    // Header bar
    doc.setFillColor(25, 26, 46)
    doc.rect(0, 0, w, 90, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.setTextColor(255, 255, 255)
    doc.text('Shift', 50, 55)
    doc.setFontSize(11)
    doc.setTextColor(186, 241, 77)
    doc.text('Green Streets Initiative', 50, 73)

    // Title
    doc.setTextColor(25, 26, 46)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text(group.name, centerX, 140, { align: 'center' })
    doc.setFontSize(16)
    doc.setFont('helvetica', 'normal')
    doc.text('Shift Challenge Impact Report', centerX, 168, { align: 'center' })
    doc.setFontSize(12)
    doc.setTextColor(120, 120, 120)
    doc.text(today, centerX, 192, { align: 'center' })

    // Challenge info
    if (challenge) {
      doc.setFontSize(11)
      doc.setTextColor(80, 80, 80)
      doc.text(
        `${challenge.name}  ·  ${formatDate(challenge.starts_at)} – ${formatDate(challenge.ends_at)}`,
        centerX,
        225,
        { align: 'center' }
      )
    }

    // Stats table
    const stats = [
      { label: 'Employees joined', value: memberCount > 0 ? String(memberCount) : '\u2014' },
      { label: 'Active trips logged', value: '\u2014' },
      { label: 'Miles shifted', value: '\u2014' },
      { label: 'CO\u2082 avoided (kg)', value: '\u2014' },
      { label: 'Most popular mode', value: '\u2014' },
      { label: 'Average Shift Rate', value: '\u2014' },
    ]

    const tableTop = challenge ? 260 : 240
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

    // Note
    const noteY = tableTop + stats.length * rowH + 30
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    const note = doc.splitTextToSize(
      'This report reflects aggregate data only. Individual employee trip data is never disclosed to employers. ' +
        'Trip metrics will populate as employees join your group and log trips in the Shift app.',
      w - 160
    )
    doc.text(note, centerX, noteY, { align: 'center' })

    // Footer
    doc.setDrawColor(220, 220, 220)
    doc.line(50, 680, w - 50, 680)
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text('gogreenstreets.org', centerX, 705, { align: 'center' })
    doc.text('Shift by Green Streets Initiative', centerX, 720, { align: 'center' })

    const slug = group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const dateSlug = new Date().toISOString().split('T')[0]
    doc.save(`${slug}-shift-impact-report-${dateSlug}.pdf`)
  }

  async function saveAccount() {
    if (!group) return
    setSavingAccount(true)

    let newLogoUrl = group.logo_url

    if (logoFile) {
      const ext = (logoFile.name.split('.').pop() || 'png').toLowerCase()
      const mimeMap: Record<string, string> = {
        svg: 'image/svg+xml',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
      }
      const contentType = mimeMap[ext] || logoFile.type
      const path = `logos/${Date.now()}-${group.id.slice(0, 8)}.${ext}`

      const { createClient } = await import('@supabase/supabase-js')
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      )
      const { error: uploadErr } = await anonClient.storage
        .from('employer-logos')
        .upload(path, logoFile, { contentType })

      if (!uploadErr) {
        newLogoUrl = anonClient.storage.from('employer-logos').getPublicUrl(path).data.publicUrl
      }
    }

    await supabase
      .from('groups')
      .update({
        name: accountForm.name.trim(),
        admin_name: accountForm.admin_name.trim() || null,
        admin_phone: accountForm.admin_phone.trim() || null,
        website_url: accountForm.website_url.trim() || null,
        logo_url: newLogoUrl,
      })
      .eq('id', group.id)

    setGroup({
      ...group,
      name: accountForm.name.trim(),
      admin_name: accountForm.admin_name.trim() || null,
      admin_phone: accountForm.admin_phone.trim() || null,
      website_url: accountForm.website_url.trim() || null,
      logo_url: newLogoUrl,
    })
    setLogoFile(null)
    setLogoPreview(null)
    setEditingAccount(false)
    setSavingAccount(false)
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
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

    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
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
          <div className="mb-10 flex items-start justify-between">
            <div className="flex items-center gap-4">
              {group.logo_url && (
                <img
                  src={group.logo_url}
                  alt=""
                  className="h-12 w-12 rounded-lg object-contain"
                />
              )}
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
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-white"
            >
              Sign out
            </button>
          </div>

          {/* ── Section 1: Invite code ─────────────────────── */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
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
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
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
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
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

          {/* ── Section 4: Employee leaderboard (placeholder) */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              Employee leaderboard
            </h2>

            {/* Period toggle (rendered but inactive) */}
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

            <p className="py-6 text-center text-sm text-white/50">
              No employee trip data yet. Once employees join your group and log trips in the Shift
              app, their standings will appear here.
            </p>

            <p className="text-xs leading-[1.5] text-white/30">
              This leaderboard is visible only to you as the group administrator. Employees cannot
              see each other&apos;s data except through the shared in-app leaderboard.
            </p>
          </section>

          {/* ── Section 5: Impact stats (placeholder) ──────── */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">Impact report</h2>

            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              {[
                { label: 'Employees joined', value: memberCount > 0 ? String(memberCount) : '\u2014' },
                { label: 'Active trips', value: '\u2014' },
                { label: 'Miles shifted', value: '\u2014' },
                { label: 'CO\u2082 avoided (kg)', value: '\u2014' },
                { label: 'Most popular mode', value: '\u2014' },
                { label: 'Avg Shift Rate', value: '\u2014' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/[0.06] p-4 text-center">
                  <div className="text-2xl font-extrabold text-white">{stat.value}</div>
                  <div className="mt-1 text-xs text-white/60">{stat.label}</div>
                </div>
              ))}
            </div>

            <p className="text-sm text-white/50">
              Impact data will appear here once your challenge is underway and employees start
              logging trips.
            </p>

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

          {/* ── Section 6: Account settings ────────────────── */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
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

                {/* Logo upload */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white">Logo</label>
                  {(logoPreview || group.logo_url) && (
                    <img
                      src={logoPreview || group.logo_url || ''}
                      alt=""
                      className="mb-3 h-16 w-16 rounded-lg object-contain"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoSelect}
                    className="block w-full text-sm text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                  />
                  {logoError && <p className="mt-1 text-sm text-[#E05252]">{logoError}</p>}
                </div>

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
                      setLogoFile(null)
                      setLogoPreview(null)
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
