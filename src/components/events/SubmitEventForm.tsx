'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Check, Info } from 'lucide-react'
import { EVENT_TYPES, TYPE_FILTER_ORDER, TAG_META } from '@/lib/events'

interface FormData {
  title: string
  eventType: string
  length: string
  description: string
  date: string
  startTime: string
  endTime: string
  venueName: string
  city: string
  address: string
  lat: string
  lng: string
  organizerName: string
  organizerUrl: string
  eventUrl: string
  registrationUrl: string
  contactName: string
  contactEmail: string
  contactPhone: string
  feedType: string
  feedUrl: string
}

const EMPTY_FORM: FormData = {
  title: '', eventType: '', length: '', description: '',
  date: '', startTime: '', endTime: '',
  venueName: '', city: '', address: '', lat: '', lng: '',
  organizerName: '', organizerUrl: '', eventUrl: '', registrationUrl: '',
  contactName: '', contactEmail: '', contactPhone: '',
  feedType: 'not_applicable', feedUrl: '',
}

const FEED_TYPE_OPTIONS = [
  { value: 'not_applicable', label: 'Not applicable' },
  { value: 'ical', label: 'iCal / ICS feed' },
  { value: 'google_calendar', label: 'Google Calendar' },
  { value: 'website', label: 'Website / events page' },
  { value: 'social', label: 'Social media feed' },
  { value: 'other', label: 'Other' },
]

const REQUIRED: (keyof FormData)[] = ['title', 'eventType', 'description', 'date', 'startTime', 'venueName', 'city', 'contactEmail']

const FIELD_MESSAGES: Record<string, string> = {
  title: 'Please add an event title.',
  eventType: 'Pick an event type.',
  description: 'A short description helps neighbors decide.',
  date: 'Pick a date.',
  startTime: 'Add a start time.',
  venueName: 'Where do people meet?',
  city: 'Which town or city?',
  contactEmail: 'We need a way to reach you.',
}

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

