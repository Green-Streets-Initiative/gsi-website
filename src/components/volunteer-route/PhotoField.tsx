'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Camera, ArrowClockwise, X } from '@phosphor-icons/react'
import type { DraftPhoto } from './useDraft'

const MAX_PHOTOS = 8

interface PhotoEntry {
  localId: string
  status: 'uploading' | 'done' | 'failed'
  file?: File
  previewUrl?: string
  path?: string
  url?: string
  caption: string
  lat?: number
  lng?: number
  accuracy?: number
  captured_at?: string
}

interface Props {
  corridorId: string
  /** Photos restored from a saved draft (already uploaded). */
  initialPhotos: DraftPhoto[]
  /** Fires with the current list of successfully uploaded photos. */
  onPhotosChange: (photos: DraftPhoto[]) => void
  /** Fires when uploads start/settle so submit can block on pending work. */
  onBusyChange: (busy: boolean) => void
}

function toDraft(e: PhotoEntry): DraftPhoto {
  return {
    path: e.path!,
    url: e.url!,
    caption: e.caption,
    lat: e.lat,
    lng: e.lng,
    accuracy: e.accuracy,
    captured_at: e.captured_at,
  }
}

// Photos upload the moment they're picked (with retry on failure), so a
// page refresh mid-walk never loses them — the draft stores the uploaded
// paths. Location is captured per photo when permission allows.
export default function PhotoField({ corridorId, initialPhotos, onPhotosChange, onBusyChange }: Props) {
  const [entries, setEntries] = useState<PhotoEntry[]>(() =>
    initialPhotos.map((p, i) => ({
      localId: `restored-${i}`,
      status: 'done' as const,
      path: p.path,
      url: p.url,
      caption: p.caption,
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy,
      captured_at: p.captured_at,
    })),
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onPhotosChange(entries.filter((e) => e.status === 'done').map(toDraft))
    onBusyChange(entries.some((e) => e.status !== 'done'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries])

  function captureLocation(localId: string) {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEntries((prev) =>
          prev.map((e) =>
            e.localId === localId
              ? {
                  ...e,
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  captured_at: new Date().toISOString(),
                }
              : e,
          ),
        )
      },
      () => {
        // Permission denied or unavailable — photo is still valid without it.
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  }

  async function upload(localId: string, file: File) {
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${corridorId}/${Date.now()}-${cleanName}`
    const { error } = await supabase.storage
      .from('route-assessment-photos')
      .upload(path, file, { contentType: file.type })
    if (error) {
      setEntries((prev) =>
        prev.map((e) => (e.localId === localId ? { ...e, status: 'failed' as const } : e)),
      )
      return
    }
    const { data } = supabase.storage.from('route-assessment-photos').getPublicUrl(path)
    setEntries((prev) =>
      prev.map((e) =>
        e.localId === localId
          ? { ...e, status: 'done' as const, path, url: data.publicUrl }
          : e,
      ),
    )
  }

  function addFiles(files: File[]) {
    const room = MAX_PHOTOS - entries.length
    const accepted = files.slice(0, room)
    const newEntries: PhotoEntry[] = accepted.map((file) => ({
      localId: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'uploading' as const,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
    }))
    setEntries((prev) => [...prev, ...newEntries])
    for (const e of newEntries) {
      captureLocation(e.localId)
      void upload(e.localId, e.file!)
    }
  }

  function retry(localId: string) {
    const entry = entries.find((e) => e.localId === localId)
    if (!entry?.file) return
    setEntries((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, status: 'uploading' as const } : e)),
    )
    void upload(localId, entry.file)
  }

  function remove(localId: string) {
    const entry = entries.find((e) => e.localId === localId)
    if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl)
    if (entry?.path) {
      // Best effort — the photo entry is dropped from the submission either way.
      void supabase.storage.from('route-assessment-photos').remove([entry.path])
    }
    setEntries((prev) => prev.filter((e) => e.localId !== localId))
  }

  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-[#191A2E] mb-2">Photos (up to {MAX_PHOTOS})</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={entries.length >= MAX_PHOTOS}
        className="rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-[#6B7280] w-full hover:border-[#2966E5] hover:text-[#2966E5] disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-1.5">
          <Camera size={16} weight="regular" /> Add Photos ({entries.length}/{MAX_PHOTOS})
        </span>
      </button>
      {entries.map((p) => (
        <div key={p.localId} className="mt-2 flex items-start gap-2">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url ?? p.previewUrl}
              alt=""
              className={`h-16 w-16 rounded-lg object-cover ${p.status !== 'done' ? 'opacity-50' : ''}`}
            />
            {p.status === 'uploading' && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#2966E5] border-t-transparent" />
              </span>
            )}
          </div>
          <div className="flex-1">
            <input
              value={p.caption}
              onChange={(e) =>
                setEntries((prev) =>
                  prev.map((x) =>
                    x.localId === p.localId ? { ...x, caption: e.target.value } : x,
                  ),
                )
              }
              placeholder="Caption: what condition does this show?"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#2966E5] focus:outline-none"
            />
            {p.status === 'uploading' && (
              <p className="mt-1 text-[11px] text-[#6B7280]">Uploading…</p>
            )}
            {p.status === 'failed' && (
              <button
                type="button"
                onClick={() => retry(p.localId)}
                className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700"
              >
                <ArrowClockwise size={12} weight="bold" /> Upload failed — tap to retry
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(p.localId)}
            aria-label="Remove photo"
            className="rounded-md p-1 text-[#6B7280] hover:text-red-600"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      ))}
    </div>
  )
}
