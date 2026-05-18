'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WayfindingEvent, WayfindingBusiness, Locale } from '@/lib/wayfinding/types'

type Tab = 'settings' | 'businesses' | 'status'

interface Props {
  event: WayfindingEvent
  businesses: WayfindingBusiness[]
}

export default function EventEditor({ event: initial, businesses: initialBiz }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('settings')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [event, setEvent] = useState(initial)
  const [businesses, setBusinesses] = useState(initialBiz)

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }, [])

  async function saveEvent() {
    setSaving(true)
    const res = await fetch(`/api/admin/wayfinding/${event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
    setSaving(false)
    if (res.ok) {
      showMessage('success', 'Event saved')
      router.refresh()
    } else {
      showMessage('error', 'Failed to save')
    }
  }

  async function saveBusiness(biz: WayfindingBusiness) {
    const isNew = biz.id.startsWith('new-')
    const res = await fetch(`/api/admin/wayfinding/${event.id}/businesses`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isNew ? { ...biz, id: undefined } : biz),
    })
    if (res.ok) {
      const saved = await res.json()
      setBusinesses(prev => {
        if (isNew) return prev.map(b => b.id === biz.id ? saved : b)
        return prev.map(b => b.id === biz.id ? saved : b)
      })
      showMessage('success', `${biz.name || 'Business'} saved`)
    } else {
      showMessage('error', 'Failed to save business')
    }
  }

  async function deleteBusiness(id: string) {
    if (id.startsWith('new-')) {
      setBusinesses(prev => prev.filter(b => b.id !== id))
      return
    }
    const res = await fetch(`/api/admin/wayfinding/${event.id}/businesses?id=${id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setBusinesses(prev => prev.filter(b => b.id !== id))
      showMessage('success', 'Business removed')
    }
  }

  function addBusiness() {
    const newBiz: WayfindingBusiness = {
      id: `new-${Date.now()}`,
      event_id: event.id,
      name: '',
      category: 'Restaurants',
      description: null,
      lat: event.center_lat,
      lng: event.center_lng,
      address: null,
      website_url: null,
      google_place_id: null,
      show_on_map: true,
      pin_color: null,
    }
    setBusinesses(prev => [newBiz, ...prev])
    setTab('businesses')
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'settings', label: 'Settings' },
    { key: 'businesses', label: `Businesses (${businesses.length})` },
    { key: 'status', label: 'Status & Publishing' },
  ]

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/wayfinding" className="text-white/60 hover:text-white/80 text-sm">
          Events
        </Link>
        <span className="text-white/40">/</span>
        <h1 className="text-xl font-semibold text-white font-[family-name:var(--font-bricolage)]">
          {event.name || 'New Event'}
        </h1>
        <a
          href={`/wayfinding/${event.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#2966E5] hover:underline ml-2"
        >
          View live page
        </a>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-white/[0.08]">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[#2966E5] text-white'
                : 'border-transparent text-white/60 hover:text-white/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <EventSettingsTab event={event} onChange={setEvent} onSave={saveEvent} saving={saving} />
      )}
      {tab === 'businesses' && (
        <BusinessesTab
          businesses={businesses}
          onChange={setBusinesses}
          onSave={saveBusiness}
          onDelete={deleteBusiness}
          onAdd={addBusiness}
        />
      )}
      {tab === 'status' && (
        <StatusTab event={event} onChange={setEvent} onSave={saveEvent} saving={saving} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Settings Tab
// ═══════════════════════════════════════════════════════════════

function EventSettingsTab({
  event, onChange, onSave, saving,
}: {
  event: WayfindingEvent
  onChange: (e: WayfindingEvent) => void
  onSave: () => void
  saving: boolean
}) {
  const set = (field: string, value: unknown) =>
    onChange({ ...event, [field]: value })

  return (
    <div className="space-y-6">
      <FieldGroup label="Basic Info">
        <Field label="Event Name" required>
          <Input value={event.name} onChange={v => set('name', v)} placeholder="Carnaval" />
        </Field>
        <Field label="URL Slug" required>
          <Input value={event.slug} onChange={v => set('slug', v)} placeholder="carnaval" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Eyebrow Text">
            <Input value={event.eyebrow ?? ''} onChange={v => set('eyebrow', v || null)} placeholder="SomerStreets" />
          </Field>
          <Field label="Accent Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={event.accent_color}
                onChange={e => set('accent_color', e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/[0.12]"
              />
              <Input value={event.accent_color} onChange={v => set('accent_color', v)} placeholder="#D81B60" />
            </div>
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup label="Organizer">
        <Field label="Organizer Name">
          <Input value={event.organizer_name ?? ''} onChange={v => set('organizer_name', v || null)} placeholder="East Somerville Main Streets" />
        </Field>
        <Field label="Organizer Logo URL">
          <Input value={event.organizer_logo_url ?? ''} onChange={v => set('organizer_logo_url', v || null)} placeholder="https://..." />
        </Field>
      </FieldGroup>

      <FieldGroup label="Date & Time">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary Date" required>
            <Input type="date" value={event.date_primary} onChange={v => set('date_primary', v)} />
          </Field>
          <Field label="Rain Date">
            <Input type="date" value={event.date_rain ?? ''} onChange={v => set('date_rain', v || null)} />
          </Field>
          <Field label="Start Time">
            <Input type="time" value={event.time_start ?? ''} onChange={v => set('time_start', v || null)} />
          </Field>
          <Field label="End Time">
            <Input type="time" value={event.time_end ?? ''} onChange={v => set('time_end', v || null)} />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup label="Map">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Center Latitude" required>
            <Input type="number" value={String(event.center_lat)} onChange={v => set('center_lat', parseFloat(v) || 0)} />
          </Field>
          <Field label="Center Longitude" required>
            <Input type="number" value={String(event.center_lng)} onChange={v => set('center_lng', parseFloat(v) || 0)} />
          </Field>
          <Field label="Default Zoom">
            <Input type="number" value={String(event.default_zoom)} onChange={v => set('default_zoom', parseInt(v) || 15)} />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup label="Localization">
        <Field label="Supported Locales">
          <div className="flex gap-2">
            {(['en', 'es', 'pt', 'ht', 'zh'] as const).map(loc => (
              <label key={loc} className="flex items-center gap-1.5 text-sm text-white/75">
                <input
                  type="checkbox"
                  checked={event.locales.includes(loc as Locale)}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...event.locales, loc as Locale]
                      : event.locales.filter(l => l !== loc)
                    set('locales', next.length > 0 ? next : ['en'])
                  }}
                  className="rounded bg-white/[0.07] border-white/[0.12]"
                />
                {loc.toUpperCase()}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Attribution Text">
          <Input value={event.attribution ?? ''} onChange={v => set('attribution', v || null)} placeholder="Wayfinding by Green Streets Initiative" />
        </Field>
      </FieldGroup>

      <div className="pt-4">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-[#2966E5] text-white text-sm font-semibold hover:bg-[#2966E5]/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Businesses Tab
// ═══════════════════════════════════════════════════════════════

function BusinessesTab({
  businesses, onChange, onSave, onDelete, onAdd,
}: {
  businesses: WayfindingBusiness[]
  onChange: (b: WayfindingBusiness[]) => void
  onSave: (b: WayfindingBusiness) => void
  onDelete: (id: string) => void
  onAdd: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function updateBiz(id: string, field: string, value: unknown) {
    onChange(businesses.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-white/75">{businesses.length} businesses linked to this event</p>
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-lg bg-[#2966E5] text-white text-sm font-semibold hover:bg-[#2966E5]/90 transition-colors"
        >
          Add business
        </button>
      </div>

      <div className="space-y-2">
        {businesses.map(biz => (
          <div key={biz.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === biz.id ? null : biz.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${biz.show_on_map ? 'bg-emerald-400' : 'bg-white/30'}`} />
                <div>
                  <span className="text-white font-medium text-sm">{biz.name || 'Unnamed'}</span>
                  {biz.address && <span className="text-white/60 text-sm ml-2">{biz.address}</span>}
                </div>
              </div>
              <span className="text-white/40 text-sm">{biz.category}</span>
            </button>

            {expanded === biz.id && (
              <div className="px-4 pb-4 border-t border-white/[0.08] pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Name">
                    <Input value={biz.name} onChange={v => updateBiz(biz.id, 'name', v)} />
                  </Field>
                  <Field label="Category">
                    <Input value={biz.category} onChange={v => updateBiz(biz.id, 'category', v)} />
                  </Field>
                </div>
                <Field label="Description">
                  <Input value={biz.description ?? ''} onChange={v => updateBiz(biz.id, 'description', v || null)} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Address">
                    <Input value={biz.address ?? ''} onChange={v => updateBiz(biz.id, 'address', v || null)} />
                  </Field>
                  <Field label="Website URL">
                    <Input value={biz.website_url ?? ''} onChange={v => updateBiz(biz.id, 'website_url', v || null)} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Latitude">
                    <Input type="number" value={String(biz.lat)} onChange={v => updateBiz(biz.id, 'lat', parseFloat(v) || 0)} />
                  </Field>
                  <Field label="Longitude">
                    <Input type="number" value={String(biz.lng)} onChange={v => updateBiz(biz.id, 'lng', parseFloat(v) || 0)} />
                  </Field>
                  <Field label="Google Place ID">
                    <Input value={biz.google_place_id ?? ''} onChange={v => updateBiz(biz.id, 'google_place_id', v || null)} />
                  </Field>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-white/75">
                    <input
                      type="checkbox"
                      checked={biz.show_on_map}
                      onChange={e => updateBiz(biz.id, 'show_on_map', e.target.checked)}
                      className="rounded bg-white/[0.07] border-white/[0.12]"
                    />
                    Show on map
                  </label>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => onSave(biz)}
                    className="px-4 py-2 rounded-lg bg-[#2966E5] text-white text-sm font-semibold hover:bg-[#2966E5]/90 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => onDelete(biz.id)}
                    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Status Tab
// ═══════════════════════════════════════════════════════════════

function StatusTab({
  event, onChange, onSave, saving,
}: {
  event: WayfindingEvent
  onChange: (e: WayfindingEvent) => void
  onSave: () => void
  saving: boolean
}) {
  const set = (field: string, value: unknown) =>
    onChange({ ...event, [field]: value })

  return (
    <div className="space-y-6">
      <FieldGroup label="Publishing">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-white/75">
            <input
              type="checkbox"
              checked={event.is_published}
              onChange={e => set('is_published', e.target.checked)}
              className="rounded bg-white/[0.07] border-white/[0.12]"
            />
            Published
          </label>
          <span className="text-xs text-white/60">
            {event.is_published
              ? `Live at /wayfinding/${event.slug}`
              : 'Not visible to the public'}
          </span>
        </div>
      </FieldGroup>

      <FieldGroup label="Weather & Cancellation">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-white/75">
            <input
              type="checkbox"
              checked={event.is_rain_date}
              onChange={e => set('is_rain_date', e.target.checked)}
              className="rounded bg-white/[0.07] border-white/[0.12]"
            />
            Moved to rain date
          </label>
          {event.is_rain_date && event.date_rain && (
            <p className="text-sm text-amber-400 ml-6">
              Banner will show: &quot;Moved to {new Date(event.date_rain + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} due to weather&quot;
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-white/75">
            <input
              type="checkbox"
              checked={event.is_cancelled}
              onChange={e => set('is_cancelled', e.target.checked)}
              className="rounded bg-white/[0.07] border-white/[0.12]"
            />
            Event cancelled
          </label>
          {event.is_cancelled && (
            <p className="text-sm text-red-400 ml-6">
              Banner will show: &quot;{event.name} is cancelled — visit local businesses any time&quot;
            </p>
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Admin API Token">
        <Field label="Token (for external status toggle API)">
          <Input value={event.admin_token ?? ''} onChange={v => set('admin_token', v || null)} placeholder="Generate or paste a secret token" />
        </Field>
        <p className="text-xs text-white/60">
          Used by POST /api/wayfinding/{event.slug}/admin to toggle rain-date/cancellation status remotely.
        </p>
      </FieldGroup>

      <div className="pt-4">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-[#2966E5] text-white text-sm font-semibold hover:bg-[#2966E5]/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Shared UI primitives
// ═══════════════════════════════════════════════════════════════

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
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
