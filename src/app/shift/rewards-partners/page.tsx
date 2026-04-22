'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'
import AddressAutocomplete from '@/components/AddressAutocomplete'

type Sponsor = {
  name: string
  logo_url: string | null
  website_url: string | null
}

type FormData = {
  // 'rewards' = partner offers a discount; 'community' = cross-promotion only.
  // Selected at the very top of the form to pre-empt the "you want me to give
  // a discount?" objection. Drives whether the discount step is required.
  partner_kind: 'rewards' | 'community'
  business_name: string
  address: string
  city: string
  address_line1: string
  address_state: string
  address_zip: string
  website_url: string
  referral_source: string
  referral_source_other: string
  discount_description: string
  discount_type: string
  discount_value: string
  redemption_limit: string
  channel: 'in_store' | 'online' | 'both'
  discount_code: string
  contact_name: string
  signer_title: string
  contact_email: string
  contact_phone: string
  signer_name: string
  agreement_accepted: boolean
  sticker_requested: boolean
  location_lat: number | null
  location_lng: number | null
}

const INITIAL_FORM: FormData = {
  partner_kind: 'rewards',
  business_name: '',
  address: '',
  city: '',
  address_line1: '',
  address_state: 'MA',
  address_zip: '',
  website_url: '',
  referral_source: '',
  referral_source_other: '',
  discount_description: '',
  discount_type: '',
  discount_value: '',
  redemption_limit: 'none',
  channel: 'in_store',
  discount_code: '',
  contact_name: '',
  signer_title: '',
  contact_email: '',
  contact_phone: '',
  signer_name: '',
  agreement_accepted: false,
  sticker_requested: false,
  location_lat: null,
  location_lng: null,
}

const AGREEMENT_YEAR = new Date().getFullYear()

const PARTICIPATION_IN_STORE = `Partner agrees to honor the discount described in this application ("the Discount") to Shift app users who present a valid, animated tier badge on their device. The Shift app displays a live, dynamic verification screen (not a static image or screenshot) that confirms the user's active commuter status.`

const PARTICIPATION_ONLINE = `Partner agrees to honor the discount code described in this application ("the Discount") for Shift app users who enter it at checkout on Partner's website. The discount code will be visible only to qualifying Shift users within the app.`

const PARTICIPATION_BOTH = `${PARTICIPATION_IN_STORE}

Partner also agrees to honor the discount code described in this application for Shift app users who enter it at checkout on Partner's website. The discount code will be visible only to qualifying Shift users within the app.`

function getAgreementText(
  channel: 'in_store' | 'online' | 'both',
  partnerKind: 'rewards' | 'community' = 'rewards',
) {
  if (partnerKind === 'community') {
    return `Shift Community Partner Agreement
Green Streets Initiative — ${AGREEMENT_YEAR}

By submitting this application, you ("Partner") agree to the following terms with Green Streets Initiative ("GSI"), a 501(c)(3) nonprofit organization based in Cambridge, Massachusetts.

1. Program participation
Partner agrees to be listed as a Community Partner in the Shift app's partner directory. Partner's name, logo, and any provided description will be visible to Shift app users. No discount or other consideration is required from Partner. In return, Partner agrees to cross-promote Shift to its customers and community (e.g., displaying the provided window sticker, mentioning Shift in newsletters or social media when convenient).

2. Listing terms
Partner may pause or end its listing at any time via the partner dashboard or by contacting GSI. Partner is responsible for the accuracy of its listing details (name, logo, description) and may update them at any time.

3. No cost to Partner
Participation in the Shift community partner network is free. GSI does not charge Partner for listing or impressions.

4. GSI's role
GSI operates the Shift app and partner directory. GSI does not guarantee any minimum number of impressions or user visits to Partner's location. GSI may remove any Partner listing that violates these terms or that GSI determines is inconsistent with its mission.

5. Termination
Either party may end this agreement at any time. Partner may pause or end their listing via the partner dashboard. GSI may remove a listing with written notice to Partner's contact email.

6. No exclusivity
This agreement does not create an exclusive relationship. GSI may partner with other businesses in Partner's category or neighborhood.

7. Governing law
This agreement is governed by the laws of the Commonwealth of Massachusetts.

By checking the box below, you confirm that you are authorized to enter into this agreement on behalf of the business named in this application, and that you have read and agree to these terms.`
  }

  const participation = channel === 'online' ? PARTICIPATION_ONLINE : channel === 'both' ? PARTICIPATION_BOTH : PARTICIPATION_IN_STORE
  return `Shift Rewards Partner Agreement
Green Streets Initiative — ${AGREEMENT_YEAR}

By submitting this application, you ("Partner") agree to the following terms with Green Streets Initiative ("GSI"), a 501(c)(3) nonprofit organization based in Cambridge, Massachusetts.

1. Program participation
${participation} GSI will list the Discount in the Shift partner directory once this application is reviewed and approved.

2. Discount terms
Partner may discontinue the Discount at any time by contacting GSI.${channel !== 'in_store' ? ' Partner may change the discount code at any time by contacting GSI.' : ''} GSI is not responsible for disputes between Partner and customers regarding Discount usage. Partner may update the Discount details via the partner dashboard.

3. No cost to Partner
Participation in the Shift rewards network is free. GSI does not charge Partner for listing, impressions, or redemptions.

4. GSI's role
GSI operates the Shift app and rewards catalog. GSI does not guarantee any minimum number of redemptions or user visits to Partner's ${channel === 'online' ? 'website' : 'location'}. GSI may remove any Partner listing that violates these terms or that GSI determines is inconsistent with its mission.

5. Data and reporting
GSI will provide Partner with monthly reports showing aggregate redemption counts and Shift user reach. GSI does not share individual user data with Partners.

6. Termination
Either party may end this agreement at any time. Partner may pause or end their listing via the partner dashboard. GSI may remove a listing with written notice to Partner's contact email.

7. No exclusivity
This agreement does not create an exclusive relationship. GSI may partner with other businesses in Partner's category or neighborhood.

8. Governing law
This agreement is governed by the laws of the Commonwealth of Massachusetts.

By checking the box below, you confirm that you are authorized to enter into this agreement on behalf of the business named in this application, and that you have read and agree to these terms.`
}

