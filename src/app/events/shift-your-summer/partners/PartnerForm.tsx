'use client'

import { useState } from 'react'
import { Check } from '@phosphor-icons/react'
import { PILL } from '@/components/org/Section'

type Tier = 'community' | 'champion' | 'presenting' | 'custom'
type PrizeCategory = 'grand' | 'weekly' | 'catalog' | 'unsure'
type TeamSize = '1-50' | '51-250' | '251-1000' | '1000+'

interface FormState {
  firstName: string
  lastName: string
  company: string
  title: string
  email: string
  phone: string
  isSponsor: boolean
  isPrizeDonor: boolean
  isTeamParticipant: boolean
  tier: Tier | ''
  prizeCategory: PrizeCategory | ''
  prizeDescription: string
  prizeValue: string
  prizeQuantity: string
  teamSize: TeamSize | ''
  notes: string
  logo: File | null
  website: string // honeypot
}

const initialState: FormState = {
  firstName: '',
  lastName: '',
  company: '',
  title: '',
  email: '',
  phone: '',
  isSponsor: false,
  isPrizeDonor: false,
  isTeamParticipant: false,
  tier: '',
  prizeCategory: '',
  prizeDescription: '',
  prizeValue: '',
  prizeQuantity: '',
  teamSize: '',
  notes: '',
  logo: null,
  website: '',
}

