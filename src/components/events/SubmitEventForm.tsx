'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Check, Info } from 'lucide-react'
import { EVENT_TYPES, TYPE_FILTER_ORDER, TAG_META, PACE_BAND_LABEL, isRideEvent } from '@/lib/events'
import { tagInk } from '@/lib/events-tone'
import { PILL } from '@/components/org/Section'
import { toneClass, type EventsTone } from './EventsTone'
import './events-tone.css'

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
  pace: string
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
  pace: '', organizerName: '', organizerUrl: '', eventUrl: '', registrationUrl: '',
  contactName: '', contactEmail: '', contactPhone: '',
  feedType: 'not_applicable', feedUrl: '',
}

const PACE_OPTIONS = ['kids', 'relaxed', 'moderate', 'brisk', 'fast'] as const

type OrganizerSuggestion = { id: string; name: string; url: string | null }

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

// Mirrors the window the API accepts, so typos get caught before submitting.
const MAX_DAYS_AHEAD = 730

// Everything else paints from the `--ev-*` variables; these are the slots
// where cream changes the typography or the button shape, not just the color.
const FORM: Record<EventsTone, { eyebrow: string; h1: string; lede: string; legend: string; thanks: string; primary: string; secondary: string }> = {
  dark: {
    eyebrow: 'text-[11px] font-bold uppercase tracking-[0.14em] text-(--ev-accent)',
    h1: 'mt-3 font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.1] tracking-tight text-(--ev-ink)',
    lede: 'mt-4 max-w-[600px] text-[15px] leading-relaxed text-(--ev-ink-70)',
    legend: 'float-left w-full font-display text-lg font-bold text-(--ev-ink)',
    thanks: 'font-display text-2xl font-bold text-(--ev-ink)',
    primary: 'rounded-[10px] bg-(--ev-accent-fill) px-6 py-2.5 text-[13px] font-bold text-(--ev-on-accent-fill) transition-opacity hover:opacity-85 disabled:opacity-50',
    secondary: 'rounded-[10px] border border-(--ev-line-strong) px-5 py-2.5 text-[13px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)',
  },
  light: {
    eyebrow: 'text-[11px] font-semibold uppercase tracking-[0.14em] text-forest',
    h1: 'mt-3 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy',
    lede: 'mt-4 max-w-[600px] text-[1.0625rem] leading-[1.6] text-ink-soft',
    legend: 'float-left w-full font-serif text-[1.375rem] leading-tight text-navy',
    thanks: 'font-serif text-[1.75rem] leading-tight text-navy',
    primary: `${PILL} disabled:opacity-50`,
    secondary: 'inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]',
  },
}

interface SubmitEventFormProps {
  /** `light` is the cream site; `dark` (default) is the app-dark original. */
  tone?: EventsTone
  /** Where "Back to events" and "Cancel" point. */
  hrefBase?: string
}

