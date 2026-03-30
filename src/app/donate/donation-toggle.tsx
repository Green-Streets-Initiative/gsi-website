'use client'

import { useState } from 'react'

export function DonationToggle() {
  const [tab, setTab] = useState<'monthly' | 'one-time'>('monthly')

  return (
    <div>
      {/* Toggle */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-white/[0.15] bg-white/[0.06] p-1">
          <button
            onClick={() => setTab('one-time')}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              tab === 'one-time'
                ? 'bg-white text-[#191A2E]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            One-time
          </button>
          <button
            onClick={() => setTab('monthly')}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              tab === 'monthly'
                ? 'bg-white text-[#191A2E]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* DONORBOX EMBED PLACEHOLDER
          Replace this placeholder with the Donorbox embed code once
          the Donorbox account is configured with bank details.
          Donorbox embed typically looks like:
          <script src="https://donorbox.org/widget.js" ...></script>
          <iframe src="https://donorbox.org/embed/[campaign-id]" ...></iframe>

          Pass the `tab` state value to set the Donorbox form to
          one-time or recurring mode.
      */}
      <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-10 text-center">
        <p className="mb-2 font-display text-base font-bold text-white">
          {tab === 'monthly' ? 'Monthly giving' : 'One-time gift'}
        </p>
        <p className="mb-6 text-sm text-white/60">
          Donation form coming soon.
        </p>
        <a
          href="mailto:info@gogreenstreets.org?subject=Donation%20inquiry"
          className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
        >
          Email us to donate now
        </a>
      </div>

      <p className="mt-6 text-center text-sm text-white/60">
        Gifts of all sizes make a difference.
        {tab === 'monthly' ? ' Monthly giving helps us plan ahead.' : ''}
      </p>
    </div>
  )
}