export default function RewardsPartnersPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const formRef = useRef<HTMLDivElement>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoError, setLogoError] = useState('')
  const [logoUploadFailed, setLogoUploadFailed] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginSent, setLoginSent] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    async function fetchSponsors() {
      const { data } = await supabase
        .from('sponsors')
        .select('name, logo_url, website_url')
        .eq('status', 'active')
        .in('sponsor_type', ['community_reward', 'local', 'merchant_partner'])
        .order('agreement_signed_at', { ascending: true })
      if (data) setSponsors(data)
    }
    fetchSponsors()
  }, [])

  function goToStep(s: number) {
    setStep(s)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const [descriptionManuallyEdited, setDescriptionManuallyEdited] = useState(false)

  function update(field: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Auto-generate discount description from type + value
  function generateDescription(type: string, value: string): string {
    if (type === 'percentage' && value) return `${value}% off`
    if (type === 'fixed_amount' && value) return `$${value} off`
    if (type === 'freebie') return 'Free '
    return ''
  }

  function updateDiscountType(type: string) {
    setForm(prev => {
      const desc = descriptionManuallyEdited ? prev.discount_description : generateDescription(type, prev.discount_value)
      return { ...prev, discount_type: type, discount_description: desc }
    })
  }

  function updateDiscountValue(value: string) {
    setForm(prev => {
      const desc = descriptionManuallyEdited ? prev.discount_description : generateDescription(prev.discount_type, value)
      return { ...prev, discount_value: value, discount_description: desc }
    })
  }

  function isStep1Valid() {
    return form.business_name.trim() && form.address.trim() && form.city.trim() && form.address_state.trim() && form.address_zip.trim()
  }

  function isStep2Valid() {
    const isCommunity = form.partner_kind === 'community'
    // Discount fields are required for Rewards Partners only.
    const hasDiscount = isCommunity || (form.discount_description.trim() && form.discount_type)
    const hasValueIfNeeded =
      isCommunity ||
      form.discount_type === 'freebie' ||
      form.discount_type === 'custom' ||
      (form.discount_value && Number(form.discount_value) > 0)
    const isOnline = !isCommunity && (form.channel === 'online' || form.channel === 'both')
    const hasOnlineFields = !isOnline || (form.discount_code.trim() && form.website_url.trim())
    return (
      hasDiscount &&
      hasValueIfNeeded &&
      hasOnlineFields &&
      form.contact_name.trim() &&
      form.signer_title.trim() &&
      form.contact_email.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)
    )
  }

  function isStep3Valid() {
    return form.signer_name.trim() && form.agreement_accepted
  }

  async function handleSubmit() {
    if (!isStep3Valid()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      let logoPath: string | null = null

      if (logoFile) {
        const sanitizedName = form.business_name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        const ext = (logoFile.name.split('.').pop() || 'png').toLowerCase()
        logoPath = `logos/${Date.now()}-${sanitizedName}.${ext}`

        // Browsers often report wrong MIME types (e.g. SVG as application/xml)
        const mimeMap: Record<string, string> = {
          svg: 'image/svg+xml',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          webp: 'image/webp',
        }
        const contentType = mimeMap[ext] || logoFile.type

        // Use a fresh anon client for the upload to avoid stale session
        // tokens from the partner dashboard overriding the anon role
        const { createClient } = await import('@supabase/supabase-js')
        const anonClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false } },
        )
        const { error: uploadError } = await anonClient.storage
          .from('sponsor-logos')
          .upload(logoPath, logoFile, { contentType })

        if (uploadError) {
          console.error('Logo upload error:', uploadError)
          // Don't block submission — logo can be added later by admin
          logoPath = null
          setLogoUploadFailed(true)
        }
      }

      const res = await fetch(
        'https://xyqcpgwbqrhykpgpqbdi.supabase.co/functions/v1/sponsor-intake',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            partner_kind: form.partner_kind,
            business_name: form.business_name.trim(),
            address: `${(form.address_line1 || form.address).trim()}, ${form.city.trim()}, ${form.address_state.trim()} ${form.address_zip.trim()}`,
            city: form.city.trim(),
            address_line1: form.address_line1 || form.address.trim(),
            address_state: form.address_state.trim() || null,
            address_zip: form.address_zip.trim() || null,
            contact_name: form.contact_name.trim(),
            contact_email: form.contact_email.trim(),
            contact_phone: form.contact_phone.trim() || null,
            // Discount fields — null for Community Partners (cross-promotion only).
            discount_description: form.partner_kind === 'community' ? null : form.discount_description.trim(),
            discount_type: form.partner_kind === 'community' ? null : (form.discount_type || null),
            discount_value: form.partner_kind === 'community' ? null : (form.discount_value ? Number(form.discount_value) : null),
            preferred_minimum_tier: 'mover',
            redemption_limit: form.partner_kind === 'community' ? 'none' : (form.redemption_limit || 'none'),
            channel: form.channel,
            discount_code: form.partner_kind === 'community' ? null : (form.discount_code.trim() || null),
            redemption_url: form.website_url.trim() || null,
            // Legacy field — map discount_description for backward compat. The
            // sponsor-intake function rejects empty offer_description, so for
            // community partners we send a sentinel describing the partnership.
            offer_description: form.partner_kind === 'community'
              ? 'Community Partner — cross-promotion (no discount)'
              : form.discount_description.trim(),
            referral_source:
              form.referral_source === 'Other' && form.referral_source_other.trim()
                ? `Other: ${form.referral_source_other.trim()}`
                : form.referral_source.trim() || null,
            signer_name: form.signer_name.trim(),
            signer_title: form.signer_title.trim(),
            agreement_accepted: true,
            website_url: form.website_url.trim() || null,
            logo_url: getLogoUrl(logoPath),
            sticker_requested: form.sticker_requested,
            sticker_requested_at: form.sticker_requested ? new Date().toISOString() : null,
            location_lat: form.location_lat,
            location_lng: form.location_lng,
          }),
        }
      )
      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Submit failed')
      }
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(
        err?.message && err.message !== 'Submit failed'
          ? err.message
          : 'Something went wrong — please try again or email us at info@gogreenstreets.org.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginEmail.trim()) return
    setLoginLoading(true)

    try {
      const res = await fetch(
        'https://xyqcpgwbqrhykpgpqbdi.supabase.co/functions/v1/sponsor-magic-link',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: loginEmail.trim(),
            redirect_to: `${window.location.origin}/shift/rewards-partners/dashboard`,
          }),
        }
      )
      if (!res.ok) {
        console.error('Magic link request failed:', res.status)
      }
    } catch (err) {
      console.error('Magic link request error:', err)
    }

    setLoginSent(true)
    setLoginLoading(false)
  }

  function getLogoUrl(logoPath: string | null) {
    if (!logoPath) return null
    if (logoPath.startsWith('http')) return logoPath
    return supabase.storage.from('sponsor-logos').getPublicUrl(logoPath).data.publicUrl
  }

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ═══════════════════════════════════════════════════════
            1 · HERO
        ═══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(186,241,77,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(186,241,77,0.03) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <div className="absolute -right-[10%] top-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(186,241,77,0.07)_0%,transparent_70%)]" />
          </div>

          <div className="relative mx-auto max-w-[1120px]">
            <div className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              For local businesses
            </div>

            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Reach active commuters in your neighborhood.
            </h1>

            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#BAF14D]/30 bg-[#BAF14D]/[0.08] px-4 py-1.5 text-sm font-semibold text-[#BAF14D]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#BAF14D]" />
              Free to join &middot; No fees &middot; No contracts
            </div>

            <p className="mb-12 max-w-[620px] text-lg leading-[1.7] text-white">
              Join the Shift rewards network — put your business in front of people who walk, bike, and ride transit every day. No POS integration. No complicated setup.
            </p>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: 'Visibility where it counts',
                  desc: 'Your business appears in the Shift rewards catalog, surfaced to active commuters near you.',
                },
                {
                  title: 'Foot traffic that\u2019s earned',
                  desc: 'Shift users show a badge on their phone to get your discount. They\u2019re motivated, local, and regular.',
                },
                {
                  title: 'Monthly impact reports',
                  desc: 'See how many Shift users redeemed offers at your location each month, with neighborhood-level reach data.',
                },
                {
                  title: 'Self-service dashboard',
                  desc: 'Edit your offer, view redemption history, and pause or resume your listing anytime — all from a dedicated partner dashboard.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-6"
                >
                  <h3 className="mb-2 font-display text-sm font-bold text-[#BAF14D]">
                    {item.title}
                  </h3>
                  <p className="text-[0.875rem] leading-[1.6] text-white">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <a
                href="#apply"
                className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
              >
                Become a rewards partner &rarr;
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            2 · CURRENT PARTNERS
        ═══════════════════════════════════════════════════════ */}
        {sponsors.length >= 5 ? (
          <section className="bg-[#F4F8EE] px-8 py-24">
            <div className="mx-auto max-w-[1120px]">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7DB82E]">
                Our network
              </div>
              <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-[#191A2E]">
                Who&apos;s already in the network
              </h2>
              <p className="mb-12 max-w-[560px] text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
                These businesses offer rewards to Shift users across Massachusetts.
              </p>

              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {sponsors.map((sponsor) => {
                  const logo = getLogoUrl(sponsor.logo_url)
                  const Wrapper = sponsor.website_url ? 'a' : 'div'
                  const wrapperProps = sponsor.website_url
                    ? { href: sponsor.website_url, target: '_blank' as const, rel: 'noopener noreferrer' }
                    : {}

                  return (
                    <Wrapper
                      key={sponsor.name}
                      {...wrapperProps}
                      className="flex flex-col items-center gap-3 rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-5 transition-shadow hover:shadow-md"
                    >
                      {logo ? (
                        <div className="flex h-16 w-full items-center justify-center">
                          <img
                            src={logo}
                            alt={sponsor.name}
                            className="max-h-16 max-w-full rounded-lg object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.parentElement!.innerHTML = `<div class="flex h-16 w-16 items-center justify-center rounded-lg" style="background:rgba(25,26,46,0.06)"><span class="text-center font-bold text-xs" style="color:rgba(25,26,46,0.6)">${sponsor.name.slice(0, 2).toUpperCase()}</span></div>`
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[#191A2E]/[0.06]">
                          <span className="text-center font-display text-xs font-bold leading-tight text-[#191A2E]/60">
                            {sponsor.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-center text-xs font-medium text-[#4A4D68]">
                        {sponsor.name}
                      </span>
                    </Wrapper>
                  )
                })}
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-[#F4F8EE] px-8 py-24">
            <div className="mx-auto max-w-[1120px]">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7DB82E]">
                Our network
              </div>
              <h2 className="mb-4 max-w-[720px] font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-[#191A2E]">
                Launching across Greater Boston
              </h2>
              <p className="max-w-[620px] text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
                Rewards Partners in Somerville, Cambridge, Arlington, Medford, Boston, and growing. Join the first wave of businesses supporting active commuters in your neighborhood.
              </p>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════
            3 · HOW IT WORKS
        ═══════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              How it works
            </div>
            <h2 className="mb-14 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Three simple steps
            </h2>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  num: '1',
                  title: 'Apply online',
                  desc: 'Fill out the short application below. Tell us about your business and the offer you\u2019d like to make to Shift users.',
                },
                {
                  num: '2',
                  title: 'We review and confirm',
                  desc: 'A GSI team member reviews your application, confirms the details, and sets up your listing in the rewards catalog. We\u2019ll be in touch within a few business days.',
                },
                {
                  num: '3',
                  title: 'Users come in',
                  desc: 'Shift users see your discount in the app and show an animated badge on their phone. Your staff glances at it to confirm it\u2019s live and applies the discount. No scanning, no codes, no app on your end.',
                },
              ].map((s) => (
                <div
                  key={s.num}
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D]/15 font-display text-sm font-extrabold text-[#BAF14D]">
                    {s.num}
                  </div>
                  <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                    {s.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.6] text-white">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            4 · INTAKE FORM
        ═══════════════════════════════════════════════════════ */}
        <section id="apply" className="bg-[#F4F8EE] px-8 py-24">
          <div ref={formRef} className="mx-auto max-w-[640px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7DB82E]">
              Apply
            </div>
            <h2 className="mb-2 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-[#191A2E]">
              Apply to join the network
            </h2>
            <p className="mb-10 text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
              Takes about 2 minutes. Free to participate.
            </p>

            {submitted ? (
              <div className="rounded-[18px] border border-[rgba(186,241,77,0.25)] bg-[rgba(186,241,77,0.08)] p-8 text-center">
                <div className="mb-3 text-3xl">&#10003;</div>
                <h3 className="mb-2 font-display text-xl font-bold text-[#191A2E]">
                  Thanks, {form.business_name}!
                </h3>
                <p className="text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
                  We&apos;ll review your application and be in touch within a few business days.
                  Check your email — we&apos;ll send a confirmation and a link to your partner
                  dashboard once you&apos;re approved.
                </p>
                {logoUploadFailed && (
                  <p className="mt-4 rounded-lg border border-[#E05252]/20 bg-[#E05252]/5 px-4 py-3 text-sm text-[#E05252]">
                    Your logo couldn&apos;t be uploaded. You can add it later from your partner
                    dashboard, or email it to{' '}
                    <a href="mailto:info@gogreenstreets.org" className="underline">info@gogreenstreets.org</a>.
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Step indicator */}
                <div className="mb-8 flex items-center gap-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          s === step
                            ? 'bg-[#BAF14D] text-[#191A2E]'
                            : s < step
                              ? 'bg-[#191A2E] text-white'
                              : 'bg-[#191A2E]/10 text-[#191A2E]/40'
                        }`}
                      >
                        {s < step ? '\u2713' : s}
                      </div>
                      {s < 3 && (
                        <div
                          className={`h-0.5 w-8 rounded-full ${
                            s < step ? 'bg-[#191A2E]' : 'bg-[#191A2E]/10'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                  <span className="ml-3 text-sm font-medium text-[#4A4D68]">
                    Step {step} of 3
                  </span>
                </div>

                {/* Step 1 — Your business */}
                {step === 1 && (
                  <div className="space-y-5">
                    {/* Partnership type — first decision, framed positively */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#191A2E]">
                        How would you like to partner with Shift?
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => update('partner_kind', 'rewards')}
                          className={`rounded-xl border-2 p-4 text-left transition ${
                            form.partner_kind === 'rewards'
                              ? 'border-[#191A2E] bg-[#191A2E]/[0.04]'
                              : 'border-[rgba(25,26,46,0.12)] bg-white hover:border-[rgba(25,26,46,0.3)]'
                          }`}
                        >
                          <div className="text-sm font-semibold text-[#191A2E]">
                            Rewards Partner
                          </div>
                          <p className="mt-1 text-xs text-[#4A4D68]">
                            Offer a discount to Shift users (any size, your call) — we feature your offer in the rewards directory.
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => update('partner_kind', 'community')}
                          className={`rounded-xl border-2 p-4 text-left transition ${
                            form.partner_kind === 'community'
                              ? 'border-[#191A2E] bg-[#191A2E]/[0.04]'
                              : 'border-[rgba(25,26,46,0.12)] bg-white hover:border-[rgba(25,26,46,0.3)]'
                          }`}
                        >
                          <div className="text-sm font-semibold text-[#191A2E]">
                            Community Partner
                          </div>
                          <p className="mt-1 text-xs text-[#4A4D68]">
                            No discount — we cross-promote your business in the app, you cross-promote Shift to your customers.
                          </p>
                        </button>
                      </div>
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#191A2E]">
                      Your business
                    </h3>
                    <Field
                      label="Business name"
                      required
                      value={form.business_name}
                      onChange={(v) => update('business_name', v)}
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                        Business logo
                      </label>
                      <div className="flex items-center gap-4">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="h-16 w-16 rounded-xl border border-[rgba(25,26,46,0.12)] object-contain"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-[rgba(25,26,46,0.2)] bg-white text-[#8A8DA8]">
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                            </svg>
                          </div>
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
                                  setLogoFile(null)
                                  setLogoPreview(null)
                                  e.target.value = ''
                                  return
                                }
                                if (!allowedTypes.includes(file.type)) {
                                  setLogoError('Logo must be a PNG, JPG, SVG, or WebP file')
                                  setLogoFile(null)
                                  setLogoPreview(null)
                                  e.target.value = ''
                                  return
                                }
                                setLogoError('')
                                setLogoFile(file)
                                setLogoPreview(URL.createObjectURL(file))
                              } else {
                                setLogoFile(null)
                                setLogoPreview(null)
                              }
                            }}
                            className="w-full text-sm text-[#4A4D68] file:mr-3 file:rounded-full file:border-0 file:bg-[#191A2E]/[0.06] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#191A2E] file:cursor-pointer hover:file:bg-[#191A2E]/[0.1]"
                          />
                          {logoFile && (
                            <button
                              type="button"
                              onClick={() => {
                                setLogoFile(null)
                                setLogoPreview(null)
                              }}
                              className="mt-1 text-xs text-[#8A8DA8] underline hover:text-[#4A4D68]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      {logoError && (
                        <p className="mt-1.5 text-xs font-medium text-[#E05252]">{logoError}</p>
                      )}
                      <p className="mt-1.5 text-xs text-[#8A8DA8]">
                        Optional — square images work best. Max 5 MB.
                      </p>
                    </div>
                    <AddressAutocomplete
                      value={form.address}
                      onChange={(v) => update('address', v)}
                      label="Street address"
                      placeholder="Start typing or enter manually"
                      onCityDetected={(city) => update('city', city)}
                      onAddressParsed={(parsed) => {
                        setForm(prev => ({
                          ...prev,
                          address_line1: parsed.line1,
                          city: parsed.city || prev.city,
                          address_state: parsed.state || prev.address_state,
                          address_zip: parsed.zip || prev.address_zip,
                        }))
                      }}
                      onPlaceSelected={(place) => {
                        setForm(prev => ({
                          ...prev,
                          location_lat: place.lat,
                          location_lng: place.lng,
                        }))
                      }}
                    />
                    <Field
                      label="City"
                      required
                      value={form.city}
                      onChange={(v) => update('city', v)}
                      autoComplete="address-level2"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Field
                        label="State"
                        required
                        value={form.address_state}
                        onChange={(v) => update('address_state', v)}
                        autoComplete="address-level1"
                      />
                      <Field
                        label="ZIP code"
                        required
                        value={form.address_zip}
                        onChange={(v) => update('address_zip', v)}
                        autoComplete="postal-code"
                      />
                    </div>
                    <Field
                      label="Business website"
                      value={form.website_url}
                      onChange={(v) => update('website_url', v)}
                      placeholder="https://"
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                        How did you hear about Shift?
                      </label>
                      <select
                        value={form.referral_source}
                        onChange={(e) => update('referral_source', e.target.value)}
                        className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors focus:border-[#BAF14D]"
                      >
                        <option value="">Select one (optional)</option>
                        <option value="Email from Green Streets">Email from Green Streets</option>
                        <option value="Another business owner">Another business owner</option>
                        <option value="Social media">Social media</option>
                        <option value="Community event">Community event</option>
                        <option value="AI assistant">AI assistant (ChatGPT, Claude, etc.)</option>
                        <option value="Other">Other</option>
                      </select>
                      {form.referral_source === 'Other' && (
                        <input
                          type="text"
                          value={form.referral_source_other}
                          onChange={(e) => update('referral_source_other', e.target.value)}
                          placeholder="Please specify"
                          maxLength={120}
                          className="mt-2 w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors focus:border-[#BAF14D]"
                        />
                      )}
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[rgba(25,26,46,0.08)] bg-[rgba(25,26,46,0.03)] p-4">
                      <input
                        type="checkbox"
                        checked={form.sticker_requested}
                        onChange={(e) => update('sticker_requested', e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-[#191A2E]"
                      />
                      <div>
                        <span className="text-sm font-medium text-[#191A2E]">
                          Send me a free Shift partner window sticker
                        </span>
                        <p className="mt-0.5 text-xs text-[#8A8DA8]">
                          Display in your storefront to let customers know you offer Shift discounts.
                          Shipped within 5&ndash;7 business days.
                        </p>
                      </div>
                    </label>
                    <button
                      onClick={() => goToStep(2)}
                      disabled={!isStep1Valid()}
                      className="mt-4 rounded-full bg-[#191A2E] px-7 py-3 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Continue &rarr;
                    </button>
                  </div>
                )}

                {/* Step 2 — Your discount (or listing details for Community Partners) */}
                {step === 2 && (
                  <div className="space-y-5">
                    <h3 className="font-display text-lg font-bold text-[#191A2E]">
                      {form.partner_kind === 'community' ? 'Your listing' : 'Your discount'}
                    </h3>
                    {form.partner_kind === 'community' ? (
                      <div className="rounded-xl border border-[#BAF14D]/40 bg-[#BAF14D]/10 p-4 text-[0.9375rem] leading-[1.6] text-[#191A2E]">
                        <strong>You&apos;re joining as a Community Partner.</strong>{' '}
                        No discount required — just your contact info below. We&apos;ll
                        cross-promote your business in the Shift app.
                      </div>
                    ) : (
                    <p className="text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
                      Tell us what discount you&apos;d like to offer Shift users. Keep it simple
                      and specific — &ldquo;10% off any purchase&rdquo; or &ldquo;Free cookie with
                      any coffee order&rdquo; work well.
                    </p>
                    )}

                    {form.partner_kind === 'rewards' && (
                    <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                        Discount type <span className="text-[#E05252]">*</span>
                      </label>
                      <select
                        value={form.discount_type}
                        onChange={(e) => updateDiscountType(e.target.value)}
                        className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors focus:border-[#BAF14D]"
                      >
                        <option value="">Select a type</option>
                        <option value="percentage">Percentage off</option>
                        <option value="fixed_amount">Dollar amount off</option>
                        <option value="freebie">Free item</option>
                        <option value="custom">Other</option>
                      </select>
                    </div>

                    {(form.discount_type === 'percentage' || form.discount_type === 'fixed_amount') && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                          {form.discount_type === 'percentage' ? 'Percentage' : 'Dollar amount'}{' '}
                          <span className="text-[#E05252]">*</span>
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8DA8]">
                            {form.discount_type === 'percentage' ? '%' : '$'}
                          </span>
                          <input
                            type="number"
                            min="1"
                            step={form.discount_type === 'fixed_amount' ? '0.01' : '1'}
                            value={form.discount_value}
                            onChange={(e) => updateDiscountValue(e.target.value)}
                            placeholder={form.discount_type === 'percentage' ? '10' : '1.00'}
                            className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white py-3 pl-10 pr-4 text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#8A8DA8] focus:border-[#BAF14D]"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                        Describe the discount <span className="text-[#E05252]">*</span>
                      </label>
                      <textarea
                        value={form.discount_description}
                        onChange={(e) => {
                          if (e.target.value.length <= 200) {
                            setDescriptionManuallyEdited(true)
                            update('discount_description', e.target.value)
                          }
                        }}
                        maxLength={200}
                        rows={2}
                        placeholder={
                          form.discount_type === 'freebie' ? 'e.g. Free cookie with any purchase' :
                          form.discount_type === 'custom' ? 'e.g. Buy one get one free' :
                          'e.g. 10% off all drinks'
                        }
                        className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#8A8DA8] focus:border-[#BAF14D]"
                      />
                      <p className="mt-1 text-xs text-[#8A8DA8]">
                        This is exactly what Shift users will see. Add details like &ldquo;on all drinks&rdquo; or &ldquo;with any food order.&rdquo;
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                        Redemption limit
                      </label>
                      <select
                        value={form.redemption_limit}
                        onChange={(e) => update('redemption_limit', e.target.value)}
                        className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors focus:border-[#BAF14D]"
                      >
                        <option value="none">No limit</option>
                        <option value="once_per_visit">Once per visit</option>
                        <option value="once_per_day">Once per day</option>
                        <option value="once_per_week">Once per week</option>
                        <option value="once_per_month">Once per month</option>
                      </select>
                      <p className="mt-1 text-xs text-[#8A8DA8]">
                        This will be shown to Shift users alongside your discount.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                        Where do customers redeem? <span className="text-[#E05252]">*</span>
                      </label>
                      <select
                        value={form.channel}
                        onChange={(e) => update('channel', e.target.value)}
                        className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors focus:border-[#BAF14D]"
                      >
                        <option value="in_store">In my store or location</option>
                        <option value="online">On my website</option>
                        <option value="both">Both in-store and online</option>
                      </select>
                      <p className="mt-1 text-xs text-[#8A8DA8]">
                        {form.channel === 'in_store'
                          ? 'Customers will show an animated badge on their phone at checkout.'
                          : form.channel === 'online'
                            ? 'Customers will enter a discount code at checkout on your website.'
                            : 'Customers can show a badge in-store or use a code online.'}
                      </p>
                    </div>

                    {(form.channel === 'online' || form.channel === 'both') && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                            Discount code <span className="text-[#E05252]">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.discount_code}
                            onChange={(e) => update('discount_code', e.target.value.toUpperCase())}
                            placeholder="e.g. SHIFT10"
                            className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 font-mono text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#8A8DA8] focus:border-[#BAF14D]"
                          />
                          <p className="mt-1 text-xs text-[#8A8DA8]">
                            The promo code Shift users will enter at checkout on your website.
                          </p>
                        </div>

                        {!form.website_url && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-sm text-amber-800">
                              <strong>Website URL required.</strong> Go back to step 1 and enter your website address so we can link Shift users to your store.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    </>
                    )}

                    <div className="border-t border-[rgba(25,26,46,0.09)] pt-5">
                      <h4 className="mb-4 font-display text-sm font-bold text-[#191A2E]">
                        Contact info
                      </h4>
                      <div className="space-y-5">
                        <Field
                          label="Your name"
                          required
                          value={form.contact_name}
                          onChange={(v) => update('contact_name', v)}
                        />
                        <Field
                          label="Your title"
                          required
                          value={form.signer_title}
                          onChange={(v) => update('signer_title', v)}
                        />
                        <div>
                          <Field
                            label="Email address"
                            required
                            type="email"
                            value={form.contact_email}
                            onChange={(v) => update('contact_email', v)}
                          />
                          <p className="mt-1 text-xs text-[#8A8DA8]">
                            We&apos;ll use this to send you a login link to manage your listing.
                          </p>
                        </div>
                        <Field
                          label="Phone number"
                          value={form.contact_phone}
                          onChange={(v) => update('contact_phone', v)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => goToStep(1)}
                        className="rounded-full border border-[rgba(25,26,46,0.15)] px-6 py-3 text-sm font-semibold text-[#191A2E] transition-colors hover:bg-[#191A2E]/5"
                      >
                        &larr; Back
                      </button>
                      <button
                        onClick={() => goToStep(3)}
                        disabled={!isStep2Valid()}
                        className="rounded-full bg-[#191A2E] px-7 py-3 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Continue &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3 — Agreement */}
                {step === 3 && (
                  <div className="space-y-5">
                    <h3 className="font-display text-lg font-bold text-[#191A2E]">
                      Agreement
                    </h3>

                    <div
                      className="max-h-[240px] overflow-y-scroll rounded-xl border border-[rgba(25,26,46,0.12)] bg-white p-5 text-[0.8125rem] leading-[1.7] text-[#4A4D68] whitespace-pre-line"
                      style={{ scrollbarWidth: 'auto' }}
                    >
                      {getAgreementText(form.channel, form.partner_kind)}
                    </div>

                    <Field
                      label="Legal name of signer"
                      required
                      value={form.signer_name}
                      onChange={(v) => update('signer_name', v)}
                    />

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.agreement_accepted}
                        onChange={(e) => update('agreement_accepted', e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-[rgba(25,26,46,0.2)] accent-[#BAF14D]"
                      />
                      <span className="text-sm leading-relaxed text-[#191A2E]">
                        I have read and agree to the Shift Rewards Partner Agreement
                      </span>
                    </label>

                    {submitError && (
                      <div className="rounded-xl border border-[#E05252]/20 bg-[#E05252]/5 px-4 py-3 text-sm text-[#E05252]">
                        {submitError}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => goToStep(2)}
                        className="rounded-full border border-[rgba(25,26,46,0.15)] px-6 py-3 text-sm font-semibold text-[#191A2E] transition-colors hover:bg-[#191A2E]/5"
                      >
                        &larr; Back
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!isStep3Valid() || submitting}
                        className="rounded-full bg-[#BAF14D] px-7 py-3 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Submitting\u2026' : 'Submit application'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            5 · EXISTING PARTNER LOGIN
        ═══════════════════════════════════════════════════════ */}
        <section id="partner-login" className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[480px] text-center">
            <h2 className="mb-2 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Already a rewards partner?
            </h2>
            <p className="mb-8 text-[0.9375rem] leading-[1.65] text-white">
              Log in to update your offer, edit your contact info, or manage your listing.
            </p>

            {loginSent ? (
              <div className="rounded-[18px] border border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.08)] p-6">
                <p className="text-sm text-white">
                  If that email is associated with a Shift rewards partner account, you&apos;ll
                  receive a login link shortly. Check your inbox.
                </p>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="you@yourbusiness.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="min-w-0 flex-1 rounded-full border border-white/[0.12] bg-white/[0.07] px-5 py-3 text-[0.9375rem] text-white outline-none placeholder:text-white/40 transition-colors focus:border-[#BAF14D]"
                />
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="shrink-0 rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  {loginLoading ? 'Sending\u2026' : 'Send login link'}
                </button>
              </form>
            )}
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}

/* ─── Reusable field component ─── */

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  autoComplete?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
        {label} {required && <span className="text-[#E05252]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#8A8DA8] focus:border-[#BAF14D]"
      />
    </div>
  )
}
