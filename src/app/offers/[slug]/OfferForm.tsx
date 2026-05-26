'use client'

import { useState } from 'react'
import { Check } from '@phosphor-icons/react'

interface OfferFormProps {
  slug: string
  sponsorName: string
  offerUrl: string
  consentText: string
  privacyPolicyUrl: string
  validThroughLabel: string | null
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function OfferForm({
  slug,
  sponsorName,
  offerUrl,
  consentText,
  privacyPolicyUrl,
  validThroughLabel,
}: OfferFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()
    const trimmedEmail = email.trim()

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      setError('Please fill in every field.')
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/sponsor-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: trimmedEmail,
        }),
      })

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Too many submissions. Please try again later.')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Something went wrong. Please try again.')
        return
      }
      const data = await res.json()
      if (!data?.code) {
        setError('Could not retrieve your code. Please contact support.')
        return
      }
      setCode(data.code)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const onCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail in older browsers / non-secure contexts; the
      // user can still long-press to copy from the displayed code.
    }
  }

  if (code) {
    return (
      <div className="offer-success" role="status" aria-live="polite">
        <div className="check" aria-hidden="true">
          <Check size={32} weight="bold" />
        </div>
        <h3>You're in!</h3>
        <button
          type="button"
          className="code-display"
          onClick={onCopy}
          aria-label={`Discount code ${code}. Tap to copy.`}
        >
          {copied ? 'Copied!' : code}
        </button>
        <div className="code-hint">Tap to copy</div>
        <p>
          Use this code at{' '}
          <a href={offerUrl} target="_blank" rel="noopener noreferrer">
            {new URL(offerUrl).hostname.replace(/^www\./, '')}
          </a>{' '}
          for your discount.
          {validThroughLabel ? ` Code is valid through ${validThroughLabel}.` : ''}
        </p>
      </div>
    )
  }

  return (
    <form className="offer-form" onSubmit={onSubmit} noValidate>
      <div className="form-row">
        <div className="form-field">
          <label htmlFor="first-name">First name</label>
          <input
            id="first-name"
            type="text"
            placeholder="First name"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={submitting}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="last-name">Last name</label>
          <input
            id="last-name"
            type="text"
            placeholder="Last name"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={submitting}
            required
          />
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          placeholder="you@email.com"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          required
        />
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <button type="submit" className="btn-unlock" disabled={submitting}>
        {submitting ? 'Unlocking…' : 'Unlock my discount →'}
      </button>

      <p className="consent-text">
        {consentText}{' '}
        <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
          {sponsorName} privacy policy
        </a>
        .
      </p>
    </form>
  )
}
