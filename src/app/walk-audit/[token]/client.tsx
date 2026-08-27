'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, CaretRight, CheckCircle, MapPin, MapTrifold,
} from '@phosphor-icons/react'
import { AUDIT_MODULES, ROLLUP_OPTIONS, moduleById } from '@/components/walk-audit/moduleModel'
import ModuleForm, { type Answers } from '@/components/walk-audit/ModuleForm'
import { RadioGroup, FreeTextField } from '@/components/volunteer-route/inputs'
import PhotoField from '@/components/volunteer-route/PhotoField'
import ProblemPinSheet from '@/components/volunteer-route/ProblemPinSheet'
import VolunteerRouteMap from '@/components/volunteer-route/VolunteerRouteMap'
import type { DraftPhoto } from '@/components/volunteer-route/useDraft'
import type { ProblemPin } from '@/components/volunteer-route/formModel'
import type { WalkAuditMeta } from './page'

const PURPOSE_LABELS: Record<string, string> = {
  engage: 'Community walk audit',
  designate_route: 'Route review',
  technical_evaluation: 'Technical walk audit',
  activate_leaders: 'Walk audit for local leaders',
}

interface Props {
  token: string
  audit: WalkAuditMeta
}

interface ModuleDraft {
  v: 1
  answers: Answers
  pins: ProblemPin[]
  photos: DraftPhoto[]
  notes: string
  rollup: string | null
}

function draftKey(token: string, moduleId: string) {
  return `shift-walk-audit:${token}:${moduleId}`
}

