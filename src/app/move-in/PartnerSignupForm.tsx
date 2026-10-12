'use client'

import posthog from 'posthog-js'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowSquareOut, Check, Copy, UploadSimple } from '@phosphor-icons/react'
import { gaEvent } from '@/lib/ga'
import { currentAttribution, type StoreAttribution } from '@/lib/store-attribution'
import { BUTTON, H3 } from '@/components/street/Street'

/**
 * Self-serve co-brand signup: name, role and an optional logo in, a live
 * /nearby?partner=<slug> link out, no login and no waiting on GSI. Submits to
 * /api/partners (service role does the row and upload; anon can't write).
 *
 * The form and the phone preview beside it (ResidentPreview) share state
 * through SignupProvider, so the preview shows the visitor's own name or
 * logo on the page residents get.
 *
 * Telemetry, all to PostHog and GA4 with the visit's utm tags attached, so
 * the outreach funnel reads email → page → started → created → link copied:
 *   partner_signup_started    first interaction with the form
 *   partner_signup_submitted  submit pressed and passed client checks
 *   partner_signup_succeeded  row created ({ slug, role, has_logo })
 *   partner_signup_failed     { stage: 'validation' | 'server' | 'network', reason }
 *   partner_link_copied       { kind: 'live', slug }
 *   partner_page_opened       { slug } — "Open your page" on the success card
 * The page view itself is the site-wide $pageview.
 */

const SITE_URL = 'https://www.gogreenstreets.org'
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const ROLES: { value: string; label: string }[] = [
  { value: 'property_manager', label: 'Property manager' },
  { value: 'leasing_agent', label: 'Leasing or rental agent' },
  { value: 'broker', label: 'Real estate broker' },
  { value: 'mover', label: 'Moving company' },
  { value: 'other', label: 'Something else' },
]

function utmProps(attr: StoreAttribution | null) {
  return {
    utm_source: attr?.source,
    utm_medium: attr?.medium,
    utm_campaign: attr?.campaign,
    utm_content: attr?.content,
  }
}

function track(name: string, props: Record<string, unknown>) {
  const all = { ...utmProps(currentAttribution()), ...props }
  posthog.capture(name, all)
  gaEvent(name, all)
}

/* ── Shared state (form ↔ preview) ───────────────────────── */

interface SignupState {
  name: string
  setName: (v: string) => void
  logo: File | null
  logoPreview: string | null
  setLogoFile: (file: File | null) => void
}

const SignupContext = createContext<SignupState | null>(null)

export function useSignup(): SignupState {
  const ctx = useContext(SignupContext)
  if (!ctx) throw new Error('useSignup outside SignupProvider')
  return ctx
}

export function SignupProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  function setLogoFile(file: File | null) {
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
    setLogo(file)
  }

  return (
    <SignupContext.Provider value={{ name, setName, logo, logoPreview, setLogoFile }}>
      {children}
    </SignupContext.Provider>
  )
}

/* ── Form ────────────────────────────────────────────────── */

const LABEL = 'mb-2 block text-[16px] font-bold text-navy'
const HINT = 'mt-2 block text-[15px] leading-snug text-ink-soft'
const INPUT =
  'w-full rounded-[10px] border border-navy/20 bg-white px-4 py-3 text-[16px] text-navy placeholder:text-ink-tertiary focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/25'