export default function SubmitEventForm({ tone = 'dark', hrefBase = '/events' }: SubmitEventFormProps = {}) {
  const t = FORM[tone]
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [noDrop, setNoDrop] = useState(false)
  // The organizer picked from the suggestions, if any; cleared when the name is edited by hand.
  const [organizerId, setOrganizerId] = useState<string | null>(null)
  const [organizerSuggestions, setOrganizerSuggestions] = useState<OrganizerSuggestion[]>([])
  const [organizerOpen, setOrganizerOpen] = useState(false)
  const organizerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const organizerBox = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedAt = useRef(0)

  // Stamped on mount rather than during render so it reflects when this person
  // actually opened the form, not when the page was rendered or cached.
  useEffect(() => {
    loadedAt.current = Date.now()
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (organizerBox.current && !organizerBox.current.contains(e.target as Node)) setOrganizerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const searchOrganizers = (q: string) => {
    if (organizerTimer.current) clearTimeout(organizerTimer.current)
    if (q.trim().length < 2) { setOrganizerSuggestions([]); setOrganizerOpen(false); return }
    organizerTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/organizers?q=${encodeURIComponent(q.trim())}`)
        const data = await res.json()
        const items: OrganizerSuggestion[] = data.organizers ?? []
        setOrganizerSuggestions(items)
        setOrganizerOpen(items.length > 0)
      } catch {
        setOrganizerSuggestions([])
      }
    }, 250)
  }

  const pickOrganizer = (o: OrganizerSuggestion) => {
    setOrganizerId(o.id)
    setForm((f) => ({ ...f, organizerName: o.name, organizerUrl: f.organizerUrl.trim() || o.url || '' }))
    setOrganizerSuggestions([])
    setOrganizerOpen(false)
  }

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
    if (form.date) {
      const picked = new Date(`${form.date}T12:00:00`)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const maxDate = new Date(today.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000)
      if (Number.isNaN(picked.getTime())) {
        errs.date = 'Enter a valid date.'
      } else if (picked < today) {
        errs.date = 'That date has already passed. Pick an upcoming date.'
      } else if (picked > maxDate) {
        errs.date = 'Pick a date within the next two years.'
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      showToast('Please check the highlighted fields.')
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
        body: JSON.stringify({
          ...form,
          tags: selectedTags,
          noDrop: isRideEvent(form.eventType) ? noDrop : false,
          organizerId,
          website: honeypot,
          formLoadedAt: loadedAt.current,
        }),
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
    `w-full rounded-lg border bg-(--ev-input) px-3 py-2.5 text-[14px] text-(--ev-ink) placeholder:text-(--ev-ink-60) focus:outline-none transition-colors ${
      errors[field] ? 'border-(--ev-danger) focus:border-(--ev-danger)' : 'border-(--ev-line-mid) focus:border-(--ev-accent)'
    }`

  const labelClass = 'block mb-1.5 text-[13px] font-semibold text-(--ev-ink-80)'

  // --- Success state ---

  if (submitted) {
    return (
      <div className={`min-h-screen bg-(--ev-bg) px-8 pb-24 pt-12 ${toneClass(tone)}`}>
        <div className="mx-auto max-w-[600px]">
          <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-(--ev-accent-fill)">
              <Check size={28} className="text-(--ev-on-accent-fill)" />
            </div>
            <h2 className={t.thanks}>Thanks — your event is in.</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-(--ev-ink-70)">
              We&apos;ll review it for completeness and relevance and let you know at{' '}
              <span className="font-semibold text-(--ev-ink)">{submittedEmail}</span> when it&apos;s live.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href={hrefBase} className={t.secondary}>
                Back to events
              </Link>
              <button
                onClick={() => { setForm(EMPTY_FORM); setSelectedTags([]); setNoDrop(false); setOrganizerId(null); setErrors({}); setSubmitted(false) }}
                className={t.primary}
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
    <div className={`min-h-screen bg-(--ev-bg) px-8 pb-24 pt-12 ${toneClass(tone)}`}>
      <div className="mx-auto max-w-[760px]">
        <p className={t.eyebrow}>Submit to the calendar</p>
        <h1 className={t.h1}>
          Submit your event for review.
        </h1>
        <p className={t.lede}>
          Group ride, walking tour, e-bike demo, civic action — if it gets people moving by active transportation, we want it on the calendar. Fill in what you can; we&apos;ll review your event for completeness and relevance and notify you when it&apos;s been added.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-8">
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

          {/* Section 1: The basics */}
          <fieldset className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-6">
            <legend className={`mb-4 ${t.legend}`}>The basics</legend>
            <div className="clear-both flex flex-col gap-5">
              <div>
                <label className={labelClass}>Event title <span className="text-(--ev-accent)">*</span></label>
                <input type="text" value={form.title} onChange={set('title')} className={inputClass('title')} placeholder="e.g. Critical Mass Boston" />
                {errors.title && <p className="mt-1 text-[12px] text-(--ev-danger)">{errors.title}</p>}
              </div>
              <div>
                <label className={labelClass}>Event type <span className="text-(--ev-accent)">*</span></label>
                <select value={form.eventType} onChange={set('eventType')} className={inputClass('eventType')} style={{ colorScheme: tone }}>
                  <option value="">Select a type</option>
                  {TYPE_FILTER_ORDER.map((t) => (
                    <option key={t} value={t}>{EVENT_TYPES[t]?.label ?? t}</option>
                  ))}
                </select>
                {errors.eventType && <p className="mt-1 text-[12px] text-(--ev-danger)">{errors.eventType}</p>}
              </div>
              <div>
                <label className={labelClass}>Distance / length</label>
                <input type="text" value={form.length} onChange={set('length')} className={inputClass('length')} placeholder="e.g. 12 miles, 2 km loop" />
              </div>
              {isRideEvent(form.eventType) && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Pace</label>
                    <select value={form.pace} onChange={set('pace')} className={inputClass('pace')} style={{ colorScheme: tone }}>
                      <option value="">Not sure / varies</option>
                      {PACE_OPTIONS.map((p) => (
                        <option key={p} value={p}>{PACE_BAND_LABEL[p]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className={labelClass}>Drop policy</span>
                    <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg border border-(--ev-line-mid) px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={noDrop}
                        onChange={(e) => setNoDrop(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-(--ev-accent)"
                      />
                      <span className="text-[13px] leading-snug text-(--ev-ink-80)">
                        <span className="font-semibold text-(--ev-ink)">No-drop ride.</span> The group waits, or a sweep rides at the back.
                      </span>
                    </label>
                  </div>
                </div>
              )}
              <div>
                <label className={labelClass}>Description <span className="text-(--ev-accent)">*</span></label>
                <textarea value={form.description} onChange={set('description')} rows={4} className={inputClass('description')} placeholder="What happens, who it's for, what to bring…" />
                {errors.description && <p className="mt-1 text-[12px] text-(--ev-danger)">{errors.description}</p>}
              </div>
            </div>
          </fieldset>

          {/* Tags */}
          <fieldset className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-6">
            <legend className={`mb-1 ${t.legend}`}>Who is it for?</legend>
            <p className="clear-both mb-4 text-[13px] text-(--ev-ink-60)">Select all that apply. Helps people find the right events.</p>
            <div className="flex flex-wrap gap-2">
              {(['free', 'beginner_friendly', 'family_friendly', 'students', 'seniors', 'lgbtq', 'women', 'registration_required', 'spanish', 'bilingual', 'advocacy'] as const).map(tag => {
                const tm = TAG_META[tag]
                const ti = tagInk(tm, tone)
                const active = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className="rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all"
                    style={{
                      borderColor: active ? ti.color : 'var(--ev-line-mid)',
                      backgroundColor: active ? ti.bg : 'transparent',
                      color: active ? ti.color : 'var(--ev-ink-60)',
                    }}
                  >
                    {tm.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {/* Section 2: When & where */}
          <fieldset className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-6">
            <legend className={`mb-4 ${t.legend}`}>When &amp; where</legend>
            <div className="clear-both grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Date <span className="text-(--ev-accent)">*</span></label>
                <input type="date" value={form.date} onChange={set('date')} className={inputClass('date')} style={{ colorScheme: tone }} />
                {errors.date && <p className="mt-1 text-[12px] text-(--ev-danger)">{errors.date}</p>}
              </div>
              <div>
                <label className={labelClass}>Start time <span className="text-(--ev-accent)">*</span></label>
                <input type="time" value={form.startTime} onChange={set('startTime')} className={inputClass('startTime')} style={{ colorScheme: tone }} />
                {errors.startTime && <p className="mt-1 text-[12px] text-(--ev-danger)">{errors.startTime}</p>}
              </div>
              <div>
                <label className={labelClass}>End time</label>
                <input type="time" value={form.endTime} onChange={set('endTime')} className={inputClass('endTime')} style={{ colorScheme: tone }} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Venue / meeting point <span className="text-(--ev-accent)">*</span></label>
                <input type="text" value={form.venueName} onChange={set('venueName')} className={inputClass('venueName')} placeholder="e.g. Davis Square Plaza" />
                {errors.venueName && <p className="mt-1 text-[12px] text-(--ev-danger)">{errors.venueName}</p>}
              </div>
              <div>
                <label className={labelClass}>Town / city <span className="text-(--ev-accent)">*</span></label>
                <input type="text" value={form.city} onChange={set('city')} className={inputClass('city')} placeholder="e.g. Somerville" />
                {errors.city && <p className="mt-1 text-[12px] text-(--ev-danger)">{errors.city}</p>}
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
            <div className="mt-3 flex items-start gap-2 text-[12px] text-(--ev-ink-60)">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>Coordinates power the map pin and directions link. You can find them on Google Maps by right-clicking a location.</span>
            </div>
          </fieldset>

          {/* Section 3: Links & contact */}
          <fieldset className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-6">
            <legend className={`mb-1 ${t.legend}`}>Links &amp; contact</legend>
            <p className="clear-both mb-4 text-[13px] text-(--ev-ink-60)">
              Organized with us before? Start typing your organization and pick it from the list: we&apos;ll fill in the website and file this event with your others.
            </p>
            <div className="flex flex-col gap-5">
              <div ref={organizerBox} className="relative">
                <label className={labelClass}>Organizer name</label>
                <input
                  type="text"
                  value={form.organizerName}
                  onChange={(e) => { set('organizerName')(e); setOrganizerId(null); searchOrganizers(e.target.value) }}
                  onFocus={() => { if (organizerSuggestions.length > 0) setOrganizerOpen(true) }}
                  className={inputClass('organizerName')}
                  placeholder="e.g. Somerville Bike Co-op"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={organizerOpen}
                  aria-autocomplete="list"
                />
                {organizerOpen && (
                  <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-(--ev-line-12) bg-(--ev-menu) shadow-(--ev-shadow)" role="listbox">
                    {organizerSuggestions.map((o) => (
                      <li key={o.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickOrganizer(o)}
                          className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[13px] text-(--ev-ink) hover:bg-(--ev-panel)"
                        >
                          <span className="truncate">{o.name}</span>
                          {o.url && <span className="shrink-0 truncate text-[11px] text-(--ev-ink-60)">{o.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {organizerId && (
                  <p className="mt-1 text-[12px] text-(--ev-accent)">Matched to an organizer we know. Its events will be listed together.</p>
                )}
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
                  <label className={labelClass}>Contact email <span className="text-(--ev-accent)">*</span></label>
                  <input type="email" value={form.contactEmail} onChange={set('contactEmail')} className={inputClass('contactEmail')} placeholder="you@example.com" />
                  {errors.contactEmail && <p className="mt-1 text-[12px] text-(--ev-danger)">{errors.contactEmail}</p>}
                </div>
                <div>
                  <label className={labelClass}>Contact phone</label>
                  <input type="tel" value={form.contactPhone} onChange={set('contactPhone')} className={inputClass('contactPhone')} />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Section 4: Recurring source */}
          <fieldset className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-6">
            <legend className={`mb-1 ${t.legend}`}>Post events regularly?</legend>
            <p className="clear-both mb-4 text-[13px] text-(--ev-ink-60)">
              If you have an iCal feed or Google Calendar, we can sync your events automatically. Websites and social feeds are reviewed before events go live.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Source type</label>
                <select value={form.feedType} onChange={set('feedType')} className={inputClass('feedType')} style={{ colorScheme: tone }}>
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
            <p className="text-[12px] text-(--ev-ink-60)"><span className="text-(--ev-accent)">*</span> Required fields</p>
            <div className="flex gap-3">
              <Link href={hrefBase} className={t.secondary}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className={t.primary}
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
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-(--ev-line-mid) bg-(--ev-toast) px-5 py-3 text-[13px] font-medium text-(--ev-ink-on-toast) shadow-(--ev-shadow)"
          style={{ animation: 'animate-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
