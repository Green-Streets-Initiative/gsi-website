'use client'

import { useEffect, useRef, useState } from 'react'
import { EnvelopeSimple } from '@phosphor-icons/react'
import { gaEvent } from '@/lib/ga'
import { EMAIL_RE, isPersonalEmail } from '@/lib/employer/team-challenge'
import { websiteUrl } from '@/lib/employer/team-challenge-domain'

type Field = 'company' | 'website' | 'name' | 'email' | 'headcount'

const INPUT =
  'w-full min-h-[48px] rounded-[10px] border-2 border-navy/[0.16] bg-white px-3.5 text-[16px] text-navy placeholder:text-ink-tertiary focus:border-forest focus:outline-none'
const LABEL = 'mb-1.5 block text-[15px] font-bold text-navy'
const ERROR = 'mt-1.5 text-[14px] font-bold text-[#B3361F]'

export default function SignupForm() {
  const [values, setValues] = useState({ company: '', website: '', name: '', email: '', headcount: '' })
  // Honeypot: hidden from people, filled in by bots. Named so a browser never autofills it.
  const [fax, setFax] = useState('')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const sentRef = useRef<HTMLDivElement>(null)
  // The sent card is shorter than the form; bring it into view.
  useEffect(() => {
    if (sentTo) sentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [sentTo])

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
  }

  function check(): Partial<Record<Field, string>> {
    const e: Partial<Record<Field, string>> = {}
    if (values.company.trim().length < 2) e.company = 'Enter your company’s name.'
    if (!websiteUrl(values.website)) e.website = 'Enter your company’s website, like acme.com.'
    if (!values.name.trim()) e.name = 'Enter your name.'
    const email = values.email.trim()
    if (!EMAIL_RE.test(email)) e.email = 'Enter your work email.'
    else if (isPersonalEmail(email)) e.email = 'Use your work email, so the team belongs to your company.'
    const n = Number(values.headcount)
    if (!values.headcount || !Number.isFinite(n) || n < 1) e.headcount = 'Enter about how many people work there.'
    return e
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = check()
    setErrors(e)
    setFormError(null)
    if (Object.keys(e).length > 0) {
      document.getElementById(`tc-${Object.keys(e)[0]}`)?.focus()
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/employer/team-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, fax }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; field?: Field }
      if (!res.ok || !data.ok) {
        if (data.field) setErrors({ [data.field]: data.error })
        else setFormError(data.error ?? 'Something went wrong. Try again.')
        return
      }
      gaEvent('employer_inquiry', { source: 'team_challenge', team_size: values.headcount })
      setSentTo(values.email.trim())
    } catch {
      setFormError('We couldn’t reach the server. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  if (sentTo) {
    return (
      <div ref={sentRef} className="rounded-[16px] border-2 border-navy/[0.12] bg-white p-6 sm:p-8" role="status">
        <EnvelopeSimple size={36} weight="duotone" className="text-forest" aria-hidden />
        <h2 className="mt-3 font-headline text-[1.6rem] font-extrabold leading-tight text-navy">Check your email</h2>
        <p className="mt-3 text-[1.0625rem] leading-[1.6] text-ink-soft">
          We sent a link to <b className="text-navy">{sentTo}</b>. Click it and your invite code is ready.
        </p>
        <p className="mt-3 text-[15px] leading-[1.6] text-ink-soft">
          Nothing there in a few minutes? Check your spam folder, or{' '}
          <button type="button" onClick={() => setSentTo(null)} className="font-bold text-forest underline-offset-4 hover:underline">
            try again
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="relative rounded-[16px] border-2 border-navy/[0.12] bg-white p-6 sm:p-8">
      <h2 className="font-headline text-[1.6rem] font-extrabold leading-tight text-navy">Get your invite code</h2>
      <p className="mt-2 text-[15px] leading-[1.55] text-ink-soft">Free, with nothing to sign. We email you a link to confirm, and your code is ready.</p>

      <div className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="tc-company" className={LABEL}>Company</label>
          <input id="tc-company" className={INPUT} value={values.company} onChange={set('company')} autoComplete="organization" aria-invalid={!!errors.company} aria-describedby={errors.company ? 'tc-company-err' : undefined} />
          {errors.company && <p id="tc-company-err" className={ERROR}>{errors.company}</p>}
        </div>
        <div>
          <label htmlFor="tc-website" className={LABEL}>Company website</label>
          <input id="tc-website" type="url" inputMode="url" className={INPUT} value={values.website} onChange={set('website')} autoComplete="url" placeholder="yourcompany.com" aria-invalid={!!errors.website} aria-describedby={errors.website ? 'tc-website-err' : undefined} />
          {errors.website && <p id="tc-website-err" className={ERROR}>{errors.website}</p>}
        </div>
        <div>
          <label htmlFor="tc-name" className={LABEL}>Your name</label>
          <input id="tc-name" className={INPUT} value={values.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'tc-name-err' : undefined} />
          {errors.name && <p id="tc-name-err" className={ERROR}>{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="tc-email" className={LABEL}>Work email</label>
          <input id="tc-email" type="email" inputMode="email" className={INPUT} value={values.email} onChange={set('email')} autoComplete="email" placeholder="you@yourcompany.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'tc-email-err' : undefined} />
          {errors.email && <p id="tc-email-err" className={ERROR}>{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="tc-headcount" className={LABEL}>About how many people work there?</label>
          <input id="tc-headcount" type="number" inputMode="numeric" min={1} className={`${INPUT} max-w-[200px]`} value={values.headcount} onChange={set('headcount')} aria-invalid={!!errors.headcount} aria-describedby={errors.headcount ? 'tc-headcount-err' : undefined} />
          {errors.headcount && <p id="tc-headcount-err" className={ERROR}>{errors.headcount}</p>}
        </div>
        {/* Honeypot: hidden from people, filled in by bots. */}
        <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
          <label htmlFor="tc-fax">Fax</label>
          <input id="tc-fax" tabIndex={-1} autoComplete="off" value={fax} onChange={(e) => setFax(e.target.value)} />
        </div>
      </div>

      {formError && <p className={`${ERROR} mt-4`} role="alert">{formError}</p>}

      <button
        type="submit"
        disabled={sending}
        className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-navy px-7 text-[17px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Get our invite code'}
      </button>
      <p className="mt-3 text-[14px] leading-[1.5] text-ink-soft">
        No work email? Write to <a href="mailto:info@gogreenstreets.org" className="font-bold text-forest underline-offset-4 hover:underline">info@gogreenstreets.org</a>.
      </p>
    </form>
  )
}
