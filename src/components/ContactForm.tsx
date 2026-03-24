'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const INQUIRY_TYPES = [
  'Employer partnership',
  'School program',
  'Rewards partner (local business)',
  'Media / press',
  'Donate / funding',
  'Volunteer',
  'General / other',
] as const

type InquiryType = (typeof INQUIRY_TYPES)[number]

const INQUIRY_PARAM_MAP: Record<string, InquiryType> = {
  'employer': 'Employer partnership',
  'school': 'School program',
  'rewards-partner': 'Rewards partner (local business)',
  'press': 'Media / press',
  'media': 'Media / press',
  'donate': 'Donate / funding',
  'volunteer': 'Volunteer',
}

const MESSAGE_PLACEHOLDERS: Record<InquiryType, string> = {
  'Employer partnership': 'Tell us about your organization and what you\'re hoping to accomplish.',
  'School program': 'Tell us about your school and what you\'re interested in.',
  'Rewards partner (local business)': 'Tell us about your business and the offer you have in mind.',
  'Media / press': 'Tell us about your story or request.',
  'Donate / funding': 'Tell us about your organization or what you\'d like to support.',
  'Volunteer': 'Tell us about yourself and how you\'d like to help.',
  'General / other': 'What\'s on your mind?',
}

const TEAM_SIZES = ['Under 50', '50–200', '200–500', '500+']
const GRADE_LEVELS = ['K–2', '3–5', '6–8', 'High school']

type FormErrors = Record<string, string>

