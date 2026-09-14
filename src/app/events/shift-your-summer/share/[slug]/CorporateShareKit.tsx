'use client'

import { useState } from 'react'

type Tone = 'dark' | 'light'

type Props = {
  shareUrl: string
  blurb: string
  emailSubject: string
  emailBody: string
  inviteCode: string
  /** `light` is the cream campaign pages; `dark` (default) keeps the share pages byte-identical. */
  tone?: Tone
  /** Label over the code: "Team code" on the workplace share page, "Campaign code" on a school page. */
  codeLabel?: string
}

const THEME: Record<Tone, { label: string; code: string; copyCode: string; hint: string; input: string; copyLink: string; textarea: string; copyBlurb: string; mail: string }> = {
  dark: {
    label: 'mb-2 block text-xs font-bold uppercase tracking-widest text-white/75',
    code: 'font-mono text-3xl font-extrabold tracking-[0.2em] text-[#BAF14D]',
    copyCode: 'rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.06]',
    hint: 'mt-2 text-sm text-white/75',
    input: 'flex-1 rounded-[10px] border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm text-white placeholder:text-white/60 focus:border-[#BAF14D]/50 focus:outline-none',
    copyLink: 'rounded-full bg-[#BAF14D] px-5 py-3 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85',
    textarea: 'w-full resize-none rounded-[10px] border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm leading-[1.6] text-white placeholder:text-white/60 focus:border-[#BAF14D]/50 focus:outline-none',
    copyBlurb: 'inline-flex items-center gap-2 rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85',
    mail: 'inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10',
  },
  light: {
    label: 'mb-2 block text-[12px] font-semibold uppercase tracking-[0.14em] text-forest',
    code: 'font-mono text-3xl font-extrabold tracking-[0.2em] text-navy',
    copyCode: 'rounded-full border border-navy/25 px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-navy/[0.05]',
    hint: 'mt-2 text-sm text-ink-soft',
    input: 'flex-1 rounded-[10px] border border-navy/20 bg-white px-4 py-3 text-sm text-navy focus:border-forest focus:outline-none',
    copyLink: 'rounded-full bg-navy px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90',
    textarea: 'w-full resize-none rounded-[10px] border border-navy/20 bg-white px-4 py-3 text-sm leading-[1.6] text-navy focus:border-forest focus:outline-none',
    copyBlurb: 'inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90',
    mail: 'inline-flex items-center gap-2 rounded-full border border-navy/25 px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-navy/[0.05]',
  },
}

export default function CorporateShareKit({
  shareUrl,
  blurb,
  emailSubject,
  emailBody,
  inviteCode,
  tone = 'dark',
  codeLabel = 'Team code',
}: Props) {
  const [copiedField, setCopiedField] = useState<'link' | 'blurb' | 'code' | null>(null)
  const t = THEME[tone]

  async function copy(text: string, field: 'link' | 'blurb' | 'code') {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(c => (c === field ? null : c)), 1800)
    } catch {
      setCopiedField(null)
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`

  return (
    <div className="space-y-6">
      {/* Invite code */}
      <div>
        <label className={t.label}>
          {codeLabel}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <span className={t.code}>
            {inviteCode}
          </span>
          <button
            type="button"
            onClick={() => copy(inviteCode, 'code')}
            className={t.copyCode}
          >
            {copiedField === 'code' ? 'Copied!' : 'Copy code'}
          </button>
        </div>
        <p className={t.hint}>
          Or open the Shift app and enter this code manually.
        </p>
      </div>

      {/* Share link */}
      <div>
        <label className={t.label}>
          Share this page
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className={t.input}
          />
          <button
            type="button"
            onClick={() => copy(shareUrl, 'link')}
            className={t.copyLink}
          >
            {copiedField === 'link' ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* Blurb */}
      <div>
        <label className={t.label}>
          Pre-written blurb
        </label>
        <textarea
          readOnly
          value={blurb}
          rows={5}
          onFocus={(e) => e.currentTarget.select()}
          className={t.textarea}
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => copy(blurb, 'blurb')}
            className={t.copyBlurb}
          >
            {copiedField === 'blurb' ? 'Copied!' : 'Copy blurb'}
          </button>
          <a
            href={mailto}
            className={t.mail}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Share via email
          </a>
        </div>
      </div>
    </div>
  )
}
