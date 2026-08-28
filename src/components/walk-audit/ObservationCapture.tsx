'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ArrowClockwise, Camera, CheckCircle, Microphone, Smiley, SmileyMeh,
  SmileyNervous, SmileySad, SmileyXEyes, ThumbsUp, Warning, X,
} from '@phosphor-icons/react'
import VolunteerRouteMap from '@/components/volunteer-route/VolunteerRouteMap'
import PhotoLightbox from '@/components/walk-audit/PhotoLightbox'
import { useDictation } from '@/components/walk-audit/useDictation'

export interface AuditObservation {
  id: string
  lat: number
  lng: number
  valence: 'good' | 'problem'
  category: string | null
  severity: number | null
  note: string | null
  photo: { url: string; path?: string } | null
  observer_name: string | null
  created_at: string
}

const CATEGORIES = [
  { value: 'crossing', label: 'Crossing' },
  { value: 'sidewalk', label: 'Sidewalk' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'biking', label: 'Biking' },
  { value: 'feels_unsafe', label: 'Feels unsafe' },
  { value: 'other', label: 'Other' },
]

const SEVERITY_ICONS = [Smiley, SmileyMeh, SmileyNervous, SmileySad, SmileyXEyes]

interface Props {
  token: string
  auditId: string
  observer: string
  routeCoordinates: [number, number][]
  fallbackCenter: { lat: number; lng: number } | null
  onSaved: (obs: AuditObservation) => void
  onClose: () => void
}

