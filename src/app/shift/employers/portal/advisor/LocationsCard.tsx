'use client'

import { useState } from 'react'
import { MapPin, Plus, Check, ArrowUp, Clock } from 'lucide-react'
import { Card, CardHead } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { DEFAULT_TYPICAL_START_TIME, type EmployerLocation, type LocationDraft } from '../_lib/use-employer-locations'

const toDraft = (l: EmployerLocation): LocationDraft => ({
  id: l.id,
  name: l.name ?? '',
  address: l.address,
  lat: l.lat,
  lng: l.lng,
  typical_start_time: l.typical_start_time || DEFAULT_TYPICAL_START_TIME,
})

const blankDraft = (): LocationDraft => ({ name: '', address: '', lat: null, lng: null, typical_start_time: DEFAULT_TYPICAL_START_TIME })

/**
 * Whether the team can change "Arrive by" here. False as of 2026-10-05: the
 * browser has no UPDATE grant on employer_locations (Shift 01021 revoked it
 * and neither 01028 nor held 01131 adds a policy or grant), and
 * set_employer_locations drops the key. Flip to true once Shift gives the
 * team an UPDATE policy on its own rows (or the RPC reads the key); the save
 * path in use-employer-locations already handles both.
 */
const ARRIVE_BY_EDITABLE = true

/** "09:00" -> "9:00 AM" */
function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

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
  const [rows, setRows] = useState<LocationDraft[]>(() => (locations.length > 0 ? locations.map(toDraft) : [blankDraft()]))
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
      setRows(locations.map(toDraft))
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
        sub="Every office, branch or site where your staff work. Each one gets its own Commute Advisor link and Nearby page, listed at the top of this page."
      />
      <div className="grid gap-3 px-6 py-5">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2.5 rounded-[10px] border border-line bg-surface-2 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin size={15} strokeWidth={1.75} className="text-ink-icon" />
              <span className="text-[14px] font-semibold text-ink-muted">
                {i === 0 ? 'Main location · the Commute Advisor opens here' : `Location ${i + 1}`}
              </span>
              <span className="ml-auto flex gap-3">
                {!readOnly && i > 0 && (
                  <button
                    type="button"
                    onClick={() => makeMain(i)}
                    className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent hover:underline"
                  >
                    <ArrowUp size={13} strokeWidth={2} />
                    Make main
                  </button>
                )}
                {!readOnly && rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-[14px] font-semibold text-ep-danger hover:underline"
                  >
                    Remove
                  </button>
                )}
              </span>
            </div>
            <input
              id={`location-name-${i}`}
              aria-label={`Location ${i + 1} name`}
              className="rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
              placeholder="Name (optional), e.g. Harvard Square branch"
              value={r.name}
              onChange={(e) => edit(i, { name: e.target.value })}
            />
            <AddressAutocomplete
              value={r.address}
              onChange={(v) => edit(i, { address: v, lat: null, lng: null })}
              onPlaceSelected={(place) => edit(i, { lat: place.lat, lng: place.lng })}
              label={`Location ${i + 1} address`}
              hideLabel
              variant="light"
              placeholder="Start typing an address..."
            />
            <div className="grid gap-1.5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-3">
              {ARRIVE_BY_EDITABLE && !readOnly ? (
                <label htmlFor={`location-arrive-${i}`} className="flex items-center gap-2 text-[14px] font-semibold text-ink-muted">
                  <Clock size={14} strokeWidth={1.75} className="text-ink-icon" />
                  Arrive by
                  <input
                    id={`location-arrive-${i}`}
                    type="time"
                    step={300}
                    className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] font-normal text-ink outline-none focus:border-accent"
                    value={r.typical_start_time ?? DEFAULT_TYPICAL_START_TIME}
                    onChange={(e) => edit(i, { typical_start_time: e.target.value || DEFAULT_TYPICAL_START_TIME })}
                  />
                </label>
              ) : (
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-muted">
                  <Clock size={14} strokeWidth={1.75} className="text-ink-icon" />
                  Arrive by
                  <span className="rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[14px] font-normal text-ink">
                    {timeLabel(r.typical_start_time ?? DEFAULT_TYPICAL_START_TIME)}
                  </span>
                </span>
              )}
              <p className="text-[14px] leading-[1.5] text-ink-tertiary">
                When do people usually need to be in? The advisor plans trips to arrive by this time.
                {!ARRIVE_BY_EDITABLE && !readOnly && ' Changing it from here is coming; for now, Green Streets can set it for you.'}
              </p>
            </div>
          </div>
        ))}

        {error && <p className="text-[14px] font-semibold text-ep-danger">{error}</p>}

        {!readOnly && <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => {
              setRows((prev) => [...prev, blankDraft()])
              setDirty(true)
              setSaved(false)
            }}
          >
            Add location
          </Button>
          <span className="ml-auto text-[14px] text-ink-tertiary">
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
