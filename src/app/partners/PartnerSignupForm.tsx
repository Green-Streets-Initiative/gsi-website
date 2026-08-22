'use client'

import { useMemo, useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import { slugify } from '@/lib/utm'

/**
 * Self-service co-brand signup: name + logo in, a live
 * /nearby?partner=<slug> link out — no login, no waiting on GSI. Submits to
 * /api/partners (service role does the row + upload; anon can't write). The
 * success state replaces the form with the copyable links and usage tips.
 */

const SITE_URL = 'https://www.gogreenstreets.org'
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export default function PartnerSignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)

  // The API may append a suffix (-2, -3…) if the name is taken; this preview
  // just sets expectations while typing.
  const slugPreview = useMemo(() => slugify(name).slice(0, 60).replace(/-+$/, ''), [name])

  function pickLogo(file: File | null) {
    setError(null)
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    if (!file) {
      setLogo(null)
      setLogoPreview(null)
      return
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLogo(null)
      setLogoPreview(null)
      setError('Please choose a PNG, JPEG, or WebP image.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogo(null)
      setLogoPreview(null)
      setError('That file is over 2MB — please use a smaller version of your logo.')
      return
    }
    setLogo(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Please enter your organization name.')
      return
    }
    if (!logo) {
      setError('Please add your logo.')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('name', name)
      fd.set('contact_email', email)
      fd.set('logo', logo)
      fd.set('website', honeypot)
      const res = await fetch('/api/partners', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setSlug(data.slug)
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (slug) {
    return <SuccessPanel slug={slug} logoPreview={logoPreview} name={name} />
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#242538] rounded-xl border border-white/[0.08] p-8 md:p-10 space-y-6"
      encType="multipart/form-data"
    >
      {/* Honeypot — bots fill it, real users won't see it */}
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-white mb-2">
          Organization name<span className="text-[#e74c3c] ml-1">*</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          placeholder="e.g., Harborline Realty"
          className="w-full px-4 py-3 bg-[#191A2E] border border-white/[0.12] rounded-md text-white placeholder:text-white/60 focus:outline-none focus:border-[#52B788] focus:ring-1 focus:ring-[#52B788]/30"
        />
        {slugPreview && (
          <span className="block mt-1.5 text-xs text-white/70">
            Your link: <span className="font-mono text-white/80">gogreenstreets.org/nearby?partner={slugPreview}</span>
          </span>
        )}
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-white mb-2">
          Your logo<span className="text-[#e74c3c] ml-1">*</span>
        </span>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-white/75 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-white/[0.07] file:text-white file:text-sm file:font-medium hover:file:bg-white/[0.12] file:cursor-pointer"
        />
        <span className="block mt-1 text-xs text-white/75">
          PNG, JPEG, or WebP · max 2MB · transparent background looks best
        </span>
        {logoPreview && (
          <span className="mt-3 inline-block rounded-md bg-white px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoPreview} alt="Logo preview" className="max-h-12 w-auto" />
          </span>
        )}
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-white mb-2">
          Contact email<span className="text-white/70 ml-1">(optional)</span>
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourcompany.com"
          className="w-full px-4 py-3 bg-[#191A2E] border border-white/[0.12] rounded-md text-white placeholder:text-white/60 focus:outline-none focus:border-[#52B788] focus:ring-1 focus:ring-[#52B788]/30"
        />
        <span className="block mt-1 text-xs text-white/75">
          So we can reach you about your page — never shown publicly
        </span>
      </label>

      {error && (
        <div className="bg-[#7a2424] border border-[#e74c3c]/40 rounded-md px-4 py-3 text-sm text-white">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 bg-[#52B788] text-[#191A2E] px-7 py-3.5 rounded-[10px] font-bold text-[0.9375rem] hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Creating your link…' : 'Create my co-branded link →'}
      </button>
    </form>
  )
}

/* ── Success state ───────────────────────────────────────── */

function SuccessPanel({ slug, logoPreview, name }: {
  slug: string
  logoPreview: string | null
  name: string
}) {
  // Carry the campaign tag so self-serve partner traffic is attributable by
  // campaign (not just partner slug), matching the documented link template.
  const liveUrl = `${SITE_URL}/nearby?partner=${slug}&utm_campaign=newroutes`
  const printUrl = `${SITE_URL}/nearby/print?partner=${slug}&utm_campaign=newroutes`

  return (
    <div className="bg-[#242538] rounded-xl border border-white/[0.08] p-8 md:p-10 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-[#52B788] mb-3">
          <Check size={22} weight="bold" />
          <span className="text-xs font-bold uppercase tracking-[0.08em]">You&rsquo;re live</span>
        </div>
        <h3 className="font-display text-[1.5rem] font-bold text-white">
          Your co-branded link is ready.
        </h3>
        {logoPreview && (
          <div className="mt-4 flex items-center gap-3">
            <span className="rounded-md bg-white px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoPreview} alt={name} className="max-h-10 w-auto" />
            </span>
            <span className="text-sm text-[#E8E8EE]">
              appears on every page your clients open
            </span>
          </div>
        )}
      </div>

      <CopyRow label="Your live link" url={liveUrl} primary />

      <div className="rounded-lg border border-white/[0.08] bg-[#191A2E] p-5 space-y-3">
        <div className="text-sm font-semibold text-white">Printable one-pagers</div>
        <p className="text-sm leading-relaxed text-[#E8E8EE]">
          Open your link, search a listing&rsquo;s address, then hit <em>Print this
          page</em> — your logo carries onto the printed sheet automatically.
        </p>
        <CopyRow label="Direct print link (asks you to pick a neighborhood first)" url={printUrl} />
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#52B788] mb-3">
          Ways to use it
        </div>
        <ul className="space-y-2">
          {[
            'Paste the link into listing emails and tenant welcome packets',
            'Print a snapshot for the lobby, the elevator, or an open house',
            'Add it to your email signature — works for any Greater Boston address',
          ].map((tip) => (
            <li key={tip} className="text-sm text-[#E8E8EE] leading-snug pl-5 relative">
              <span className="absolute left-0 top-[0.4375rem] w-1.5 h-1.5 rounded-full bg-[#52B788]" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[0.8125rem] text-[#E8E8EE] leading-relaxed border-t border-white/[0.08] pt-5">
        We look over new partner pages — if anything needs a tweak, we&rsquo;ll reach
        out at the email you gave us.
      </p>
    </div>
  )
}

function CopyRow({ label, url, primary }: { label: string; url: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (e.g., non-secure context) — the URL text below
      // is selectable, so the user can still copy by hand.
    }
  }

  return (
    <div>
      <div className={`text-xs mb-1.5 ${primary ? 'font-bold uppercase tracking-[0.08em] text-[#52B788]' : 'text-[#E8E8EE]'}`}>
        {label}
      </div>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap rounded-md border border-white/[0.12] bg-[#191A2E] px-3.5 py-2.5 font-mono text-[0.8125rem] text-[#E8E8EE]">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-md px-3.5 text-sm font-semibold transition-colors ${
            primary
              ? 'bg-[#52B788] text-[#191A2E] hover:opacity-90'
              : 'border border-white/[0.12] text-white hover:border-white/30'
          }`}
        >
          {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