export default function WalkAuditClient({ token, audit }: Props) {
  const [view, setView] = useState<'picker' | 'module' | 'done'>('picker')
  const [moduleId, setModuleId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [pins, setPins] = useState<ProblemPin[]>([])
  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [initialPhotos, setInitialPhotos] = useState<DraftPhoto[]>([])
  const [photosBusy, setPhotosBusy] = useState(false)
  const [notes, setNotes] = useState('')
  const [rollup, setRollup] = useState<string | null>(null)
  const [observer, setObserver] = useState('')
  const [pinSheetOpen, setPinSheetOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedModules, setSubmittedModules] = useState<string[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const routeCoordinates: [number, number][] =
    audit.area_type === 'route' && Array.isArray(audit.area)
      ? audit.area
          .filter((p) => typeof p?.lat === 'number' && typeof p?.lng === 'number')
          .map((p) => [p.lng, p.lat] as [number, number])
      : []
  const locationCenter =
    audit.area_type === 'location' && !Array.isArray(audit.area) ? audit.area : null

  useEffect(() => {
    try {
      setObserver(localStorage.getItem('shift-walk-audit-observer') ?? '')
    } catch { /* ignore */ }
  }, [])

  // Debounced per-module draft
  useEffect(() => {
    if (view !== 'module' || !moduleId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        const draft: ModuleDraft = { v: 1, answers, pins, photos, notes, rollup }
        localStorage.setItem(draftKey(token, moduleId), JSON.stringify(draft))
      } catch { /* ignore */ }
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [view, moduleId, answers, pins, photos, notes, rollup, token])

  function openModule(id: string) {
    let draft: ModuleDraft | null = null
    try {
      const raw = localStorage.getItem(draftKey(token, id))
      if (raw) draft = JSON.parse(raw) as ModuleDraft
    } catch { /* ignore */ }
    setModuleId(id)
    setAnswers(draft?.answers ?? {})
    setPins(draft?.pins ?? [])
    setPhotos(draft?.photos ?? [])
    setInitialPhotos(draft?.photos ?? [])
    setNotes(draft?.notes ?? '')
    setRollup(draft?.rollup ?? null)
    setSubmitError(null)
    setView('module')
    window.scrollTo({ top: 0 })
  }

  async function handleSubmit() {
    if (!moduleId) return
    if (photosBusy) {
      setSubmitError('Photos are still uploading — give them a moment, or remove any that failed.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      try {
        if (observer.trim()) localStorage.setItem('shift-walk-audit-observer', observer.trim())
      } catch { /* ignore */ }
      const { data: accepted, error } = await supabase.rpc('submit_walk_audit', {
        p_token: token,
        p_module: moduleId,
        p_observer: observer,
        p_answers: { ...answers, notes, rollup },
        p_pins: pins,
        p_photos: photos.map((p) => ({
          url: p.url,
          caption: p.caption,
          ...(p.lat != null ? { lat: p.lat, lng: p.lng } : {}),
        })),
      })
      if (error) throw error
      if (!accepted) {
        setSubmitError('This audit link is no longer active. Check with your organizer.')
        return
      }
      try {
        localStorage.removeItem(draftKey(token, moduleId))
      } catch { /* ignore */ }
      setSubmittedModules((prev) => [...prev, moduleId])
      setView('done')
      window.scrollTo({ top: 0 })
    } catch (err) {
      setSubmitError(
        `Couldn't submit: ${err instanceof Error ? err.message : 'network error'}. Your answers are saved on this phone — try again in a minute.`,
      )
    } finally {
      setSubmitting(false)
    }
  }

  const activeModule = moduleId ? moduleById(moduleId) : undefined

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      {/* Header */}
      <div className="bg-[#191A2E] px-4 py-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="font-display text-xl font-extrabold text-white">Shift</span>
          <span className="inline-flex items-center gap-[3px] relative" style={{ top: '-1px' }}>
            <svg viewBox="0 0 9 15" width="11" height="17" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#BAF14D" />
            </svg>
            <svg viewBox="0 0 9 15" width="11" height="17" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#2966E5" />
            </svg>
          </span>
          <span className="text-xs font-medium text-white/75">Walk Audit</span>
        </div>
        <h1 className="text-lg font-bold text-white">{audit.title}</h1>
        <p className="text-xs text-white/75">
          {[PURPOSE_LABELS[audit.purpose], audit.org_name, audit.city].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="h-[3px] bg-[#52B788]" />

      <div className="mx-auto max-w-[600px] px-4 py-6 pb-24">
        {view === 'picker' && (
          <>
            <div className="rounded-xl bg-white p-4 shadow-sm mb-4">
              <h2 className="font-bold text-[#191A2E]">
                {audit.area_label ?? (audit.area_type === 'route' ? 'The audit route' : 'The audit location')}
              </h2>
              {audit.scheduled_for && (
                <p className="text-xs text-[#6B7280] mt-1">
                  Audit day:{' '}
                  {new Date(audit.scheduled_for + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })}
                </p>
              )}
              <div className="mt-3">
                <VolunteerRouteMap
                  routeCoordinates={routeCoordinates}
                  center={locationCenter}
                  heightClass="h-48"
                />
              </div>
              {submittedModules.length > 0 && (
                <p className="mt-2 text-xs text-green-700">
                  You&apos;ve submitted: {submittedModules.map((m) => moduleById(m)?.name ?? m).join(', ')}
                </p>
              )}
            </div>

            <p className="mb-3 text-sm text-[#374151]">
              Pick a section. One is plenty — do more if you have time, and each one you finish
              submits on its own.
            </p>

            <div className="space-y-2.5">
              {AUDIT_MODULES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => openModule(m.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl bg-white p-4 text-left shadow-sm transition hover:ring-1 hover:ring-[#2966E5]"
                >
                  <span>
                    <span className="flex items-center gap-2 font-semibold text-[#191A2E]">
                      {m.name}
                      {m.startHere && (
                        <span className="rounded-full bg-[#BAF14D] px-2 py-0.5 text-[10px] font-bold text-[#191A2E]">
                          Start here
                        </span>
                      )}
                      {submittedModules.includes(m.id) && (
                        <CheckCircle size={15} weight="fill" className="text-green-600" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#6B7280]">{m.tagline}</span>
                  </span>
                  <CaretRight size={16} weight="bold" className="shrink-0 text-[#6B7280]" />
                </button>
              ))}
            </div>

            <p className="mt-4 inline-flex items-start gap-1.5 text-[11px] text-[#6B7280]">
              <MapTrifold size={14} weight="regular" className="mt-0.5 shrink-0" />
              In any section you can flag exact problem spots on the map and add photos — that&apos;s
              what makes findings fixable.
            </p>
          </>
        )}

        {view === 'module' && activeModule && (
          <>
            <button
              onClick={() => setView('picker')}
              className="mb-3 inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#191A2E]"
            >
              <ArrowLeft size={14} weight="bold" /> All sections
            </button>
            <h2 className="mb-1 text-lg font-bold text-[#191A2E]">{activeModule.name}</h2>
            <p className="mb-4 text-xs text-[#6B7280]">
              Answer what you can — skip anything that doesn&apos;t apply. Your answers save on this
              phone as you go.
            </p>

            <ModuleForm
              module={activeModule}
              answers={answers}
              onChange={(key, value) => setAnswers((prev) => ({ ...prev, [key]: value }))}
            />

            <div className="bg-[#191A2E] rounded-lg px-4 py-2.5 mb-4 mt-6">
              <h3 className="text-sm font-bold text-white">Wrap up</h3>
            </div>

            <PhotoField
              corridorId={audit.id}
              bucket="walk-audit-photos"
              initialPhotos={initialPhotos}
              onPhotosChange={setPhotos}
              onBusyChange={setPhotosBusy}
            />

            <FreeTextField
              label="Anything else you noticed?"
              value={notes}
              onChange={setNotes}
              rows={3}
            />

            <RadioGroup
              label="Overall, this area is…"
              value={rollup}
              options={ROLLUP_OPTIONS}
              onChange={(v) => setRollup(v)}
            />

            <div className="mb-4">
              <p className="text-sm font-medium text-[#191A2E] mb-1">Your name (optional)</p>
              <input
                value={observer}
                onChange={(e) => setObserver(e.target.value)}
                placeholder="So the organizer knows who saw what"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none"
              />
            </div>

            {submitError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-700">{submitError}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || photosBusy}
              className="w-full rounded-xl bg-[#2966E5] py-4 text-base font-bold text-white transition hover:bg-[#2966E5]/90 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : photosBusy ? 'Waiting for photos…' : 'Submit this section'}
            </button>
          </>
        )}

        {view === 'done' && (
          <div className="pt-10 text-center">
            <CheckCircle size={40} weight="regular" className="mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-bold text-[#191A2E]">Section submitted!</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#6B7280]">
              Thank you — your observations go straight to the audit organizer
              {audit.org_name ? ` at ${audit.org_name}` : ''}.
            </p>
            <button
              onClick={() => setView('picker')}
              className="mt-6 rounded-xl bg-[#2966E5] px-6 py-3 text-sm font-bold text-white"
            >
              Do another section
            </button>
          </div>
        )}
      </div>

      {/* Flag-a-spot floating button (while filling a module) */}
      {view === 'module' && (
        <button
          type="button"
          onClick={() => setPinSheetOpen(true)}
          className="fixed bottom-6 right-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-[#D97706] px-4 py-2.5 text-sm font-bold text-white shadow-lg"
        >
          <MapPin size={16} weight="fill" />
          Flag spot{pins.length > 0 ? ` (${pins.length})` : ''}
        </button>
      )}

      {pinSheetOpen && (
        <ProblemPinSheet
          routeCoordinates={routeCoordinates}
          pins={pins}
          onChange={setPins}
          onClose={() => setPinSheetOpen(false)}
          fallbackCenter={locationCenter}
        />
      )}
    </main>
  )
}
