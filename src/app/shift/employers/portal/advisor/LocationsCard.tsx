'use client'

import { useState } from 'react'
import { MapPin, Plus, Check, ArrowUp } from 'lucide-react'
import { Card, CardHead } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import type { EmployerLocation, LocationDraft } from '../_lib/use-employer-locations'

/**
 * The employer's locations: offices, branches, sites. Location 1 is where the
 * Commute Advisor opens and what the rest of the portal treats as "the
 * office"; every location gets its own Advisor link and Nearby page in the
 * Share Kit. Saved on its own, separately from the benefits form below.
 */
export default function LocationsCard({
  locations,
  onSave,
  readOnly = false,
}: {
  locations: EmployerLocation[]
  onSave: (drafts: LocationDraft[]) => Promise<string | null>
  /** Viewers: the list without its controls (S3). */
  readOnly?: boolean
}) {
  // Seeded once; the parent remounts this card (key) when the list first loads.
  const [rows, setRows] = useState<LocationDraft[]>(() =>
    locations.length > 0
      ? locations.map((l) => ({ id: l.id, name: l.name ?? '', address: l.address, lat: l.lat, lng: l.lng }))
      : [{ name: '', address: '', lat: null, lng: null }],
  )
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // After a save, pick up the ids the database gave new rows, so the next
  // save updates them in place instead of re-creating them. (Adjusting
  // state during render when the saved list changes, per React's docs.)
  const [seenLocations, setSeenLocations] = useState(locations)
  if (locations !== seenLocations && !dirty) {
    setSeenLocations(locations)
    if (locations.length > 0) {
      setRows(locations.map((l) => ({ id: l.id, name: l.name ?? '', address: l.address, lat: l.lat, lng: l.lng })))
    }
  }

  const edit = (i: number, patch: Partial<LocationDraft>) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
    setDirty(true)
    setSaved(false)
  }

  const remove = (i: number) => {
    setRows((prev) => prev.filter((_, j) => j !== i))
    setDirty(true)
    setSaved(false)
  }

  const makeMain = (i: number) => {
    setRows((prev) => [prev[i], ...prev.filter((_, j) => j !== i)])
    setDirty(true)
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    // A blank row the admin never filled in is not an error; drop it.
    const filled = rows.filter((r) => r.address.trim() || r.name.trim())
    const err = await onSave(filled)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    setDirty(false)
    setSaved(true)
  }

  return (
    <Card>
      <CardHead
        title="Locations"
        sub="Every office, branch or site where your staff work. Each one gets its own Commute Advisor link and Nearby page in your Share Kit."
      />
      <div className="grid gap-3 px-6 py-5">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2.5 rounded-[10px] border border-line bg-surface-2 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin size={15} strokeWidth={1.75} className="text-ink-icon" />
              <span className="text-[12.5px] font-semibold text-ink-muted">
                {i === 0 ? 'Main location · the Commute Advisor opens here' : `Location ${i + 1}`}
              </span>
              <span className="ml-auto flex gap-3">
                {!readOnly && i > 0 && (
                  <button
                    type="button"
                    onClick={() => makeMain(i)}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline"
                  >
                    <ArrowUp size={13} strokeWidth={2} />
                    Make main
                  </button>
                )}
                {!readOnly && rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-[12.5px] font-semibold text-ep-danger hover:underline"
                  >
                    Remove
                  </button>
                )}
              </span>
            </div>
            <input
              id={`location-name-${i}`}
              className="rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
              placeholder="Name (optional), e.g. Harvard Square branch"
              value={r.name}
              onChange={(e) => edit(i, { name: e.target.value })}
            />
            <AddressAutocomplete
              value={r.address}
              onChange={(v) => edit(i, { address: v, lat: null, lng: null })}
              onPlaceSelected={(place) => edit(i, { lat: place.lat, lng: place.lng })}
              variant="light"
              placeholder="Start typing an address..."
            />
          </div>
        ))}

        {error && <p className="text-[13px] font-semibold text-ep-danger">{error}</p>}

        {!readOnly && <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => {
              setRows((prev) => [...prev, { name: '', address: '', lat: null, lng: null }])
              setDirty(true)
              setSaved(false)
            }}
          >
            Add location
          </Button>
          <span className="ml-auto text-[13px] text-ink-tertiary">
            {saved ? 'Locations saved' : dirty ? 'Unsaved changes' : ''}
          </span>
          <Button variant="primary" size="sm" icon={Check} onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving...' : 'Save locations'}
          </Button>
        </div>}
      </div>
    </Card>
  )
}