export default function ObservationCapture({
  token, auditId, observer, routeCoordinates, fallbackCenter, onSaved, onClose,
}: Props) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [located, setLocated] = useState(false)
  const [photo, setPhoto] = useState<{
    status: 'none' | 'uploading' | 'done' | 'failed'
    file?: File
    previewUrl?: string
    path?: string
    url?: string
  }>({ status: 'none' })
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [valence, setValence] = useState<'good' | 'problem' | null>(null)
  const [severity, setSeverity] = useState<number | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const dictation = useDictation((transcript) => {
    setNote((prev) => (prev ? `${prev} ${transcript}` : transcript))
  })

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPos(fallbackCenter)
      setLocated(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLocated(true)
      },
      () => {
        setPos(fallbackCenter)
        setLocated(true)
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function uploadPhoto(file: File) {
    const previewUrl = URL.createObjectURL(file)
    setPhoto({ status: 'uploading', file, previewUrl })
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${auditId}/${Date.now()}-${cleanName}`
    const { error: upErr } = await supabase.storage
      .from('walk-audit-photos')
      .upload(path, file, { contentType: file.type })
    if (upErr) {
      setPhoto((prev) => ({ ...prev, status: 'failed' }))
      return
    }
    const { data } = supabase.storage.from('walk-audit-photos').getPublicUrl(path)
    setPhoto((prev) => ({ ...prev, status: 'done', path, url: data.publicUrl }))
  }

  async function handleSave() {
    if (!valence) {
      setError('Is this a problem, or something that works well? One tap.')
      return
    }
    if (!pos) {
      setError("We couldn't get a location — tap the map to place this observation.")
      return
    }
    if (photo.status === 'uploading') {
      setError('The photo is still uploading — one moment.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('submit_walk_audit_observation', {
        p_token: token,
        p_observer: observer,
        p_lat: pos.lat,
        p_lng: pos.lng,
        p_valence: valence,
        p_category: category,
        p_severity: valence === 'problem' ? severity : null,
        p_note: note,
        p_photo: photo.status === 'done' ? { url: photo.url, path: photo.path } : null,
      })
      if (rpcErr) throw rpcErr
      if (!data) {
        setError('This audit link is no longer active — check with your organizer.')
        return
      }
      onSaved(data as AuditObservation)
      onClose()
    } catch (err) {
      setError(
        `Couldn't save: ${err instanceof Error ? err.message : 'network error'}. Nothing is lost — try again.`,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-t-2xl bg-[#F4F8EE] p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-[#191A2E]">Flag this spot</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#6B7280] hover:text-[#191A2E]">
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Photo */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void uploadPhoto(f)
            e.target.value = ''
          }}
        />
        {photo.status === 'none' ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mb-3 flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-[#2966E5]/40 bg-white py-6 text-[#2966E5]"
          >
            <Camera size={28} weight="regular" />
            <span className="text-sm font-bold">Take a photo</span>
            <span className="text-[11px] text-[#6B7280]">A photo makes it fixable — but you can skip it</span>
          </button>
        ) : (
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url ?? photo.previewUrl}
              alt=""
              onClick={() => {
                const src = photo.url ?? photo.previewUrl
                if (src) setLightboxSrc(src)
              }}
              className={`h-20 w-24 cursor-pointer rounded-lg object-cover ${photo.status !== 'done' ? 'opacity-50' : ''}`}
            />
            <div className="min-w-0 flex-1 text-xs text-[#6B7280]">
              {photo.status === 'uploading' && 'Uploading…'}
              {photo.status === 'done' && (
                <span className="inline-flex items-center gap-1 text-green-700">
                  <CheckCircle size={13} weight="bold" /> Photo saved — tap to expand
                </span>
              )}
              {photo.status === 'failed' && (
                <button
                  onClick={() => photo.file && uploadPhoto(photo.file)}
                  className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 font-semibold text-red-700"
                >
                  <ArrowClockwise size={12} weight="bold" /> Upload failed — retry
                </button>
              )}
            </div>
            <button
              onClick={() => setPhoto({ status: 'none' })}
              className="shrink-0 rounded-md p-1 text-[#6B7280] hover:text-red-600"
              aria-label="Remove photo"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        )}

        {/* Valence */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setValence('good')}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 text-sm font-bold transition ${
              valence === 'good'
                ? 'border-[#3D5407] bg-[#BAF14D] text-[#191A2E]'
                : 'border-gray-200 bg-white text-[#374151]'
            }`}
          >
            <ThumbsUp size={18} weight={valence === 'good' ? 'fill' : 'regular'} /> Works well
          </button>
          <button
            onClick={() => setValence('problem')}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 text-sm font-bold transition ${
              valence === 'problem'
                ? 'border-[#B45309] bg-[#D97706] text-white'
                : 'border-gray-200 bg-white text-[#374151]'
            }`}
          >
            <Warning size={18} weight={valence === 'problem' ? 'fill' : 'regular'} /> Problem
          </button>
        </div>

        {/* Severity (problems only) */}
        {valence === 'problem' && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-[#191A2E]">How bad? (optional)</p>
            <div className="flex gap-1.5">
              {SEVERITY_ICONS.map((Icon, i) => {
                const level = i + 1
                return (
                  <button
                    key={level}
                    onClick={() => setSeverity(severity === level ? null : level)}
                    aria-label={`Severity ${level} of 5`}
                    className={`flex h-11 flex-1 items-center justify-center rounded-lg border transition ${
                      severity === level
                        ? 'border-[#D97706] bg-[#D97706]/15 text-[#B45309]'
                        : 'border-gray-200 bg-white text-[#9CA3AF]'
                    }`}
                  >
                    <Icon size={22} weight={severity === level ? 'fill' : 'regular'} />
                  </button>
                )
              })}
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] text-[#6B7280]">
              <span>Minor</span><span>Impassable</span>
            </div>
          </div>
        )}

        {/* Category */}
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-[#191A2E]">What kind of spot? (optional)</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(category === c.value ? null : c.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  category === c.value
                    ? 'border-[#2966E5] bg-[#2966E5]/10 font-semibold text-[#2966E5]'
                    : 'border-gray-200 bg-white text-[#6B7280]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note with mic button */}
        <div className="relative mb-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What do you see? (optional)"
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-12 text-sm focus:border-[#2966E5] focus:outline-none"
          />
          {dictation.supported && (
            <button
              onClick={dictation.toggle}
              aria-label={dictation.listening ? 'Stop dictating' : 'Dictate your observation'}
              className={`absolute bottom-3 right-2 rounded-full p-1.5 transition ${
                dictation.listening
                  ? 'animate-pulse bg-red-500 text-white'
                  : 'bg-gray-100 text-[#6B7280] hover:bg-[#2966E5]/10 hover:text-[#2966E5]'
              }`}
            >
              <Microphone size={18} weight={dictation.listening ? 'fill' : 'regular'} />
            </button>
          )}
        </div>

        {/* Location */}
        {located && (pos || routeCoordinates.length >= 2) && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-[#191A2E]">
              Where {pos ? '— tap the map if the pin is off' : '— tap the map to place the pin'}
            </p>
            <VolunteerRouteMap
              routeCoordinates={routeCoordinates}
              center={pos}
              pins={pos ? [{ lat: pos.lat, lng: pos.lng, note: '', category: null }] : []}
              onMapClick={(lat, lng) => setPos({ lat, lng })}
              heightClass="h-40"
            />
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-[#2966E5] py-3.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & keep walking'}
        </button>
      </div>

      {lightboxSrc && (
        <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}
