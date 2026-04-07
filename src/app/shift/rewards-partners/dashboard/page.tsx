'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'

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

function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sponsor, setSponsor] = useState<Sponsor | null>(null)
  const [reward, setReward] = useState<Reward | null>(null)
  const [userEmail, setUserEmail] = useState('')

  // Edit states
  const [editingOffer, setEditingOffer] = useState(false)
  const [offerDesc, setOfferDesc] = useState('')
  const [offerLimits, setOfferLimits] = useState('')
  const [offerFrequency, setOfferFrequency] = useState('')
  const [savingOffer, setSavingOffer] = useState(false)

  const [editingContact, setEditingContact] = useState(false)
  const [contactForm, setContactForm] = useState({
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

  const fetchData = useCallback(async (email: string) => {
    // Link sponsor to auth user (enables RLS for redemptions)
    await supabase.rpc('link_sponsor_on_login').catch(() => {})

    const { data: sponsorData } = await supabase
      .from('sponsors')
      .select('id, name, status, contact_name, contact_email, contact_phone, address, website_url, logo_url, notes')
      .eq('contact_email', email)
      .single()

    if (!sponsorData) {
      router.push('/shift/rewards-partners')
      return
    }

    setSponsor(sponsorData)
    setContactForm({
      contact_name: sponsorData.contact_name || '',
      contact_phone: sponsorData.contact_phone || '',
      address: sponsorData.address || '',
      website_url: sponsorData.website_url || '',
    })

    const [rewardRes, redemptionRes] = await Promise.all([
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
    ])

    if (rewardRes.data) {
      setReward(rewardRes.data)
      setOfferDesc(rewardRes.data.name || '')
      setOfferLimits(rewardRes.data.description || '')
      setOfferFrequency(rewardRes.data.redemption_frequency || '')
    }

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
      // Check for magic link token in URL (from custom sponsor-magic-link flow)
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
        // Clean URL after successful verification
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

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/shift/rewards-partners')
  }

  async function saveOffer() {
    if (!reward || !offerDesc.trim()) return
    setSavingOffer(true)
    await supabase
      .from('rewards')
      .update({
        name: offerDesc.trim(),
        description: offerLimits.trim() || null,
        redemption_frequency: offerFrequency || null,
      })
      .eq('id', reward.id)

    setReward({ ...reward, name: offerDesc.trim(), description: offerLimits.trim() || null, redemption_frequency: offerFrequency || null })
    setEditingOffer(false)
    setSavingOffer(false)
  }

  async function saveContact() {
    if (!sponsor) return
    setSavingContact(true)

    let newLogoUrl = sponsor.logo_url

    // Upload new logo if one was selected
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
        contact_name: contactForm.contact_name.trim(),
        contact_phone: contactForm.contact_phone.trim() || null,
        address: contactForm.address.trim(),
        website_url: contactForm.website_url.trim() || null,
        logo_url: newLogoUrl,
      })
      .eq('id', sponsor.id)

    setSponsor({
      ...sponsor,
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

          {/* Header */}
          <div className="mb-10 flex items-start justify-between">
            <div>
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
            <button
              onClick={handleSignOut}
              className="rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-white"
            >
              Sign out
            </button>
          </div>

          {/* Current offer */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">Current offer</h2>

            {!reward ? (
              <p className="text-[0.9375rem] text-white">
                Your offer is under review. We&apos;ll notify you when it&apos;s live in the catalog.
              </p>
            ) : editingOffer ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white">
                    Offer description
                  </label>
                  <textarea
                    value={offerDesc}
                    onChange={(e) => {
                      if (e.target.value.length <= 200) setOfferDesc(e.target.value)
                    }}
                    maxLength={200}
                    rows={3}
                    className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none placeholder:text-white/45 focus:border-[#BAF14D]"
                  />
                  <div className="mt-1 text-right text-xs text-white">
                    {offerDesc.length}/200
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white">
                    Offer limits
                  </label>
                  <input
                    type="text"
                    value={offerLimits}
                    onChange={(e) => setOfferLimits(e.target.value)}
                    placeholder="e.g. One per customer per week"
                    className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none placeholder:text-white/45 focus:border-[#BAF14D]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white">
                    Redemption frequency
                  </label>
                  <select
                    value={offerFrequency}
                    onChange={(e) => setOfferFrequency(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none focus:border-[#BAF14D]"
                  >
                    <option value="">No limit</option>
                    <option value="daily">Once per day</option>
                    <option value="weekly">Once per week</option>
                    <option value="monthly">Once per month</option>
                  </select>
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
                    onClick={() => {
                      setOfferDesc(reward.name || '')
                      setOfferLimits(reward.description || '')
                      setOfferFrequency(reward.redemption_frequency || '')
                      setEditingOffer(false)
                    }}
                    className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-1 text-[0.9375rem] font-medium text-white">{reward.name}</p>
                {reward.description && (
                  <p className="text-sm text-white">{reward.description}</p>
                )}
                <p className="mt-1 text-sm text-white">
                  Limit:{' '}
                  {reward.redemption_frequency === 'daily'
                    ? 'Once per day'
                    : reward.redemption_frequency === 'weekly'
                      ? 'Once per week'
                      : reward.redemption_frequency === 'monthly'
                        ? 'Once per month'
                        : 'None'}
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

          {/* Redemption activity */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              Redemption activity
            </h2>

            {/* Summary stats */}
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

            {/* Period toggle */}
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

            {/* Redemption table */}
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
                        <th className="pb-2 text-right text-xs font-medium text-white/50">Points</th>
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
                          <td className="py-2.5 text-right text-white/80">{r.points_spent}</td>
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

          {/* Contact & business info */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              Contact &amp; business info
            </h2>

            {editingContact ? (
              <div className="space-y-4">
                {/* Logo upload */}
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
                  <p className="mt-1 text-xs text-white">
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
                  <InfoRow label="Name" value={sponsor.contact_name} />
                  <InfoRow label="Email" value={sponsor.contact_email} />
                  <InfoRow label="Phone" value={sponsor.contact_phone || '—'} />
                  <InfoRow label="Address" value={sponsor.address} />
                  <InfoRow label="Website" value={sponsor.website_url || '—'} />
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

          {/* Partnership status */}
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
                <p className="mb-4 text-sm text-white">
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
              <p className="mb-6 text-sm leading-relaxed text-white">
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
      <dt className="w-20 shrink-0 text-sm text-white">{label}</dt>
      <dd className="text-sm text-white">{value}</dd>
    </div>
  )
}
