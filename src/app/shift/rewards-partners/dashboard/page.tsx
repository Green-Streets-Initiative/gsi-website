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
  notes: string | null
}

type Reward = {
  id: string
  name: string
  description: string | null
  redemption_frequency: string | null
}

export default function DashboardPageWrapper() {
  return (
    <Suspense fallback={
      <>
        <Nav />
        <main style={{ paddingTop: '60px' }} className="flex min-h-screen items-center justify-center bg-[#191A2E]">
          <div className="text-white/50">Loading&hellip;</div>
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

  const fetchData = useCallback(async (email: string) => {
    const { data: sponsorData } = await supabase
      .from('sponsors')
      .select('id, name, status, contact_name, contact_email, contact_phone, address, website_url, notes')
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

    const { data: rewardData } = await supabase
      .from('rewards')
      .select('id, name, description, redemption_frequency')
      .eq('sponsor_id', sponsorData.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (rewardData) {
      setReward(rewardData)
      setOfferDesc(rewardData.name || '')
      setOfferLimits(rewardData.description || '')
      setOfferFrequency(rewardData.redemption_frequency || '')
    }

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
    await supabase
      .from('sponsors')
      .update({
        contact_name: contactForm.contact_name.trim(),
        contact_phone: contactForm.contact_phone.trim() || null,
        address: contactForm.address.trim(),
        website_url: contactForm.website_url.trim() || null,
      })
      .eq('id', sponsor.id)

    setSponsor({
      ...sponsor,
      contact_name: contactForm.contact_name.trim(),
      contact_phone: contactForm.contact_phone.trim() || null,
      address: contactForm.address.trim(),
      website_url: contactForm.website_url.trim() || null,
    })
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
          <div className="text-white/50">Loading&hellip;</div>
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
                    : 'bg-white/10 text-white/50'
                }`}
              >
                {sponsor.status === 'active' ? 'Active' : 'Paused'}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              Sign out
            </button>
          </div>

          {/* Current offer */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">Current offer</h2>

            {!reward ? (
              <p className="text-[0.9375rem] text-white/50">
                Your offer is under review. We&apos;ll notify you when it&apos;s live in the catalog.
              </p>
            ) : editingOffer ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">
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
                  <div className="mt-1 text-right text-xs text-white/50">
                    {offerDesc.length}/200
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">
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
                  <label className="mb-1.5 block text-sm font-medium text-white/70">
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
                    className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-1 text-[0.9375rem] font-medium text-white/80">{reward.name}</p>
                {reward.description && (
                  <p className="text-sm text-white/45">{reward.description}</p>
                )}
                <p className="mt-1 text-sm text-white/45">
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
                  className="mt-4 rounded-full border border-white/[0.12] px-5 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
                >
                  Edit offer
                </button>
              </div>
            )}
          </section>

          {/* Contact & business info */}
          <section className="mb-8 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
            <h2 className="mb-5 font-display text-base font-bold text-white">
              Contact &amp; business info
            </h2>

            {editingContact ? (
              <div className="space-y-4">
                <DashField
                  label="Contact name"
                  value={contactForm.contact_name}
                  onChange={(v) => setContactForm({ ...contactForm, contact_name: v })}
                />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[0.9375rem] text-white/40 outline-none"
                  />
                  <p className="mt-1 text-xs text-white/50">
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
                      setEditingContact(false)
                    }}
                    className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <dl className="space-y-3">
                  <InfoRow label="Name" value={sponsor.contact_name} />
                  <InfoRow label="Email" value={sponsor.contact_email} />
                  <InfoRow label="Phone" value={sponsor.contact_phone || '—'} />
                  <InfoRow label="Address" value={sponsor.address} />
                  <InfoRow label="Website" value={sponsor.website_url || '—'} />
                </dl>
                <button
                  onClick={() => setEditingContact(true)}
                  className="mt-5 rounded-full border border-white/[0.12] px-5 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
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
                  className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:text-white disabled:opacity-40"
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
                <p className="mb-4 text-sm text-white/50">
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
              <p className="mb-6 text-sm leading-relaxed text-white/55">
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
                  className="rounded-full border border-white/[0.12] px-5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
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
      <label className="mb-1.5 block text-sm font-medium text-white/70">{label}</label>
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
      <dt className="w-20 shrink-0 text-sm text-white/40">{label}</dt>
      <dd className="text-sm text-white/75">{value}</dd>
    </div>
  )
}
