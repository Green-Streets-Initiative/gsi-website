'use client'

import { useState } from 'react'

type Props = {
  shareUrl: string
  blurb: string
  emailSubject: string
  emailBody: string
  hasReferralCode: boolean
}

export default function ShareKit({
  shareUrl,
  blurb,
  emailSubject,
  emailBody,
  hasReferralCode,
}: Props) {
  const [copiedField, setCopiedField] = useState<'link' | 'blurb' | null>(null)

  async function copy(text: string, field: 'link' | 'blurb') {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(c => (c === field ? null : c)), 1800)
    } catch {
      // Clipboard API can fail in insecure contexts or older browsers; fall
      // back to a visible textarea the user can copy from manually.
      setCopiedField(null)
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`

  return (
    <div className="space-y-6">
      {/* Referral indicator */}
      {hasReferralCode && (
        <div className="rounded-[10px] border border-[#BAF14D]/30 bg-[#BAF14D]/[0.08] px-4 py-3 text-sm text-white/85">
          Your referral code is included in the link below. Friends who join through it count toward your referral entries.
        </div>
      )}

      {/* Share link */}
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/75">
          Challenge link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-[10px] border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm text-white placeholder:text-white/60 focus:border-[#BAF14D]/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => copy(shareUrl, 'link')}
            className="rounded-full bg-[#BAF14D] px-5 py-3 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
          >
            {copiedField === 'link' ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* Blurb */}
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/75">
          Pre-written blurb
        </label>
        <textarea
          readOnly
          value={blurb}
          rows={6}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full resize-none rounded-[10px] border border-white/[0.12] bg-white/[0.07] px-4 py-3 text-sm leading-[1.6] text-white placeholder:text-white/60 focus:border-[#BAF14D]/50 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => copy(blurb, 'blurb')}
            className="inline-flex items-center gap-2 rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
          >
            {copiedField === 'blurb' ? 'Copied!' : 'Copy blurb'}
          </button>
          <a
            href={mailto}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
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