export default function SubmitEventForm() {
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    if (errors[field]) setErrors((err) => { const n = { ...err }; delete n[field]; return n })
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {}
    for (const field of REQUIRED) {
      if (!form[field].trim()) errs[field] = FIELD_MESSAGES[field] ?? 'Required'
    }
    if (form.contactEmail && !isValidEmail(form.contactEmail)) {
      errs.contactEmail = 'Enter a valid email address.'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      showToast('Please fill in the required fields.')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/events/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags: selectedTags }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSubmittedEmail(form.contactEmail)
      setSubmitted(true)
    } catch {
      showToast('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (field: keyof FormData) =>
    `w-full rounded-lg border bg-[#1F2034] px-3 py-2.5 text-[14px] text-white placeholder:text-white/50 focus:outline-none transition-colors ${
      errors[field] ? 'border-[#FF6B6B] focus:border-[#FF6B6B]' : 'border-white/[0.14] focus:border-lime'
    }`

  const labelClass = 'block mb-1.5 text-[13px] font-semibold text-white/80'

  // --- Success state ---

  if (submitted) {
    return (
      <div className="min-h-screen bg-navy px-8 pb-24 pt-12">
        <div className="mx-auto max-w-[600px]">
          <div className="rounded-2xl border border-white/[0.07] bg-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lime">
              <Check size={28} className="text-navy" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white">Thanks — your event is in.</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-white/70">
              We&apos;ll review it for completeness and relevance and let you know at{' '}
              <span className="font-semibold text-white">{submittedEmail}</span> when it&apos;s live.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/events" className="rounded-[10px] border border-white/[0.18] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.06]">
                Back to events
              </Link>
              <button
                onClick={() => { setForm(EMPTY_FORM); setSelectedTags([]); setErrors({}); setSubmitted(false) }}
                className="rounded-[10px] bg-lime px-5 py-2.5 text-[13px] font-bold text-navy transition-opacity hover:opacity-85"
              >
                Submit another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Form ---

  return (
    <div className="min-h-screen bg-navy px-8 pb-24 pt-12">
      <div className="mx-auto max-w-[760px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">Submit to the calendar</p>
        <h1 className="mt-3 font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.1] tracking-tight text-white">
          Submit your event for review.
        </h1>
        <p className="mt-4 max-w-[600px] text-[15px] leading-relaxed text-white/70">
          Group ride, walking tour, e-bike demo, civic action — if it gets people moving by active transportation, we want it on the calendar. Fill in what you can; we&apos;ll review your event for completeness and relevance and notify you when it&apos;s been added.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-8">
          {/* Section 1: The basics */}
          <fieldset className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <legend className="mb-4 font-display text-lg font-bold text-white">The basics</legend>
            <div className="flex flex-col gap-5">
              <div>
                <label className={labelClass}>Event title <span className="text-lime">*</span></label>
                <input type="text" value={form.title} onChange={set('title')} className={inputClass('title')} placeholder="e.g. Critical Mass Boston" />
                {errors.title && <p className="mt-1 text-[12px] text-[#FF6B6B]">{errors.title}</p>}
              </div>
              <div>
                <label className={labelClass}>Event type <span className="text-lime">*</span></label>
                <select value={form.eventType} onChange={set('eventType')} className={inputClass('eventType')} style={{ colorScheme: 'dark' }}>
                  <option value="">Select a type</option>
                  {TYPE_FILTER_ORDER.map((t) => (
                    <option key={t} value={t}>{EVENT_TYPES[t]?.label ?? t}</option>
                  ))}
                </select>
                {errors.eventType && <p className="mt-1 text-[12px] text-[#FF6B6B]">{errors.eventType}</p>}
              </div>
              <div>
                <label className={labelClass}>Distance / length</label>
                <input type="text" value={form.length} onChange={set('length')} className={inputClass('length')} placeholder="e.g. 12 miles, 2 km loop" />
              </div>
              <div>
                <label className={labelClass}>Description <span className="text-lime">*</span></label>
                <textarea value={form.description} onChange={set('description')} rows={4} className={inputClass('description')} placeholder="What happens, who it's for, what to bring…" />
                {errors.description && <p className="mt-1 text-[12px] text-[#FF6B6B]">{errors.description}</p>}
              </div>
            </div>
          </fieldset>

          {/* Tags */}
          <fieldset className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <legend className="mb-1 font-display text-lg font-bold text-white">Who is it for?</legend>
            <p className="mb-4 text-[13px] text-white/60">Select all that apply. Helps people find the right events.</p>
            <div className="flex flex-wrap gap-2">
              {(['free', 'beginner_friendly', 'family_friendly', 'seniors', 'lgbtq', 'women', 'registration_required', 'spanish', 'bilingual'] as const).map(tag => {
                const tm = TAG_META[tag]
                const active = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className="rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all"
                    style={{
                      borderColor: active ? tm.color : 'rgba(255,255,255,0.14)',
                      backgroundColor: active ? tm.bg : 'transparent',
                      color: active ? tm.color : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {tm.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {/* Section 2: When & where */}
          <fieldset className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <legend className="mb-4 font-display text-lg font-bold text-white">When &amp; where</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Date <span className="text-lime">*</span></label>
                <input type="date" value={form.date} onChange={set('date')} className={inputClass('date')} style={{ colorScheme: 'dark' }} />
                {errors.date && <p className="mt-1 text-[12px] text-[#FF6B6B]">{errors.date}</p>}
              </div>
              <div>
                <label className={labelClass}>Start time <span className="text-lime">*</span></label>
                <input type="time" value={form.startTime} onChange={set('startTime')} className={inputClass('startTime')} style={{ colorScheme: 'dark' }} />
                {errors.startTime && <p className="mt-1 text-[12px] text-[#FF6B6B]">{errors.startTime}</p>}
              </div>
              <div>
                <label className={labelClass}>End time</label>
                <input type="time" value={form.endTime} onChange={set('endTime')} className={inputClass('endTime')} style={{ colorScheme: 'dark' }} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Venue / meeting point <span className="text-lime">*</span></label>
                <input type="text" value={form.venueName} onChange={set('venueName')} className={inputClass('venueName')} placeholder="e.g. Davis Square Plaza" />
                {errors.venueName && <p className="mt-1 text-[12px] text-[#FF6B6B]">{errors.venueName}</p>}
              </div>
              <div>
                <label className={labelClass}>Town / city <span className="text-lime">*</span></label>
                <input type="text" value={form.city} onChange={set('city')} className={inputClass('city')} placeholder="e.g. Somerville" />
                {errors.city && <p className="mt-1 text-[12px] text-[#FF6B6B]">{errors.city}</p>}
              </div>
              <div>
                <label className={labelClass}>Street address</label>
                <input type="text" value={form.address} onChange={set('address')} className={inputClass('address')} placeholder="Optional" />
              </div>
              <div>
                <label className={labelClass}>Latitude</label>
                <input type="text" value={form.lat} onChange={set('lat')} className={inputClass('lat')} placeholder="e.g. 42.3960" />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input type="text" value={form.lng} onChange={set('lng')} className={inputClass('lng')} placeholder="e.g. -71.1225" />
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-[12px] text-white/50">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>Coordinates power the map pin and directions link. You can find them on Google Maps by right-clicking a location.</span>
            </div>
          </fieldset>

          {/* Section 3: Links & contact */}
          <fieldset className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <legend className="mb-1 font-display text-lg font-bold text-white">Links &amp; contact</legend>
            <p className="mb-4 text-[13px] text-white/60">
              Organized something with us before? Start typing your organization — we&apos;ll fill in the rest from your last submission.
            </p>
            <div className="flex flex-col gap-5">
              <div>
                <label className={labelClass}>Organizer name</label>
                <input type="text" value={form.organizerName} onChange={set('organizerName')} className={inputClass('organizerName')} placeholder="e.g. Somerville Bike Co-op" />
              </div>
              <div>
                <label className={labelClass}>Organizer website</label>
                <input type="url" value={form.organizerUrl} onChange={set('organizerUrl')} className={inputClass('organizerUrl')} placeholder="https://…" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Event info link</label>
                  <input type="url" value={form.eventUrl} onChange={set('eventUrl')} className={inputClass('eventUrl')} placeholder="https://…" />
                </div>
                <div>
                  <label className={labelClass}>Registration link</label>
                  <input type="url" value={form.registrationUrl} onChange={set('registrationUrl')} className={inputClass('registrationUrl')} placeholder="https://…" />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Contact name</label>
                  <input type="text" value={form.contactName} onChange={set('contactName')} className={inputClass('contactName')} />
                </div>
                <div>
                  <label className={labelClass}>Contact email <span className="text-lime">*</span></label>
                  <input type="email" value={form.contactEmail} onChange={set('contactEmail')} className={inputClass('contactEmail')} placeholder="you@example.com" />
                  {errors.contactEmail && <p className="mt-1 text-[12px] text-[#FF6B6B]">{errors.contactEmail}</p>}
                </div>
                <div>
                  <label className={labelClass}>Contact phone</label>
                  <input type="tel" value={form.contactPhone} onChange={set('contactPhone')} className={inputClass('contactPhone')} />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Section 4: Recurring source */}
          <fieldset className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <legend className="mb-1 font-display text-lg font-bold text-white">Post events regularly?</legend>
            <p className="mb-4 text-[13px] text-white/60">
              If you have an iCal feed or Google Calendar, we can sync your events automatically. Websites and social feeds are reviewed before events go live.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Source type</label>
                <select value={form.feedType} onChange={set('feedType')} className={inputClass('feedType')} style={{ colorScheme: 'dark' }}>
                  {FEED_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {form.feedType !== 'not_applicable' && (
                <div>
                  <label className={labelClass}>Feed / calendar / profile URL</label>
                  <input type="url" value={form.feedUrl} onChange={set('feedUrl')} className={inputClass('feedUrl')} placeholder="https://…" />
                </div>
              )}
            </div>
          </fieldset>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-white/50"><span className="text-lime">*</span> Required fields</p>
            <div className="flex gap-3">
              <Link href="/events" className="rounded-[10px] border border-white/[0.18] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.06]">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-[10px] bg-lime px-6 py-2.5 text-[13px] font-bold text-navy transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/[0.14] bg-[#2E2F45] px-5 py-3 text-[13px] font-medium text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{ animation: 'animate-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
