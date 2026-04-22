'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'percentage', label: 'Percentage off' },
  { value: 'fixed_amount', label: 'Dollar amount off' },
  { value: 'freebie', label: 'Free item' },
  { value: 'custom', label: 'Custom offer' },
]

const REDEMPTION_LIMIT_OPTIONS = [
  { value: 'none', label: 'No limit' },
  { value: 'once_per_visit', label: 'Once per visit' },
  { value: 'once_per_day', label: 'Once per day' },
  { value: 'once_per_week', label: 'Once per week' },
  { value: 'once_per_month', label: 'Once per month' },
]

const CASHIER_GUIDE_BASE = 'https://www.gogreenstreets.org/cashier-guide.html'

// 3"x3" square sticker, served from the website's public folder.
const STICKER_IMAGE_URL = '/shift-partner-sticker.svg'

/** Map sponsor.redemption_limit → rewards.redemption_frequency */
function limitToFrequency(limit: string): string | null {
  switch (limit) {
    case 'once_per_day': return 'daily'
    case 'once_per_week': return 'weekly'
    case 'once_per_month': return 'monthly'
    default: return null
  }
}

/** Parse "20 Munroe St, Somerville, MA 02143" → components */
function parseAddress(addr: string) {
  const parts = addr.split(',').map((s) => s.trim())
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1].split(/\s+/)
    return {
      line1: parts.slice(0, parts.length - 2).join(', '),
      city: parts[parts.length - 2],
      state: stateZip[0] || 'MA',
      zip: stateZip.slice(1).join(' ') || '',
    }
  }
  return { line1: addr, city: '', state: 'MA', zip: '' }
}

// ── Types ─────────────────────────────────────────────────

type Sponsor = {
  id: string
  name: string
  status: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  address: string
  website_url: string | null
  logo_url: string | null
  notes: string | null
  discount_description: string | null
  discount_type: string | null
  redemption_limit: string | null
}

type Reward = {
  id: string
  name: string
  description: string | null
  redemption_frequency: string | null
}

type Redemption = {
  id: string
  points_spent: number
  redeemed_at: string
  status: string
  reward_name: string
}

type SponsorLocation = {
  id: string
  label: string | null
  address: string
  city: string | null
  state: string | null
  zip: string | null
  is_active: boolean
}

// ── Page wrapper ──────────────────────────────────────────

export default function DashboardPageWrapper() {
  return (
    <Suspense fallback={
      <>
        <Nav />
        <main style={{ paddingTop: '60px' }} className="flex min-h-screen items-center justify-center bg-[#191A2E]">
          <div className="text-white">Loading&hellip;</div>
        </main>
        <Footer />
      </>
    }>
      <DashboardPage />
    </Suspense>
  )
}

// ── Main dashboard ────────────────────────────────────────