export function PartnerSignupForm() {
  const { name, setName, logo, logoPreview, setLogoFile } = useSignup()
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [slug, setSlug] = useState<string | null>(null)
  const started = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)

  function markStarted() {
    if (started.current) return
    started.current = true
    track('partner_signup_started', {})
  }

  function fail(stage: 'validation' | 'server' | 'network', reason: string) {
    setError(reason)
    track('partner_signup_failed', { stage, reason, role: role || undefined })
  }

  function pickLogo(file: File | null) {
    markStarted()
    setLogoError(null)
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return setLogoFile(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLogoError('Please choose a PNG, JPEG or WebP image.')
      track('partner_signup_failed', { stage: 'validation', reason: 'logo type' })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('That file is over 2 MB. A smaller version of your logo will work.')
      track('partner_signup_failed', { stage: 'validation', reason: 'logo size' })
      return
    }
    setLogoFile(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    markStarted()
    setError(null)
    if (!name.trim()) return fail('validation', 'Please enter your building or company name.')
    if (!role) return fail('validation', 'Please choose what best describes you.')

    setSubmitting(true)
    track('partner_signup_submitted', { role, has_logo: !!logo })
    const attr = currentAttribution()
    try {
      const fd = new FormData()
      fd.set('name', name)
      fd.set('role', role)
      fd.set('contact_email', email)
      if (logo) fd.set('logo', logo)
      fd.set('website', honeypot)
      for (const [k, v] of Object.entries(utmProps(attr))) if (v) fd.set(k, v)
      const res = await fetch('/api/partners', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitting(false)
        return fail('server', data.error ?? 'Something went wrong. Please try again.')
      }
      track('partner_signup_succeeded', { slug: data.slug, role, has_logo: !!logo })
      setSlug(data.slug)
    } catch {
      setSubmitting(false)
      fail('network', 'We couldn’t reach our server. Please check your connection and try again.')
    }
  }

  if (slug) return <SuccessCard slug={slug} />

  return (
    <form
      id="set-up"
      onSubmit={handleSubmit}
      onFocus={markStarted}
      noValidate
      className="rounded-[20px] border border-navy/10 bg-white p-6 sm:p-8"
    >
      <h2 className={`${H3} mb-6`}>Set up your page</h2>

      {/* Honeypot: bots fill it, people never see it */}
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>

      <div className="space-y-7">
        <label className="block">
          <span className={LABEL}>Building or company name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            autoComplete="organization"
            placeholder="Harborline Apartments"
            className={INPUT}
          />
        </label>

        <fieldset>
          <legend className={LABEL}>What best describes you?</legend>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <label key={r.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                  className="peer sr-only"
                />
                <span className="inline-flex min-h-[44px] items-center rounded-full border border-navy/20 bg-white px-4 text-[15px] text-navy transition-colors hover:border-navy/40 peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2">
                  {r.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <span className={LABEL} id="logo-label">
            Your logo <span className="font-normal text-ink-soft">(optional)</span>
          </span>
          <input
            ref={fileInput}
            id="logo-input"
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            aria-labelledby="logo-label"
            onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          {logo && logoPreview ? (
            <div className="flex items-center gap-4 rounded-[10px] border border-navy/20 bg-white p-3">
              <span className="flex h-14 w-24 shrink-0 items-center justify-center rounded-md border border-navy/10 bg-white p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="Your logo" className="max-h-full max-w-full object-contain" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] text-navy">{logo.name}</span>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="min-h-[44px] shrink-0 rounded-full px-3 text-[15px] font-bold text-forest hover:underline"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => pickLogo(null)}
                className="min-h-[44px] shrink-0 rounded-full px-3 text-[15px] font-bold text-navy hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <label
              htmlFor="logo-input"
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                pickLogo(e.dataTransfer.files?.[0] ?? null)
              }}
              className={`flex min-h-[72px] cursor-pointer items-center justify-center gap-2.5 rounded-[10px] border-2 border-dashed px-4 py-4 text-center text-[16px] transition-colors ${
                dragging ? 'border-forest bg-forest/[0.06]' : 'border-navy/20 hover:border-forest/60'
              }`}
            >
              <UploadSimple size={22} className="shrink-0 text-forest" aria-hidden />
              <span className="text-navy">
                <span className="font-bold text-forest">Choose a file</span>
                <span className="hidden sm:inline"> or drag it here</span>
              </span>
            </label>
          )}
          {logoError ? (
            <span role="alert" className="mt-2 block text-[15px] text-ep-danger">{logoError}</span>
          ) : (
            <span className={HINT}>
              PNG, JPEG or WebP, up to 2 MB. Without a logo, your page shows your name.
            </span>
          )}
        </div>

        <label className="block">
          <span className={LABEL}>
            Your email <span className="font-normal text-ink-soft">(optional)</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            className={INPUT}
          />
          <span className={HINT}>So we can reach you about your page. Only Green Streets sees it.</span>
        </label>
      </div>

      {error && (
        <div role="alert" className="mt-6 rounded-[10px] border border-ep-danger/30 bg-ep-danger/5 px-4 py-3 text-[15px] text-ep-danger">
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting} className={`${BUTTON} mt-7 w-full sm:w-auto disabled:cursor-wait disabled:opacity-70`}>
        {submitting ? 'Creating your page…' : 'Create my page'}
      </button>
    </form>
  )
}

/* ── Success ─────────────────────────────────────────────── */

function SuccessCard({ slug }: { slug: string }) {
  // utm_campaign tags the campaign; the partner slug identifies the building.
  const liveUrl = `${SITE_URL}/nearby?partner=${slug}&utm_source=partner&utm_campaign=newroutes`
  const [copied, setCopied] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  // The card replaces the form in place: bring it into view and give screen
  // readers the new heading.
  useEffect(() => {
    heading.current?.focus()
    heading.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  async function copy() {
    track('partner_link_copied', { kind: 'live', slug })
    try {
      await navigator.clipboard.writeText(liveUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (e.g. non-secure context): the link field is
      // selectable, so it can still be copied by hand.
    }
  }

  return (
    <div className="rounded-[20px] border border-navy/10 bg-white p-6 sm:p-8">
      <h2 ref={heading} tabIndex={-1} className={`${H3} flex items-center gap-2.5 outline-none`}>
        <Check size={26} weight="bold" className="shrink-0 text-forest" aria-hidden />
        Your page is ready
      </h2>
      <p className="mt-3 text-[1.0625rem] leading-[1.6] text-ink-soft">
        Share this link with residents. It works for any Greater Boston address: each person enters
        their own.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={liveUrl}
          aria-label="Your page link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-[48px] min-w-0 flex-1 rounded-[10px] border border-navy/20 bg-cream px-4 text-[15px] text-navy focus:border-forest focus:outline-none"
        />
        <button type="button" onClick={copy} className={`${BUTTON} gap-2`}>
          {copied ? <Check size={18} weight="bold" aria-hidden /> : <Copy size={18} aria-hidden />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <span aria-live="polite" className="sr-only">{copied ? 'Link copied' : ''}</span>

      <a
        href={liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('partner_page_opened', { slug })}
        className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 font-bold text-forest underline-offset-4 hover:underline"
      >
        Open your page <ArrowSquareOut size={18} aria-hidden />
      </a>

      <p className="mt-5 border-t border-navy/10 pt-5 text-[15px] leading-[1.6] text-ink-soft">
        For a single building, open your page and enter its address. Copy link on that page then
        opens right on your building, and Print makes a one-page sheet with a QR code for welcome
        packets.
      </p>
    </div>
  )
}