export default function ContactForm() {
  const searchParams = useSearchParams()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [inquiryType, setInquiryType] = useState<InquiryType>('General / other')
  const [message, setMessage] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [gradeLevels, setGradeLevels] = useState<string[]>([])
  const [businessName, setBusinessName] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [honeypot, setHoneypot] = useState('')

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  // Pre-select inquiry type from query param
  useEffect(() => {
    const param = searchParams.get('inquiry')
    if (param && INQUIRY_PARAM_MAP[param]) {
      setInquiryType(INQUIRY_PARAM_MAP[param])
    }
  }, [searchParams])

  function toggleGradeLevel(level: string) {
    setGradeLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    )
  }

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!email.trim()) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Please enter a valid email address'
    }
    if (!message.trim()) errs.message = 'Message is required'

    if (inquiryType === 'Employer partnership' && !companyName.trim()) {
      errs.companyName = 'Company name is required'
    }
    if (inquiryType === 'School program' && !schoolName.trim()) {
      errs.schoolName = 'School name is required'
    }
    if (inquiryType === 'Rewards partner (local business)' && !businessName.trim()) {
      errs.businessName = 'Business name is required'
    }

    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(false)

    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          inquiryType,
          message: message.trim(),
          companyName: inquiryType === 'Employer partnership' ? companyName.trim() : undefined,
          teamSize: inquiryType === 'Employer partnership' ? teamSize || undefined : undefined,
          schoolName: inquiryType === 'School program' ? schoolName.trim() : undefined,
          gradeLevels: inquiryType === 'School program' && gradeLevels.length > 0 ? gradeLevels : undefined,
          businessName: inquiryType === 'Rewards partner (local business)' ? businessName.trim() : undefined,
          neighborhood: inquiryType === 'Rewards partner (local business)' ? neighborhood.trim() || undefined : undefined,
          website: honeypot,
        }),
      })

      if (!res.ok) throw new Error('Submit failed')
      setSubmitted(true)
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }

  // Success state
  if (submitted) {
    const firstName = name.trim().split(' ')[0]
    return (
      <div className="rounded-2xl bg-card p-8 text-center sm:p-12">
        <div className="mb-4 text-4xl">&#10003;</div>
        <h2 className="font-display text-2xl font-bold text-white">Message sent</h2>
        <p className="mt-3 text-white">
          Thanks, {firstName}. We&apos;ll be in touch within 2 business days.
        </p>
        <div className="mt-8 space-y-3 text-sm">
          <p className="text-white">In the meantime:</p>
          <div className="flex flex-col items-center gap-2">
            <Link href="/shift" className="text-lime hover:underline">
              Learn about the Shift app &rarr;
            </Link>
            <Link href="/programs" className="text-lime hover:underline">
              See our programs &rarr;
            </Link>
            <Link href="/#waitlist" className="text-lime hover:underline">
              Join the waitlist &rarr;
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-card p-6 sm:p-10" noValidate>
      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="website"
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={e => setHoneypot(e.target.value)}
      />

      <div className="space-y-6">
        {/* Name */}
        <Field label="Your name" required error={errors.name}>
          <input
            type="text"
            placeholder="First and last name"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={submitting}
            className="form-input"
          />
        </Field>

        {/* Email */}
        <Field label="Email address" required error={errors.email}>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={submitting}
            className="form-input"
          />
        </Field>

        {/* Inquiry type */}
        <Field label="I'm reaching out about" required>
          <select
            value={inquiryType}
            onChange={e => setInquiryType(e.target.value as InquiryType)}
            disabled={submitting}
            className="form-input"
          >
            {INQUIRY_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </Field>

        {/* Conditional fields */}
        <ConditionalSection show={inquiryType === 'Employer partnership'}>
          <Field label="Company name" required error={errors.companyName}>
            <input
              type="text"
              placeholder="Company name"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              disabled={submitting}
              className="form-input"
            />
          </Field>
          <Field label="Approximate team size">
            <select
              value={teamSize}
              onChange={e => setTeamSize(e.target.value)}
              disabled={submitting}
              className="form-input"
            >
              <option value="">Select...</option>
              {TEAM_SIZES.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </Field>
        </ConditionalSection>

        <ConditionalSection show={inquiryType === 'School program'}>
          <Field label="School name" required error={errors.schoolName}>
            <input
              type="text"
              placeholder="School name"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              disabled={submitting}
              className="form-input"
            />
          </Field>
          <Field label="Grade levels served">
            <div className="flex flex-wrap gap-3">
              {GRADE_LEVELS.map(level => (
                <label key={level} className="flex cursor-pointer items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={gradeLevels.includes(level)}
                    onChange={() => toggleGradeLevel(level)}
                    disabled={submitting}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 accent-lime"
                  />
                  {level}
                </label>
              ))}
            </div>
          </Field>
        </ConditionalSection>

        <ConditionalSection show={inquiryType === 'Rewards partner (local business)'}>
          <Field label="Business name" required error={errors.businessName}>
            <input
              type="text"
              placeholder="Business name"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              disabled={submitting}
              className="form-input"
            />
          </Field>
          <Field label="Neighborhood / city">
            <input
              type="text"
              placeholder="e.g. Cambridge, Somerville"
              value={neighborhood}
              onChange={e => setNeighborhood(e.target.value)}
              disabled={submitting}
              className="form-input"
            />
          </Field>
          <p className="text-sm text-white">
            Prefer to apply directly?{' '}
            <Link href="/shift/rewards-partners" className="text-lime hover:underline">
              Complete the rewards partner application &rarr;
            </Link>
          </p>
        </ConditionalSection>

        {/* Message */}
        <Field label="Message" required error={errors.message}>
          <textarea
            rows={4}
            placeholder={MESSAGE_PLACEHOLDERS[inquiryType]}
            value={message}
            onChange={e => setMessage(e.target.value)}
            disabled={submitting}
            className="form-input resize-y"
          />
        </Field>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-lime px-8 py-3 text-sm font-bold text-navy transition-opacity hover:opacity-85 disabled:opacity-60 sm:w-auto"
          >
            {submitting && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Send message
          </button>
        </div>

        {/* Error message */}
        {submitError && (
          <p className="text-center text-sm text-red-400">
            Something went wrong — please try again or email us directly at{' '}
            <a href="mailto:info@gogreenstreets.org" className="underline">info@gogreenstreets.org</a>
          </p>
        )}
      </div>
    </form>
  )
}

/* ── Helpers ────────────────────────────────────── */

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white">
        {label}
        {required && <span className="ml-0.5 text-lime">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function ConditionalSection({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null
  return (
    <div className="space-y-6 animate-in">
      {children}
    </div>
  )
}
