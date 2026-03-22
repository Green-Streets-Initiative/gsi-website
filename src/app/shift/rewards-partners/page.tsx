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
  business_name: string
  address: string
  city: string
  website_url: string
  referral_source: string
  offer_description: string
  redemption_frequency: string
  total_redemption_cap: string
  expiration_date: string
  contact_name: string
  signer_title: string
  contact_email: string
  contact_phone: string
  signer_name: string
  agreement_accepted: boolean
}

const INITIAL_FORM: FormData = {
  business_name: '',
  address: '',
  city: 'Cambridge',
  website_url: '',
  referral_source: '',
  offer_description: '',
  redemption_frequency: '',
  total_redemption_cap: '',
  expiration_date: '',
  contact_name: '',
  signer_title: '',
  contact_email: '',
  contact_phone: '',
  signer_name: '',
  agreement_accepted: false,
}

const AGREEMENT_TEXT = `Shift Rewards Partner Agreement
Green Streets Initiative — ${new Date().getFullYear()}

By submitting this application, you ("Partner") agree to the following terms with Green Streets Initiative ("GSI"), a 501(c)(3) nonprofit organization based in Cambridge, Massachusetts.

1. Program participation
Partner agrees to honor the offer described in this application ("the Offer") to verified Shift app users who present a valid redemption confirmation on their device. GSI will display the Offer in the Shift rewards catalog once this application is reviewed and approved.

2. Offer terms
Partner may set reasonable limits on the Offer (e.g., one per customer per week). GSI is not responsible for disputes between Partner and customers regarding Offer redemption. Partner may update or remove the Offer at any time via the partner dashboard.

3. No cost to Partner
Participation in the Shift rewards network is free. GSI does not charge Partner for listing, impressions, or redemptions.

4. GSI's role
GSI operates the Shift app and rewards catalog. GSI does not guarantee any minimum number of redemptions or user visits to Partner's location. GSI may remove any Partner listing that violates these terms or that GSI determines is inconsistent with its mission.

5. Data and reporting
GSI will provide Partner with monthly reports showing aggregate redemption counts and Shift user reach at Partner's location. GSI does not share individual user data with Partners.

6. Termination
Either party may end this agreement at any time. Partner may pause or end their listing via the partner dashboard. GSI may remove a listing with written notice to Partner's contact email.

7. No exclusivity
This agreement does not create an exclusive relationship. GSI may partner with other businesses in Partner's category or neighborhood.

8. Governing law
This agreement is governed by the laws of the Commonwealth of Massachusetts.

By checking the box below, you confirm that you are authorized to enter into this agreement on behalf of the business named in this application, and that you have read and agree to these terms.`

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
  const [loginEmail, setLoginEmail] = useState('')
  const [loginSent, setLoginSent] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    async function fetchSponsors() {
      const { data } = await supabase
        .from('sponsors')
        .select('name, logo_url, website_url')
        .eq('status', 'active')
        .in('sponsor_type', ['community_reward', 'local'])
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

  function update(field: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function isStep1Valid() {
    return form.business_name.trim() && form.address.trim() && form.city.trim()
  }

  function isStep2Valid() {
    return (
      form.offer_description.trim() &&
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
        const ext = logoFile.name.split('.').pop() || 'png'
        logoPath = `logos/${Date.now()}-${sanitizedName}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('sponsor-logos')
          .upload(logoPath, logoFile, { contentType: logoFile.type })

        if (uploadError) {
          throw new Error('Logo upload failed')
        }
      }

      const res = await fetch(
        'https://xyqcpgwbqrhykpgpqbdi.supabase.co/functions/v1/sponsor-intake',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name: form.business_name.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            contact_name: form.contact_name.trim(),
            contact_email: form.contact_email.trim(),
            contact_phone: form.contact_phone.trim() || null,
            offer_description: form.offer_description.trim(),
            offer_limits: null,
            redemption_frequency: form.redemption_frequency || null,
            total_redemption_cap: form.total_redemption_cap ? parseInt(form.total_redemption_cap, 10) : null,
            expiration_date: form.expiration_date || null,
            referral_source: form.referral_source.trim() || null,
            signer_name: form.signer_name.trim(),
            signer_title: form.signer_title.trim(),
            agreement_accepted: true,
            website_url: form.website_url.trim() || null,
            logo_url: logoPath,
          }),
        }
      )
      if (!res.ok) throw new Error('Submit failed')
      setSubmitted(true)
    } catch {
      setSubmitError(
        'Something went wrong — please try again or email us at info@gogreenstreets.org.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginEmail.trim()) return
    setLoginLoading(true)

    await fetch(
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

            <p className="mb-12 max-w-[620px] text-lg leading-[1.7] text-white/60">
              Join the Shift rewards network — put your business in front of people who walk, bike, and ride transit every day. Free to join. No POS integration. No complicated setup.
            </p>

            <div className="grid gap-5 sm:grid-cols-3">
              {[
                {
                  title: 'Visibility where it counts',
                  desc: 'Your business appears in the Shift rewards catalog, surfaced to active commuters near you.',
                },
                {
                  title: 'Foot traffic that\u2019s earned',
                  desc: 'Shift users redeem points by coming in. They\u2019re motivated, local, and regular.',
                },
                {
                  title: 'Monthly impact reports',
                  desc: 'See how many Shift users redeemed offers at your location each month, with neighborhood-level reach data.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-6"
                >
                  <h3 className="mb-2 font-display text-sm font-bold text-[#BAF14D]">
                    {item.title}
                  </h3>
                  <p className="text-[0.875rem] leading-[1.6] text-white/50">{item.desc}</p>
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
        {sponsors.length > 0 && (
          <section className="bg-[#F4F8EE] px-8 py-24">
            <div className="mx-auto max-w-[1120px]">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7DB82E]">
                Our network
              </div>
              <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-[#191A2E]">
                Who&apos;s already in the network
              </h2>
              <p className="mb-12 max-w-[560px] text-[1.0625rem] leading-[1.65] text-[#4A4D68]">
                These businesses offer rewards to Shift users across Greater Boston.
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
                  desc: 'Shift users see your offer in the app, earn points on active trips, and redeem at your location by showing their phone. Your staff confirms the screen and honors the offer. That\u2019s it.',
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
                  <p className="text-[0.9375rem] leading-[1.6] text-white/50">{s.desc}</p>
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
              Takes about 5 minutes. Free to participate.
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
                              setLogoFile(file)
                              if (file) {
                                const url = URL.createObjectURL(file)
                                setLogoPreview(url)
                              } else {
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
                      <p className="mt-1.5 text-xs text-[#8A8DA8]">
                        Optional — square images work best.
                      </p>
                    </div>
                    <AddressAutocomplete
                      value={form.address}
                      onChange={(v) => update('address', v)}
                      onCityDetected={(city) => update('city', city)}
                    />
                    <Field
                      label="City"
                      required
                      value={form.city}
                      onChange={(v) => update('city', v)}
                    />
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
                    </div>
                    <button
                      onClick={() => goToStep(2)}
                      disabled={!isStep1Valid()}
                      className="mt-4 rounded-full bg-[#191A2E] px-7 py-3 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Continue &rarr;
                    </button>
                  </div>
                )}

                {/* Step 2 — Your offer */}
                {step === 2 && (
                  <div className="space-y-5">
                    <h3 className="font-display text-lg font-bold text-[#191A2E]">
                      Your offer
                    </h3>
                    <p className="text-[0.9375rem] leading-[1.6] text-[#4A4D68]">
                      Tell us what you&apos;d like to offer Shift users. Keep it simple and
                      specific — &ldquo;10% off any purchase&rdquo; or &ldquo;Free coffee with any
                      food order&rdquo; work well. You&apos;ll be able to update this anytime from
                      your partner dashboard.
                    </p>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                        Offer description <span className="text-[#E05252]">*</span>
                      </label>
                      <textarea
                        value={form.offer_description}
                        onChange={(e) => {
                          if (e.target.value.length <= 200)
                            update('offer_description', e.target.value)
                        }}
                        maxLength={200}
                        rows={3}
                        placeholder="e.g. Free pastry with any coffee purchase"
                        className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#8A8DA8] focus:border-[#BAF14D]"
                      />
                      <div className="mt-1 text-right text-xs text-[#8A8DA8]">
                        {form.offer_description.length}/200
                      </div>
                    </div>

                    <div className="rounded-xl border border-[rgba(25,26,46,0.09)] bg-[rgba(25,26,46,0.02)] p-5">
                      <h4 className="mb-1 font-display text-sm font-bold text-[#191A2E]">
                        Offer limits (all optional)
                      </h4>
                      <p className="mb-4 text-xs leading-relaxed text-[#8A8DA8]">
                        Set any combination of limits, or leave blank for an open-ended offer.
                      </p>

                      <div className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                            How often can each person use this offer?
                          </label>
                          <select
                            value={form.redemption_frequency}
                            onChange={(e) => update('redemption_frequency', e.target.value)}
                            className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors focus:border-[#BAF14D]"
                          >
                            <option value="">No limit</option>
                            <option value="daily">Once per day</option>
                            <option value="weekly">Once per week</option>
                            <option value="monthly">Once per month</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                            Total number of redemptions available
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={form.total_redemption_cap}
                            onChange={(e) => update('total_redemption_cap', e.target.value)}
                            placeholder="Leave blank for unlimited"
                            className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#8A8DA8] focus:border-[#BAF14D]"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
                            Offer expiration date
                          </label>
                          <input
                            type="date"
                            value={form.expiration_date}
                            onChange={(e) => update('expiration_date', e.target.value)}
                            className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors focus:border-[#BAF14D]"
                          />
                          <p className="mt-1 text-xs text-[#8A8DA8]">
                            Leave blank to run indefinitely.
                          </p>
                        </div>
                      </div>
                    </div>

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
                      {AGREEMENT_TEXT}
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
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[480px] text-center">
            <h2 className="mb-2 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Already a rewards partner?
            </h2>
            <p className="mb-8 text-[0.9375rem] leading-[1.65] text-white/55">
              Log in to update your offer, edit your contact info, or manage your listing.
            </p>

            {loginSent ? (
              <div className="rounded-[18px] border border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.08)] p-6">
                <p className="text-sm text-white/70">
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
}: {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
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
        className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#8A8DA8] focus:border-[#BAF14D]"
      />
    </div>
  )
}
