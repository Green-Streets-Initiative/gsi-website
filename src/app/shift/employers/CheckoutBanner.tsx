'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { X } from '@phosphor-icons/react'

/**
 * Banner shown on the /shift/employers marketing page after a successful
 * Stripe Checkout redirect (success_url includes ?checkout=success).
 *
 * The buyer has paid but hasn't signed in yet — the welcome email with
 * their magic link is in flight. Without this banner, they'd have no
 * feedback that checkout worked, and could mistake the marketing page
 * for "nothing happened."
 *
 * Clicking "Send me another link" smoothly scrolls to the existing
 * EmployerLogin form at the bottom so they can request a link manually
 * if the emailed one got lost.
 */
export default function CheckoutBanner() {
  const searchParams = useSearchParams()
  const checkout = searchParams.get('checkout')
  const canceled = searchParams.get('canceled')
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissal when the URL changes (e.g., a second checkout attempt)
  useEffect(() => {
    setDismissed(false)
  }, [checkout, canceled])

  if (dismissed) return null
  if (checkout !== 'success' && canceled !== 'true') return null

  const isSuccess = checkout === 'success'

  return (
    <div
      className={`border-b ${
        isSuccess
          ? 'border-forest/40 bg-forest/10'
          : 'border-[#EDB93C]/30 bg-[#EDB93C]/10'
      }`}
    >
      <div className="mx-auto flex max-w-[1120px] items-start gap-4 px-6 py-5 lg:px-8">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isSuccess ? 'bg-forest' : 'bg-[#EDB93C]'
          }`}
          aria-hidden
        >
          <span className={`text-base font-bold ${isSuccess ? 'text-white' : 'text-navy'}`}>
            {isSuccess ? '\u2713' : '!'}
          </span>
        </div>
        <div className="flex-1">
          {isSuccess ? (
            <>
              <h3 className="text-base font-semibold text-navy">
                You&apos;re in — welcome to Shift
              </h3>
              <p className="mt-1 text-sm leading-[1.55] text-ink-soft">
                Your subscription is active. Check your inbox for a
                welcome email with your employee invite code and a
                sign-in link to configure your portal. Didn&apos;t get
                it?{' '}
                <a
                  href="#employer-login"
                  onClick={(e) => {
                    e.preventDefault()
                    document
                      .getElementById('employer-login')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="font-semibold text-forest underline underline-offset-4 hover:opacity-80"
                >
                  Send me another link
                </a>
                .
              </p>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-navy">
                Checkout canceled
              </h3>
              <p className="mt-1 text-sm leading-[1.55] text-ink-soft">
                No charge was made. You can subscribe any time, or{' '}
                <a
                  href="/contact?inquiry=employer"
                  className="font-semibold text-forest underline underline-offset-4 hover:opacity-80"
                >
                  talk to us
                </a>{' '}
                if you&apos;d prefer an invoiced plan.
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-sm text-ink-soft hover:text-navy"
          aria-label="Dismiss"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  )
}
