'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewEventPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    slug: '',
    eyebrow: '',
    organizer_name: '',
    date_primary: '',
    date_rain: '',
    time_start: '14:00',
    time_end: '18:00',
    accent_color: '#D81B60',
    center_lat: '',
    center_lng: '',
    default_zoom: 16,
    locales: ['en'],
    attribution: 'Wayfinding by Green Streets Initiative',
  })

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.slug || !form.date_primary || !form.center_lat || !form.center_lng) {
      setError('Please fill in all required fields')
      return
    }

    setSaving(true)
    setError('')

    const res = await fetch('/api/admin/wayfinding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        eyebrow: form.eyebrow || null,
        organizer_name: form.organizer_name || null,
        date_rain: form.date_rain || null,
        center_lat: parseFloat(form.center_lat),
        center_lng: parseFloat(form.center_lng),
        is_published: false,
      }),
    })

    if (res.ok) {
      const event = await res.json()
      router.push(`/admin/wayfinding/${event.id}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to create event')
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/wayfinding" className="text-white/60 hover:text-white/80 text-sm">
          Events
        </Link>
        <span className="text-white/40">/</span>
        <h1 className="text-xl font-semibold text-white font-[family-name:var(--font-bricolage)]">
          New Event
        </h1>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-6">
        <Section label="Basic Info">
          <Field label="Event Name" required>
            <Input
              value={form.name}
              onChange={v => {
                set('name', v)
                if (!form.slug || form.slug === autoSlug(form.name)) {
                  set('slug', autoSlug(v))
                }
              }}
              placeholder="Carnaval"
            />
          </Field>
          <Field label="URL Slug" required>
            <Input value={form.slug} onChange={v => set('slug', v)} placeholder="carnaval" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Eyebrow">
              <Input value={form.eyebrow} onChange={v => set('eyebrow', v)} placeholder="SomerStreets" />
            </Field>
            <Field label="Accent Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accent_color}
                  onChange={e => set('accent_color', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/[0.12]"
                />
                <Input value={form.accent_color} onChange={v => set('accent_color', v)} />
              </div>
            </Field>
          </div>
          <Field label="Organizer Name">
            <Input value={form.organizer_name} onChange={v => set('organizer_name', v)} placeholder="East Somerville Main Streets" />
          </Field>
        </Section>

        <Section label="Date & Time">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Primary Date" required>
              <Input type="date" value={form.date_primary} onChange={v => set('date_primary', v)} />
            </Field>
            <Field label="Rain Date">
              <Input type="date" value={form.date_rain} onChange={v => set('date_rain', v)} />
            </Field>
            <Field label="Start Time">
              <Input type="time" value={form.time_start} onChange={v => set('time_start', v)} />
            </Field>
            <Field label="End Time">
              <Input type="time" value={form.time_end} onChange={v => set('time_end', v)} />
            </Field>
          </div>
        </Section>

        <Section label="Map Center">
          <p className="text-xs text-white/60 mb-3">
            The map will be centered on these coordinates. Tip: right-click on Google Maps and copy the lat/lng.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Latitude" required>
              <Input type="number" value={form.center_lat} onChange={v => set('center_lat', v)} placeholder="42.3878" />
            </Field>
            <Field label="Longitude" required>
              <Input type="number" value={form.center_lng} onChange={v => set('center_lng', v)} placeholder="-71.0835" />
            </Field>
            <Field label="Zoom">
              <Input type="number" value={String(form.default_zoom)} onChange={v => set('default_zoom', parseInt(v) || 16)} />
            </Field>
          </div>
        </Section>

        <Section label="Localization">
          <Field label="Supported Locales">
            <div className="flex gap-3">
              {['en', 'es', 'pt', 'ht', 'zh'].map(loc => (
                <label key={loc} className="flex items-center gap-1.5 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={form.locales.includes(loc)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...form.locales, loc]
                        : form.locales.filter(l => l !== loc)
                      set('locales', next.length > 0 ? next : ['en'])
                    }}
                    className="rounded bg-white/[0.07] border-white/[0.12]"
                  />
                  {loc.toUpperCase()}
                </label>
              ))}
            </div>
          </Field>
        </Section>

        <div className="flex items-center gap-4 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-[#2966E5] text-white text-sm font-semibold hover:bg-[#2966E5]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating...' : 'Create event'}
          </button>
          <Link href="/admin/wayfinding" className="text-sm text-white/60 hover:text-white/80">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
      <h3 className="text-sm font-semibold text-white/75 uppercase tracking-wide mb-4">{label}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-white/75 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({
  value, onChange, placeholder, type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      step={type === 'number' ? 'any' : undefined}
      className="w-full px-3 py-2 rounded-lg bg-white/[0.07] border border-white/[0.12] text-white text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-[#2966E5]/50 focus:border-[#2966E5]"
    />
  )
}