function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sponsor, setSponsor] = useState<Sponsor | null>(null)
  const [reward, setReward] = useState<Reward | null>(null)
  const [userEmail, setUserEmail] = useState('')

  // Offer edit state
  const [editingOffer, setEditingOffer] = useState(false)
  const [offerDesc, setOfferDesc] = useState('')
  const [offerType, setOfferType] = useState('custom')
  const [offerLimit, setOfferLimit] = useState('none')
  const [savingOffer, setSavingOffer] = useState(false)

  // Contact edit state
  const [editingContact, setEditingContact] = useState(false)
  const [contactForm, setContactForm] = useState({
    name: '',
    contact_name: '',
    contact_phone: '',
    address: '',
    website_url: '',
  })
  const [savingContact, setSavingContact] = useState(false)

  const [showEndModal, setShowEndModal] = useState(false)
  const [statusAction, setStatusAction] = useState(false)

  // Redemption state
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [redemptionPeriod, setRedemptionPeriod] = useState<'30' | '90' | 'all'>('30')
  const [totalAllTime, setTotalAllTime] = useState(0)
  const [totalThisMonth, setTotalThisMonth] = useState(0)

  // Logo state
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoError, setLogoError] = useState('')

  // Locations state
  const [locations, setLocations] = useState<SponsorLocation[]>([])
  const [togglingLocationId, setTogglingLocationId] = useState<string | null>(null)

  // Sticker state
  const [showStickerForm, setShowStickerForm] = useState(false)
  const [stickerAddr, setStickerAddr] = useState({ line1: '', city: '', state: 'MA', zip: '' })
  const [requestingSticker, setRequestingSticker] = useState(false)
  const [stickerMessage, setStickerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Data loading ──────────────────────────────────────

  const fetchData = useCallback(async (email: string) => {
    try { await supabase.rpc('link_sponsor_on_login') } catch {}

    const { data: sponsorData } = await supabase
      .from('sponsors')
      .select('id, name, status, contact_name, contact_email, contact_phone, address, website_url, logo_url, notes, discount_description, discount_type, redemption_limit')
      .eq('contact_email', email)
      .single()

    if (!sponsorData) {
      router.push('/shift/rewards-partners')
      return
    }

    setSponsor(sponsorData)
    setContactForm({
      name: sponsorData.name || '',
      contact_name: sponsorData.contact_name || '',
      contact_phone: sponsorData.contact_phone || '',
      address: sponsorData.address || '',
      website_url: sponsorData.website_url || '',
    })
    setOfferDesc(sponsorData.discount_description || '')
    setOfferType(sponsorData.discount_type || 'custom')
    setOfferLimit(sponsorData.redemption_limit || 'none')

    const [rewardRes, redemptionRes, locationsRes] = await Promise.all([
      supabase
        .from('rewards')
        .select('id, name, description, redemption_frequency')
        .eq('sponsor_id', sponsorData.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('reward_redemptions')
        .select('id, points_spent, redeemed_at, status, rewards!inner(name, sponsor_id)')
        .eq('rewards.sponsor_id', sponsorData.id)
        .order('redeemed_at', { ascending: false })
        .limit(200),
      supabase
        .from('sponsor_locations')
        .select('id, label, address, city, state, zip, is_active')
        .eq('sponsor_id', sponsorData.id)
        .order('created_at', { ascending: true }),
    ])

    if (rewardRes.data) {
      setReward(rewardRes.data)
      // Use sponsor-level fields as source of truth for the offer form
      if (!sponsorData.discount_description && rewardRes.data.name) {
        setOfferDesc(rewardRes.data.name)
      }
    }

    setLocations((locationsRes.data as SponsorLocation[]) ?? [])

    const allRedemptions: Redemption[] = (redemptionRes.data ?? []).map((r: any) => ({
      id: r.id,
      points_spent: r.points_spent,
      redeemed_at: r.redeemed_at,
      status: r.status,
      reward_name: r.rewards?.name ?? '',
    }))

    setRedemptions(allRedemptions)
    setTotalAllTime(allRedemptions.length)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    setTotalThisMonth(
      allRedemptions.filter((r) => new Date(r.redeemed_at) >= monthStart).length,
    )

    setLoading(false)
  }, [router])

  const searchParams = useSearchParams()

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
          router.push('/shift/rewards-partners')
          return
        }
        window.history.replaceState({}, '', window.location.pathname)
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        router.push('/shift/rewards-partners')
        return
      }
      setUserEmail(session.user.email)
      fetchData(session.user.email)
    }
    checkAuth()
  }, [fetchData, router, searchParams])

  // ── Actions ───────────────────────────────────────────

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/shift/rewards-partners')
  }

  async function saveOffer() {
    if (!sponsor || !offerDesc.trim()) return
    setSavingOffer(true)

    // Update sponsor record (source of truth for offer details)
    await supabase
      .from('sponsors')
      .update({
        discount_description: offerDesc.trim(),
        discount_type: offerType,
        redemption_limit: offerLimit,
      })
      .eq('id', sponsor.id)

    // Also update the active reward so the Shift app reflects the change
    if (reward) {
      await supabase
        .from('rewards')
        .update({
          name: offerDesc.trim(),
          description: offerDesc.trim(),
          redemption_frequency: limitToFrequency(offerLimit),
        })
        .eq('id', reward.id)

      setReward({ ...reward, name: offerDesc.trim(), description: offerDesc.trim(), redemption_frequency: limitToFrequency(offerLimit) })
    }

    setSponsor({
      ...sponsor,
      discount_description: offerDesc.trim(),
      discount_type: offerType,
      redemption_limit: offerLimit,
    })
    setEditingOffer(false)
    setSavingOffer(false)
  }

  function cancelOfferEdit() {
    setOfferDesc(sponsor?.discount_description || reward?.name || '')
    setOfferType(sponsor?.discount_type || 'custom')
    setOfferLimit(sponsor?.redemption_limit || 'none')
    setEditingOffer(false)
  }

  async function saveContact() {
    if (!sponsor) return
    setSavingContact(true)

    let newLogoUrl = sponsor.logo_url

    if (logoFile) {
      const ext = (logoFile.name.split('.').pop() || 'png').toLowerCase()
      const mimeMap: Record<string, string> = {
        svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
        jpeg: 'image/jpeg', webp: 'image/webp',
      }
      const contentType = mimeMap[ext] || logoFile.type
      const path = `logos/${Date.now()}-${sponsor.id.slice(0, 8)}.${ext}`

      const { createClient } = await import('@supabase/supabase-js')
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      )
      const { error: uploadErr } = await anonClient.storage
        .from('sponsor-logos')
        .upload(path, logoFile, { contentType })

      if (!uploadErr) {
        newLogoUrl = anonClient.storage.from('sponsor-logos').getPublicUrl(path).data.publicUrl
      }
    }

    await supabase
      .from('sponsors')
      .update({
        name: contactForm.name.trim(),
        contact_name: contactForm.contact_name.trim(),
        contact_phone: contactForm.contact_phone.trim() || null,
        address: contactForm.address.trim(),
        website_url: contactForm.website_url.trim() || null,
        logo_url: newLogoUrl,
      })
      .eq('id', sponsor.id)

    setSponsor({
      ...sponsor,
      name: contactForm.name.trim(),
      contact_name: contactForm.contact_name.trim(),
      contact_phone: contactForm.contact_phone.trim() || null,
      address: contactForm.address.trim(),
      website_url: contactForm.website_url.trim() || null,
      logo_url: newLogoUrl,
    })
    setLogoFile(null)
    setLogoPreview(null)
    setEditingContact(false)
    setSavingContact(false)
  }

  async function toggleStatus() {
    if (!sponsor) return
    setStatusAction(true)
    const newStatus = sponsor.status === 'active' ? 'inactive' : 'active'
    await supabase
      .from('sponsors')
      .update({ status: newStatus })
      .eq('id', sponsor.id)
    setSponsor({ ...sponsor, status: newStatus })
    setStatusAction(false)
  }

  async function endPartnership() {
    if (!sponsor) return
    setStatusAction(true)
    const dateStr = new Date().toISOString().split('T')[0]
    const note = `Partnership ended by partner on ${dateStr}`
    const existingNotes = sponsor.notes ? `${sponsor.notes}\n${note}` : note

    await supabase
      .from('sponsors')
      .update({ status: 'inactive', notes: existingNotes })
      .eq('id', sponsor.id)

    setSponsor({ ...sponsor, status: 'inactive', notes: existingNotes })
    setShowEndModal(false)
    setStatusAction(false)
  }

  async function toggleLocation(loc: SponsorLocation) {
    setTogglingLocationId(loc.id)
    const newActive = !loc.is_active
    await supabase
      .from('sponsor_locations')
      .update({ is_active: newActive })
      .eq('id', loc.id)
    setLocations((prev) =>
      prev.map((l) => (l.id === loc.id ? { ...l, is_active: newActive } : l)),
    )
    setTogglingLocationId(null)
  }

  function openStickerForm() {
    const parsed = sponsor?.address ? parseAddress(sponsor.address) : { line1: '', city: '', state: 'MA', zip: '' }
    setStickerAddr(parsed)
    setStickerMessage(null)
    setShowStickerForm(true)
  }

  async function requestSticker() {
    if (!sponsor) return
    setRequestingSticker(true)
    setStickerMessage(null)

    const { error } = await supabase.functions.invoke('trigger-sticker-order', {
      body: {
        partner_id: sponsor.id,
        business_name: sponsor.name,
        address_line1: stickerAddr.line1,
        city: stickerAddr.city,
        state: stickerAddr.state,
        zip: stickerAddr.zip,
      },
    })

    if (error) {
      setStickerMessage({ type: 'error', text: 'Failed to place sticker order. Please try again or contact us.' })
    } else {
      setStickerMessage({ type: 'success', text: 'Sticker ordered! It will arrive in 5–10 business days.' })
      setShowStickerForm(false)
    }
    setRequestingSticker(false)
  }

  // ── Derived values ────────────────────────────────────

  const displayDesc = editingOffer ? offerDesc : (sponsor?.discount_description || reward?.name || '')
  const displayLimit = editingOffer ? offerLimit : (sponsor?.redemption_limit || 'none')
  const limitLabel = REDEMPTION_LIMIT_OPTIONS.find((o) => o.value === displayLimit)?.label ?? ''
  const cashierGuideUrl = `${CASHIER_GUIDE_BASE}?name=${encodeURIComponent(sponsor?.name ?? '')}&discount=${encodeURIComponent(displayDesc)}&limit=${encodeURIComponent(displayLimit)}`

  // ── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Nav />
        <main style={{ paddingTop: '60px' }} className="flex min-h-screen items-center justify-center bg-[#191A2E]">
          <div className="text-white">Loading&hellip;</div>
        </main>
        <Footer />
      </>
    )
  }

  if (!sponsor) return null

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }} className="min-h-screen bg-[#191A2E]">
        <div className="mx-auto max-w-[800px] px-8 py-16">

          {/* Shift branding */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="font-display text-[1.5rem] font-extrabold tracking-[-0.04em] text-white">
                Shift
              </span>
              <svg viewBox="0 0 36 28" width="24" height="18" className="shrink-0">
                <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
                <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
              </svg>
              <span className="text-sm text-white/40">Rewards Partner</span>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-white"
            >
              Sign out
            </button>
          </div>

          {/* Partner header */}
          <div className="mb-10">
            <h1 className="font-display text-[clamp(1.75rem,3vw,2.25rem)] font-extrabold tracking-tight text-white">
              {sponsor.name}
            </h1>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                sponsor.status === 'active'
                  ? 'bg-[#BAF14D]/15 text-[#BAF14D]'
                  : 'bg-white/10 text-white'
              }`}
            >
              {sponsor.status === 'active' ? 'Active' : 'Paused'}
            </span>
          </div>

          {/* ── Live listing preview ─────────────────────── */}
          <section className="mb-8">
            <h2 className="mb-3 font-display text-base font-bold text-white">
              How your listing looks in the Shift app
            </h2>
            <div className="overflow-hidden rounded-[18px] bg-[#12121f] p-4">
              <div className="flex items-center gap-3 rounded-xl bg-[#2a2a3e] p-4">
                {sponsor.logo_url ? (
                  <img
                    src={sponsor.logo_url}
                    alt=""
                    className="h-14 w-14 rounded-xl bg-white object-contain p-1"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#3a3a5e] text-xl font-bold text-blue-400">
                    {sponsor.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{sponsor.name}</p>
                  <p className="text-sm text-[#BAF14D]">
                    {displayDesc || 'Your offer will appear here'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {displayLimit !== 'none' ? `${limitLabel} · ` : ''}
                    {sponsor.name}
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="rounded-lg bg-[#BAF14D]/10 px-3 py-1.5 text-sm font-bold text-[#BAF14D]">
                    Show badge
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-white/40">
              {editingOffer
                ? 'This is a live preview — changes you make below will update it instantly.'
                : 'This is what Shift users see in their rewards list.'}
            </p>
          </section>

          {/* ── Current offer ────────────────────────────── */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">Current offer</h2>

            {!reward && !sponsor.discount_description ? (
              <p className="text-[0.9375rem] text-white">
                Your offer is under review. We&apos;ll notify you when it&apos;s live in the catalog.
              </p>
            ) : editingOffer ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white">
                    Describe the discount *
                  </label>
                  <textarea
                    value={offerDesc}
                    onChange={(e) => {
                      if (e.target.value.length <= 200) setOfferDesc(e.target.value)
                    }}
                    maxLength={200}
                    rows={3}
                    placeholder="e.g. 10% off all drinks"
                    className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none placeholder:text-white/45 focus:border-[#BAF14D]"
                  />
                  <div className="mt-1 flex justify-between text-xs text-white/40">
                    <span>This is exactly what Shift users will see.</span>
                    <span>{offerDesc.length}/200</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white">
                      Discount type
                    </label>
                    <select
                      value={offerType}
                      onChange={(e) => setOfferType(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none focus:border-[#BAF14D]"
                    >
                      {DISCOUNT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white">
                      Redemption limit
                    </label>
                    <select
                      value={offerLimit}
                      onChange={(e) => setOfferLimit(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none focus:border-[#BAF14D]"
                    >
                      {REDEMPTION_LIMIT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={saveOffer}
                    disabled={!offerDesc.trim() || savingOffer}
                    className="rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    {savingOffer ? 'Saving\u2026' : 'Save changes'}
                  </button>
                  <button
                    onClick={cancelOfferEdit}
                    className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-1 text-[0.9375rem] font-medium text-white">
                  {sponsor.discount_description || reward?.name || '—'}
                </p>
                <p className="mt-1 text-sm text-white/60">
                  Type: {DISCOUNT_TYPE_OPTIONS.find((o) => o.value === sponsor.discount_type)?.label ?? '—'}
                </p>
                <p className="mt-1 text-sm text-white/60">
                  Limit: {REDEMPTION_LIMIT_OPTIONS.find((o) => o.value === sponsor.redemption_limit)?.label ?? 'No limit'}
                </p>
                <button
                  onClick={() => setEditingOffer(true)}
                  className="mt-4 rounded-full border border-white/[0.12] px-5 py-2 text-sm font-medium text-white"
                >
                  Edit offer
                </button>
              </div>
            )}
          </section>

          {/* ── How Redemption Works ─────────────────────── */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              How redemption works
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D]/15 text-lg font-bold text-[#BAF14D]">
                  1
                </div>
                <p className="text-sm font-semibold text-white">Customer shows badge</p>
                <p className="mt-1 text-xs text-white/50">
                  Shift users show their in-app badge at checkout — just like a membership card.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D]/15 text-lg font-bold text-[#BAF14D]">
                  2
                </div>
                <p className="text-sm font-semibold text-white">You apply the discount</p>
                <p className="mt-1 text-xs text-white/50">
                  Your staff applies the discount manually — no POS integration, no special hardware needed.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D]/15 text-lg font-bold text-[#BAF14D]">
                  3
                </div>
                <p className="text-sm font-semibold text-white">That&apos;s it!</p>
                <p className="mt-1 text-xs text-white/50">
                  The customer confirms in the app. No extra steps for you or your team.
                </p>
              </div>
            </div>
            <div className="mt-6 text-center">
              <a
                href={cashierGuideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Cashier Guide
              </a>
              <p className="mt-2 text-xs text-white/40">
                A printable one-page guide for your staff with step-by-step instructions.
              </p>
            </div>
          </section>

          {/* ── Redemption activity ──────────────────────── */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              Redemption activity
            </h2>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/[0.06] p-4 text-center">
                <div className="text-2xl font-extrabold text-[#BAF14D]">{totalThisMonth}</div>
                <div className="mt-1 text-xs text-white/60">This month</div>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-4 text-center">
                <div className="text-2xl font-extrabold text-white">{totalAllTime}</div>
                <div className="mt-1 text-xs text-white/60">All time</div>
              </div>
            </div>

            <div className="mb-4 flex gap-2">
              {([['30', '30 days'], ['90', '90 days'], ['all', 'All time']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setRedemptionPeriod(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    redemptionPeriod === key
                      ? 'bg-[#BAF14D] text-[#191A2E]'
                      : 'border border-white/[0.12] text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {(() => {
              const now = new Date()
              const sinceDate = redemptionPeriod === 'all'
                ? null
                : new Date(now.getTime() - Number(redemptionPeriod) * 24 * 60 * 60 * 1000)
              const filtered = sinceDate
                ? redemptions.filter((r) => new Date(r.redeemed_at) >= sinceDate)
                : redemptions

              if (filtered.length === 0) {
                return (
                  <p className="py-4 text-center text-sm text-white/50">
                    No redemptions yet — they&apos;ll appear here as Shift users redeem your offer.
                  </p>
                )
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08]">
                        <th className="pb-2 text-left text-xs font-medium text-white/50">Date</th>
                        <th className="pb-2 text-left text-xs font-medium text-white/50">Reward</th>
                        <th className="pb-2 text-right text-xs font-medium text-white/50">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b border-white/[0.04]">
                          <td className="py-2.5 text-white/80">
                            {new Date(r.redeemed_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </td>
                          <td className="py-2.5 text-white">{r.reward_name}</td>
                          <td className="py-2.5 text-right">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.status === 'verified'
                                ? 'bg-[#BAF14D]/15 text-[#BAF14D]'
                                : r.status === 'redeemed'
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : 'bg-white/10 text-white/60'
                            }`}>
                              {r.status === 'verified' ? 'Verified' : r.status === 'redeemed' ? 'Pending' : r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </section>

          {/* ── Locations ────────────────────────────────── */}
          {locations.length > 0 && (
            <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
              <h2 className="mb-5 font-display text-base font-bold text-white">
                Locations
              </h2>
              <p className="mb-4 text-sm text-white/50">
                Toggle locations on or off. Inactive locations won&apos;t appear in the Shift app.
              </p>
              <div className="space-y-3">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className={`flex items-center justify-between rounded-xl bg-white/[0.06] px-4 py-3 ${
                      !loc.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {loc.label && (
                        <p className="text-sm font-semibold text-white">{loc.label}</p>
                      )}
                      <p className={`text-sm ${loc.label ? 'text-white/60' : 'text-white'}`}>
                        {loc.address}
                        {loc.city ? `, ${loc.city}` : ''}
                        {loc.state ? `, ${loc.state}` : ''}
                        {loc.zip ? ` ${loc.zip}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleLocation(loc)}
                      disabled={togglingLocationId === loc.id}
                      className={`ml-4 shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                        loc.is_active
                          ? 'bg-[#BAF14D]/15 text-[#BAF14D]'
                          : 'border border-white/[0.12] text-white/60'
                      }`}
                    >
                      {togglingLocationId === loc.id
                        ? '\u2026'
                        : loc.is_active
                          ? 'Active'
                          : 'Inactive'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Window sticker ───────────────────────────── */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              Window sticker
            </h2>
            <div className="flex items-start gap-6">
              <img
                src={STICKER_IMAGE_URL}
                alt="Shift Rewards Partner sticker"
                className="h-24 w-24 rounded-lg object-contain"
              />
              <div className="flex-1">
                <p className="text-sm text-white/60">
                  Display the Shift Rewards Partner sticker in your window so customers know you participate.
                  Need another one? We&apos;ll mail it to you.
                </p>

                {stickerMessage && (
                  <div
                    className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${
                      stickerMessage.type === 'success'
                        ? 'bg-[#BAF14D]/15 text-[#BAF14D]'
                        : 'bg-[#E05252]/15 text-[#E05252]'
                    }`}
                  >
                    {stickerMessage.text}
                  </div>
                )}

                {!showStickerForm ? (
                  <button
                    onClick={openStickerForm}
                    className="mt-3 rounded-full border border-white/[0.12] px-5 py-2 text-sm font-medium text-white"
                  >
                    Request another sticker
                  </button>
                ) : (
                  <div className="mt-3 space-y-3 rounded-xl border border-white/[0.12] bg-white/[0.04] p-4">
                    <p className="text-xs font-medium text-white/60">
                      Confirm shipping address
                    </p>
                    <input
                      type="text"
                      value={stickerAddr.line1}
                      onChange={(e) => setStickerAddr({ ...stickerAddr, line1: e.target.value })}
                      placeholder="Street address"
                      className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-[#BAF14D]"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={stickerAddr.city}
                        onChange={(e) => setStickerAddr({ ...stickerAddr, city: e.target.value })}
                        placeholder="City"
                        className="rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-[#BAF14D]"
                      />
                      <input
                        type="text"
                        value={stickerAddr.state}
                        onChange={(e) => setStickerAddr({ ...stickerAddr, state: e.target.value })}
                        placeholder="State"
                        className="rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-[#BAF14D]"
                      />
                      <input
                        type="text"
                        value={stickerAddr.zip}
                        onChange={(e) => setStickerAddr({ ...stickerAddr, zip: e.target.value })}
                        placeholder="ZIP"
                        className="rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-[#BAF14D]"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={requestSticker}
                        disabled={requestingSticker || !stickerAddr.line1 || !stickerAddr.city}
                        className="rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85 disabled:opacity-40"
                      >
                        {requestingSticker ? 'Ordering\u2026' : 'Send sticker'}
                      </button>
                      <button
                        onClick={() => setShowStickerForm(false)}
                        className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Contact & business info ──────────────────── */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              Contact &amp; business info
            </h2>

            {editingContact ? (
              <div className="space-y-4">
                <DashField
                  label="Business name"
                  value={contactForm.name}
                  onChange={(v) => setContactForm({ ...contactForm, name: v })}
                />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white">Logo</label>
                  <div className="flex items-center gap-4">
                    {(logoPreview || sponsor.logo_url) && (
                      <img
                        src={logoPreview || sponsor.logo_url!}
                        alt=""
                        className="h-14 w-14 rounded-lg border border-white/[0.12] bg-white object-contain p-1"
                      />
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.svg,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          if (file) {
                            const maxSize = 5 * 1024 * 1024
                            const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
                            if (file.size > maxSize) {
                              setLogoError('Logo must be under 5 MB')
                              return
                            }
                            if (!allowedTypes.includes(file.type)) {
                              setLogoError('Logo must be a PNG, JPG, SVG, or WebP file')
                              return
                            }
                            setLogoError('')
                            setLogoFile(file)
                            setLogoPreview(URL.createObjectURL(file))
                          }
                        }}
                        className="w-full text-sm text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-white/[0.1] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:cursor-pointer"
                      />
                      {logoError && <p className="mt-1 text-xs text-[#E05252]">{logoError}</p>}
                    </div>
                  </div>
                </div>
                <DashField
                  label="Contact name"
                  value={contactForm.contact_name}
                  onChange={(v) => setContactForm({ ...contactForm, contact_name: v })}
                />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[0.9375rem] text-white outline-none"
                  />
                  <p className="mt-1 text-xs text-white/40">
                    To change your login email, contact us at info@gogreenstreets.org
                  </p>
                </div>
                <DashField
                  label="Phone number"
                  value={contactForm.contact_phone}
                  onChange={(v) => setContactForm({ ...contactForm, contact_phone: v })}
                />
                <DashField
                  label="Address"
                  value={contactForm.address}
                  onChange={(v) => setContactForm({ ...contactForm, address: v })}
                />
                <DashField
                  label="Website"
                  value={contactForm.website_url}
                  onChange={(v) => setContactForm({ ...contactForm, website_url: v })}
                  placeholder="https://"
                />
                <div className="flex gap-3">
                  <button
                    onClick={saveContact}
                    disabled={savingContact}
                    className="rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    {savingContact ? 'Saving\u2026' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => {
                      setContactForm({
                        name: sponsor.name || '',
                        contact_name: sponsor.contact_name || '',
                        contact_phone: sponsor.contact_phone || '',
                        address: sponsor.address || '',
                        website_url: sponsor.website_url || '',
                      })
                      setLogoFile(null)
                      setLogoPreview(null)
                      setLogoError('')
                      setEditingContact(false)
                    }}
                    className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {sponsor.logo_url && (
                  <div className="mb-5">
                    <img
                      src={sponsor.logo_url}
                      alt={`${sponsor.name} logo`}
                      className="h-16 w-16 rounded-lg border border-white/[0.12] bg-white object-contain p-1"
                    />
                  </div>
                )}
                <dl className="space-y-3">
                  <InfoRow label="Business" value={sponsor.name} />
                  <InfoRow label="Contact" value={sponsor.contact_name} />
                  <InfoRow label="Email" value={sponsor.contact_email} />
                  <InfoRow label="Phone" value={sponsor.contact_phone || '—'} />
                  <InfoRow label="Address" value={sponsor.address} />
                  <div className="flex gap-4">
                    <dt className="w-20 shrink-0 text-sm text-white/60">Website</dt>
                    <dd className="text-sm">
                      {sponsor.website_url ? (
                        <a
                          href={sponsor.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#BAF14D] underline underline-offset-2"
                        >
                          {sponsor.website_url}
                        </a>
                      ) : (
                        <span className="text-white">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
                <button
                  onClick={() => setEditingContact(true)}
                  className="mt-5 rounded-full border border-white/[0.12] px-5 py-2 text-sm font-medium text-white"
                >
                  Edit
                </button>
              </div>
            )}
          </section>

          {/* ── Partnership status ───────────────────────── */}
          <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              Partnership status
            </h2>

            {sponsor.status === 'active' ? (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={toggleStatus}
                  disabled={statusAction}
                  className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  Pause my listing
                </button>
                <button
                  onClick={() => setShowEndModal(true)}
                  className="rounded-full border border-[#E05252]/30 px-5 py-2.5 text-sm font-medium text-[#E05252]/70 transition-colors hover:text-[#E05252]"
                >
                  End my partnership
                </button>
              </div>
            ) : (
              <div>
                <p className="mb-4 text-sm text-white/60">
                  Your listing is paused. Shift users won&apos;t see your offer until you
                  reactivate.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={toggleStatus}
                    disabled={statusAction}
                    className="rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    Reactivate listing
                  </button>
                  <button
                    onClick={() => setShowEndModal(true)}
                    className="rounded-full border border-[#E05252]/30 px-5 py-2.5 text-sm font-medium text-[#E05252]/70 transition-colors hover:text-[#E05252]"
                  >
                    End my partnership
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* End partnership modal */}
        {showEndModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-[420px] rounded-[18px] bg-[#242538] p-8">
              <h3 className="mb-3 font-display text-lg font-bold text-white">
                End your partnership?
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-white/60">
                Are you sure? This will permanently remove your listing from the Shift rewards
                catalog. This action can&apos;t be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={endPartnership}
                  disabled={statusAction}
                  className="rounded-full bg-[#E05252] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                >
                  {statusAction ? 'Ending\u2026' : 'Yes, end partnership'}
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
      </main>
      <Footer />
    </>
  )
}

/* ─── Helpers ─── */

function DashField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white">{label}</label>
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
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-sm text-white/60">{label}</dt>
      <dd className="text-sm text-white">{value}</dd>
    </div>
  )
}