export default function PartnerForm() {
  const [state, setState] = useState<FormState>(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!state.firstName.trim() || !state.lastName.trim() || !state.company.trim() || !state.email.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    if (!state.isSponsor && !state.isPrizeDonor && !state.isTeamParticipant) {
      setError('Please select at least one partnership type.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('first_name', state.firstName)
      fd.set('last_name', state.lastName)
      fd.set('company', state.company)
      fd.set('title', state.title)
      fd.set('email', state.email)
      fd.set('phone', state.phone)
      fd.set('is_sponsor', state.isSponsor ? 'true' : 'false')
      fd.set('is_prize_donor', state.isPrizeDonor ? 'true' : 'false')
      fd.set('is_team_participant', state.isTeamParticipant ? 'true' : 'false')
      if (state.isSponsor) fd.set('tier', state.tier)
      if (state.isPrizeDonor) {
        fd.set('prize_category', state.prizeCategory)
        fd.set('prize_description', state.prizeDescription)
        fd.set('prize_value', state.prizeValue)
        fd.set('prize_quantity', state.prizeQuantity)
      }
      if (state.isTeamParticipant) fd.set('team_size', state.teamSize)
      fd.set('notes', state.notes)
      if (state.logo) fd.set('logo', state.logo)
      fd.set('website', state.website)

      const res = await fetch('/api/partner-form', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setSubmitted(true)
    } catch (err) {
      console.error(err)
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-[14px] border border-navy/10 p-12 text-center">
        <div className="text-3xl mb-4 flex justify-center text-forest"><Check size={36} weight="bold" /></div>
        <h3 className="font-serif text-[1.375rem] leading-tight text-navy mb-3">Thank you!</h3>
        <p className="text-[1.0625rem] text-ink-soft leading-[1.7] max-w-[440px] mx-auto">
          We&rsquo;ve received your interest in partnering on a future campaign. Keith will
          follow up within two business days with next steps.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-[14px] border border-navy/10 p-8 md:p-10 space-y-8"
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
            value={state.website}
            onChange={(e) => update('website', e.target.value)}
          />
        </label>
      </div>

      {/* Contact info */}
      <FormSectionLabel>Your information</FormSectionLabel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name" required>
          <Input value={state.firstName} onChange={(v) => update('firstName', v)} required />
        </Field>
        <Field label="Last name" required>
          <Input value={state.lastName} onChange={(v) => update('lastName', v)} required />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Company / Organization" required>
          <Input value={state.company} onChange={(v) => update('company', v)} required />
        </Field>
        <Field label="Title">
          <Input value={state.title} onChange={(v) => update('title', v)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Email" required>
          <Input type="email" value={state.email} onChange={(v) => update('email', v)} required />
        </Field>
        <Field label="Phone" optional>
          <Input type="tel" value={state.phone} onChange={(v) => update('phone', v)} />
        </Field>
      </div>

      <hr className="border-navy/10" />

      {/* Partnership type */}
      <FormSectionLabel>How would you like to partner?</FormSectionLabel>

      <div className="space-y-3">
        <CheckboxOption
          checked={state.isSponsor}
          onChange={(v) => update('isSponsor', v)}
          label="Cash sponsorship"
          description="Brand visibility, team leaderboard, impact reporting · 2026 tiers ran $1,000–$5,000"
        />
        <CheckboxOption
          checked={state.isPrizeDonor}
          onChange={(v) => update('isPrizeDonor', v)}
          label="Prize donation"
          description="Donate products or gift cards as challenge prizes"
        />
        <CheckboxOption
          checked={state.isTeamParticipant}
          onChange={(v) => update('isTeamParticipant', v)}
          label="Team participation"
          description="Get your employees involved with a custom team leaderboard"
        />
      </div>

      {/* Conditional: Sponsorship tier */}
      {state.isSponsor && (
        <div className="space-y-3 pt-4 border-t border-navy/10">
          <Field label="Select a sponsorship tier">
            <div className="space-y-2">
              <TierRadio
                checked={state.tier === 'community'}
                onChange={() => update('tier', 'community')}
                name="Community"
                price="$1,000 · Logo, team link, promo kit, impact report"
              />
              <TierRadio
                checked={state.tier === 'champion'}
                onChange={() => update('tier', 'champion')}
                name="Champion"
                price="$2,500 · App spotlight, email logo, employer platform, team report"
              />
              <TierRadio
                checked={state.tier === 'presenting'}
                onChange={() => update('tier', 'presenting')}
                name="Presenting"
                price="$5,000 · Naming rights, press priority, wrap event, app home screen"
              />
              <TierRadio
                checked={state.tier === 'custom'}
                onChange={() => update('tier', 'custom')}
                name="Custom"
                price="Let's discuss a package that fits your needs"
              />
            </div>
          </Field>
        </div>
      )}

      {/* Conditional: Prize details */}
      {state.isPrizeDonor && (
        <div className="space-y-4 pt-4 border-t border-navy/10">
          <Field label="Prize category">
            <Select
              value={state.prizeCategory}
              onChange={(v) => update('prizeCategory', v as PrizeCategory)}
            >
              <option value="" disabled>Select a category</option>
              <option value="grand">Grand prize ($500+ value)</option>
              <option value="weekly">Weekly or milestone prize ($50–$200 value)</option>
              <option value="catalog">Reward catalog item (ongoing)</option>
              <option value="unsure">Not sure yet — let&apos;s discuss</option>
            </Select>
          </Field>
          <Field label="What would you like to donate?" optional>
            <Input
              value={state.prizeDescription}
              onChange={(v) => update('prizeDescription', v)}
              placeholder="e.g., e-bike, gift cards, tune-up credits"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Estimated value" optional>
              <Input
                value={state.prizeValue}
                onChange={(v) => update('prizeValue', v)}
                placeholder="e.g., $500"
              />
            </Field>
            <Field label="Quantity" optional>
              <Input
                value={state.prizeQuantity}
                onChange={(v) => update('prizeQuantity', v)}
                placeholder="e.g., 1, 5, 10"
              />
            </Field>
          </div>
        </div>
      )}

      {/* Conditional: Team participation */}
      {state.isTeamParticipant && (
        <div className="space-y-4 pt-4 border-t border-navy/10">
          <Field label="Approximate team size" optional>
            <Select
              value={state.teamSize}
              onChange={(v) => update('teamSize', v as TeamSize)}
            >
              <option value="" disabled>Select a range</option>
              <option value="1-50">1–50 employees</option>
              <option value="51-250">51–250 employees</option>
              <option value="251-1000">251–1,000 employees</option>
              <option value="1000+">1,000+ employees</option>
            </Select>
          </Field>
        </div>
      )}

      <hr className="border-navy/10" />

      <Field label="Anything else?" optional>
        <Textarea
          value={state.notes}
          onChange={(v) => update('notes', v)}
          placeholder="Questions, ideas, or anything we should know"
        />
      </Field>

      <Field label="Company logo" optional hint="PNG or SVG preferred · max 5MB">
        <input
          type="file"
          accept=".png,.svg,.jpg,.jpeg,.webp"
          onChange={(e) => update('logo', e.target.files?.[0] ?? null)}
          className="block w-full text-[15px] text-ink-soft file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-navy/[0.06] file:text-navy file:text-sm file:font-semibold hover:file:bg-navy/[0.1] file:cursor-pointer"
        />
      </Field>

      {error && (
        <div className="bg-[#c0392b]/[0.08] border border-[#c0392b]/40 rounded-[12px] px-4 py-3 text-[15px] text-[#8f1d13]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={`${PILL} gap-2 disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {submitting ? 'Submitting…' : 'Submit partnership interest →'}
      </button>

      <p className="text-[15px] text-ink-soft leading-relaxed">
        We&rsquo;ll review your submission and follow up within two business days.
        Submitting this form does not create a binding agreement — we&rsquo;ll send a
        partnership agreement for your review and signature as a next step.
      </p>
    </form>
  )
}

/* ── Reusable field building blocks ──────────────────────── */

function FormSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
      {children}
    </div>
  )
}

function Field({
  label,
  children,
  required,
  optional,
  hint,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  optional?: boolean
  hint?: string
}) {
  return (
    <label className="block">
      <span className="block text-[15px] font-medium text-navy mb-2">
        {label}
        {required && <span className="text-[#c0392b] ml-1">*</span>}
        {optional && <span className="text-ink-soft ml-1">(optional)</span>}
      </span>
      {children}
      {hint && <span className="block mt-1 text-[13px] text-ink-soft">{hint}</span>}
    </label>
  )
}

function Input({
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      placeholder={placeholder}
      className="w-full px-4 py-3 bg-white border border-navy/15 rounded-[10px] text-navy placeholder:text-ink-soft focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest/30"
    />
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 bg-white border border-navy/15 rounded-[10px] text-navy focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest/30"
    >
      {children}
    </select>
  )
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full px-4 py-3 bg-white border border-navy/15 rounded-[10px] text-navy placeholder:text-ink-soft focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest/30 resize-y"
    />
  )
}

function CheckboxOption({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}) {
  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
        checked
          ? 'bg-forest/10 border-forest'
          : 'bg-cream border-navy/10 hover:border-navy/25'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-forest flex-shrink-0"
      />
      <div className="flex-1">
        <div className="text-[15px] font-semibold text-navy">{label}</div>
        <div className="text-[13px] text-ink-soft mt-0.5">{description}</div>
      </div>
    </label>
  )
}

function TierRadio({
  checked,
  onChange,
  name,
  price,
}: {
  checked: boolean
  onChange: () => void
  name: string
  price: string
}) {
  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
        checked
          ? 'bg-blue/10 border-blue'
          : 'bg-cream border-navy/10 hover:border-navy/25'
      }`}
    >
      <input
        type="radio"
        name="tier"
        checked={checked}
        onChange={onChange}
        className="mt-1 w-4 h-4 accent-blue flex-shrink-0"
      />
      <div className="flex-1">
        <div className="text-[15px] font-semibold text-navy">{name}</div>
        <div className="text-[13px] text-ink-soft mt-0.5">{price}</div>
      </div>
    </label>
  )
}
