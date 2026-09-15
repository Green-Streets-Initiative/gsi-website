'use client'

import { useState } from 'react'
import { PILL } from '@/components/org/Section'

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
        <div className="rounded-[12px] border border-navy/10 bg-navy/[0.04] px-4 py-3 text-[15px] leading-relaxed text-ink-soft">
          Your referral code is included in the link below. Friends who join through it count toward your referral entries.
        </div>
      )}

      {/* Share link */}
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
          Challenge link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-[10px] border border-navy/15 bg-white px-4 py-3 text-[15px] text-navy placeholder:text-ink-soft focus:border-forest focus:outline-none"
          />
          <button
            type="button"
            onClick={() => copy(shareUrl, 'link')}
            className={PILL}
          >
            {copiedField === 'link' ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* Blurb */}
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
          Pre-written blurb
        </label>
        <textarea
          readOnly
          value={blurb}
          rows={6}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full resize-none rounded-[10px] border border-navy/15 bg-white px-4 py-3 text-[15px] leading-[1.6] text-navy placeholder:text-ink-soft focus:border-forest focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => copy(blurb, 'blurb')}
            className={PILL}
          >
            {copiedField === 'blurb' ? 'Copied!' : 'Copy blurb'}
          </button>
          <a
            href={mailto}
            className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05] gap-2"
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
