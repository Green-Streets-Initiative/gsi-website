'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, ArrowRight, ChatsCircle, CheckCircle, Flag, Microphone, NotePencil, UsersThree,
} from '@phosphor-icons/react'
import { useDictation } from '@/components/walk-audit/useDictation'
import {
  STOP_SECTIONS, STOP_QUESTIONS, STOP_CHECK_MINUTES, STOP_TALK_MINUTES,
  type AuditStop, type StopActivity, type StopAnswer,
  type StopCheckAnswers, type StopDiscussionAnswers,
} from '@/components/walk-audit/stopModel'

interface Draft {
  checks: Record<string, StopAnswer>
  notes: Record<string, string>
  skipped: string[]
  checked: boolean
  discussion: string
  discussionSaved: boolean
}

const EMPTY_DRAFT: Draft = {
  checks: {}, notes: {}, skipped: [], checked: false, discussion: '', discussionSaved: false,
}

const TALK_PROMPTS = [
  'What stood out here?',
  'What would you change first?',
  'Who has the power to fix it?',
]

interface Props {
  token: string
  stop: AuditStop
  index: number
  total: number
  observer: string
  /** What others have already sent in for this stop. */
  activity: StopActivity[]
  nextStop: AuditStop | null
  onChecked: (stopId: string) => void
  onNotesSaved: (stopId: string) => void
  onBack: () => void
  onNext: () => void
  /** Opens "Flag this spot" (photo + note) and comes back to this stop. */
  onFlag: () => void
}

// One random id per phone, so a walker who saves a stop twice counts once.
function walkerKey(): string {
  try {
    let key = localStorage.getItem('shift-walk-audit-walker-key')
    if (!key) {
      key = crypto.randomUUID()
      localStorage.setItem('shift-walk-audit-walker-key', key)
    }
    return key
  } catch {
    return ''
  }
}

export function stopDraftKey(token: string, stopId: string) {
  return `shift-walk-audit-stop:${token}:${stopId}`
}

export default function StopCheck({
  token, stop, index, total, observer, activity, nextStop, onChecked, onNotesSaved, onBack, onNext, onFlag,
}: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [loaded, setLoaded] = useState(false)
  const [takingNotes, setTakingNotes] = useState(false)
  // The notetaker can go straight to the discussion and answer afterwards.
  const [talkFirst, setTalkFirst] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dictation = useDictation((transcript) => {
    update((prev) => ({ discussion: prev.discussion ? `${prev.discussion} ${transcript}` : transcript }))
  })

  // Restore whatever this walker already entered at this stop.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(stopDraftKey(token, stop.id))
      if (raw) {
        const saved = { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) }
        setDraft(saved)
        if (saved.discussion && !saved.discussionSaved) setTakingNotes(true)
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [token, stop.id])

  // Takes a function so quick taps in a row each build on the last one.
  function update(patch: Partial<Draft> | ((prev: Draft) => Partial<Draft>)) {
    setDraft((prev) => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }
      try {
        localStorage.setItem(stopDraftKey(token, stop.id), JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
  }

  function answer(key: string, value: StopAnswer) {
    update((prev) => {
      const checks = { ...prev.checks }
      if (checks[key] === value) delete checks[key]
      else checks[key] = value
      return { checks }
    })
  }

  function toggleSkip(sectionId: string) {
    update((prev) => ({
      skipped: prev.skipped.includes(sectionId)
        ? prev.skipped.filter((s) => s !== sectionId)
        : [...prev.skipped, sectionId],
    }))
  }

  const askedCount = useMemo(
    () => STOP_SECTIONS.filter((s) => !draft.skipped.includes(s.id)).reduce((sum, s) => sum + s.questions.length, 0),
    [draft.skipped],
  )
  const answeredCount = STOP_QUESTIONS.filter(
    (q) => !draft.skipped.includes(q.section) && draft.checks[q.key],
  ).length

  const othersChecked = activity.filter((a) => a.kind === 'stop_check').length
  const noteTakers = [
    ...new Set(activity.filter((a) => a.kind === 'stop_discussion').map((a) => a.observer_name ?? 'Someone')),
  ]

  async function saveCheck() {
    setSaving(true)
    setError(null)
    try {
      const checks: Record<string, StopAnswer> = {}
      const notes: Record<string, string> = {}
      for (const q of STOP_QUESTIONS) {
        if (draft.skipped.includes(q.section)) continue
        const a = draft.checks[q.key]
        if (!a) continue
        checks[q.key] = a
        const note = draft.notes[q.key]?.trim()
        if (a === 'no' && note) notes[q.key] = note
      }
      const answers: StopCheckAnswers = {
        stop_id: stop.id,
        stop_name: stop.name,
        walker_key: walkerKey() || undefined,
        checks,
        notes,
        skipped_sections: draft.skipped,
      }
      const { data: accepted, error: rpcError } = await supabase.rpc('submit_walk_audit', {
        p_token: token,
        p_module: 'stop_check',
        p_observer: observer,
        p_answers: answers,
        p_pins: [],
        p_photos: [],
      })
      if (rpcError) throw rpcError
      if (!accepted) {
        setError('This audit link is no longer active. Check with your organizer.')
        return
      }
      update({ checked: true })
      onChecked(stop.id)
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(`Couldn't save: ${err instanceof Error ? err.message : 'network error'}. Your answers are still here. Try again in a moment.`)
    } finally {
      setSaving(false)
    }
  }

  async function saveNotes() {
    if (!draft.discussion.trim()) return
    setSaving(true)
    setError(null)
    try {
      const answers: StopDiscussionAnswers = {
        stop_id: stop.id,
        stop_name: stop.name,
        notes: draft.discussion.trim(),
      }
      const { data: accepted, error: rpcError } = await supabase.rpc('submit_walk_audit', {
        p_token: token,
        p_module: 'stop_discussion',
        p_observer: observer,
        p_answers: answers,
        p_pins: [],
        p_photos: [],
      })
      if (rpcError) throw rpcError
      if (!accepted) {
        setError('This audit link is no longer active. Check with your organizer.')
        return
      }
      update({ discussionSaved: true })
      setTakingNotes(false)
      onNotesSaved(stop.id)
    } catch (err) {
      setError(`Couldn't save: ${err instanceof Error ? err.message : 'network error'}. Your notes are still here. Try again in a moment.`)
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  const header = (
    <>
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#191A2E]"
      >
        <ArrowLeft size={14} weight="bold" /> Back to the map
      </button>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#191A2E] text-lg font-extrabold text-white">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#4B5563]">Stop {index + 1} of {total}</p>
          <h2 className="text-lg font-bold leading-tight text-[#191A2E]">{stop.name}</h2>
        </div>
      </div>
      {stop.note && (
        <p className="mt-3 rounded-lg bg-[#EBF0FD] px-3 py-2 text-[15px] text-[#1E3A8A]">{stop.note}</p>
      )}
    </>
  )

  // ── Part 2: talk it over ──
  if (draft.checked || talkFirst) {
    return (
      <>
        {header}
        {draft.checked ? (
          <p className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-[#3D5407]">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle size={16} weight="fill" className="text-[#52B788]" /> Your answers are saved
            </span>
            <button onClick={() => { update({ checked: false }); setTalkFirst(false) }} className="font-semibold text-[#2966E5]">
              Change them
            </button>
          </p>
        ) : (
          <button
            onClick={() => setTalkFirst(false)}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2966E5]"
          >
            <ArrowLeft size={14} weight="bold" /> Answer the questions
          </button>
        )}

        <div className="mt-3 rounded-2xl bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-base font-bold text-[#191A2E]">
            <ChatsCircle size={20} weight="fill" className="text-[#2966E5]" />
            Talk it over as a group
          </p>
          <p className="mt-1 text-[13px] text-[#4B5563]">About {STOP_TALK_MINUTES} minutes</p>
          <ul className="mt-3 space-y-2">
            {TALK_PROMPTS.map((p) => (
              <li key={p} className="rounded-lg bg-[#F4F8EE] px-3 py-2.5 text-[15px] font-medium text-[#191A2E]">{p}</li>
            ))}
          </ul>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-5 shadow-sm">
          {draft.discussionSaved && !takingNotes ? (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#3D5407]">
                <CheckCircle size={16} weight="fill" className="text-[#52B788]" /> Group notes saved
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#374151]">{draft.discussion}</p>
              <button
                onClick={() => { update({ discussionSaved: false }); setTakingNotes(true) }}
                className="mt-3 text-sm font-semibold text-[#2966E5]"
              >
                Add more
              </button>
            </>
          ) : takingNotes ? (
            <>
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#191A2E]">
                <NotePencil size={17} weight="regular" /> The group&apos;s notes
              </p>
              <div className="relative">
                <textarea
                  value={draft.discussion}
                  onChange={(e) => update({ discussion: e.target.value })}
                  rows={6}
                  placeholder="What people said, in their words"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm focus:border-[#2966E5] focus:outline-none"
                />
                {dictation.supported && (
                  <button
                    onClick={dictation.toggle}
                    aria-label={dictation.listening ? 'Stop dictating' : 'Dictate'}
                    className={`absolute right-2 top-2 rounded-full p-1.5 transition ${
                      dictation.listening
                        ? 'animate-pulse bg-red-500 text-white'
                        : 'bg-gray-100 text-[#6B7280] hover:bg-[#2966E5]/10 hover:text-[#2966E5]'
                    }`}
                  >
                    <Microphone size={16} weight={dictation.listening ? 'fill' : 'regular'} />
                  </button>
                )}
              </div>
              <button
                onClick={saveNotes}
                disabled={saving || !draft.discussion.trim()}
                className="mt-2 w-full rounded-xl bg-[#2966E5] py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save the group’s notes'}
              </button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm font-bold text-[#191A2E]">
                <UsersThree size={18} weight="regular" /> One person takes notes
              </p>
              {noteTakers.length > 0 ? (
                <p className="mt-1 text-sm text-[#374151]">
                  {noteTakers.join(' and ')} saved notes for this stop.
                </p>
              ) : (
                <p className="mt-1 text-sm text-[#374151]">
                  The notes go to the organizer with everyone&apos;s answers.
                </p>
              )}
              <button
                onClick={() => setTakingNotes(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#2966E5] px-4 py-2.5 text-sm font-bold text-[#2966E5]"
              >
                <NotePencil size={16} weight="bold" />
                {noteTakers.length > 0 ? 'Add notes too' : 'I’m taking notes'}
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={onNext}
          className="mt-4 flex w-full items-center justify-between rounded-xl bg-[#191A2E] p-4 text-left text-white"
        >
          <span>
            <span className="block font-semibold">
              {nextStop ? `Walk to stop ${index + 2}` : 'Back to the map'}
            </span>
            <span className="block text-sm text-white/75">
              {nextStop ? nextStop.name : 'That was the last stop'}
            </span>
          </span>
          <ArrowRight size={18} weight="bold" className="shrink-0 text-[#BAF14D]" />
        </button>
      </>
    )
  }

  // ── Part 1: the yes/no check ──
  return (
    <>
      {header}
      <p className="mt-3 text-[15px] text-[#374151]">
        About {STOP_CHECK_MINUTES} minutes, alone or with a partner. Answer what you can see from here.
        {othersChecked > 0 && (
          <span className="text-[#4B5563]"> {othersChecked} {othersChecked === 1 ? 'person has' : 'people have'} answered so far.</span>
        )}
      </p>
      <button
        onClick={onFlag}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#D97706] px-4 py-2 text-sm font-bold text-[#B45309]"
      >
        <Flag size={15} weight="fill" /> Flag something with a photo
      </button>

      {/* Jump bar: where you are in the questions, and how far along */}
      <div className="sticky top-0 z-10 -mx-4 mt-3 flex gap-1.5 overflow-x-auto bg-[#F4F8EE]/95 px-4 py-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STOP_SECTIONS.map((section) => {
          const skipped = draft.skipped.includes(section.id)
          const done = section.questions.filter((q) => draft.checks[q.key]).length
          const complete = skipped || done === section.questions.length
          return (
            <a
              key={section.id}
              href={`#stop-${section.id}`}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                complete
                  ? 'border-[#52B788] bg-[#52B788]/15 text-[#2C6E49]'
                  : 'border-gray-300 bg-white text-[#374151]'
              }`}
            >
              {complete && <CheckCircle size={13} weight="fill" />}
              {section.nav}
              {!complete && <span className="font-normal text-[#4B5563]">{done}/{section.questions.length}</span>}
            </a>
          )
        })}
      </div>

      {STOP_SECTIONS.map((section) => {
        const skipped = draft.skipped.includes(section.id)
        return (
          <div key={section.id} id={`stop-${section.id}`} className="mt-3 scroll-mt-14 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 bg-[#191A2E] px-4 py-2.5">
              <h3 className="text-sm font-bold text-white">{section.lead}</h3>
              {section.skipLabel && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-white/85">
                  <input
                    type="checkbox"
                    checked={skipped}
                    onChange={() => toggleSkip(section.id)}
                    className="h-4 w-4 rounded border-white/40"
                  />
                  {section.skipLabel}
                </label>
              )}
            </div>
            {!skipped && (
              <div className="divide-y divide-gray-100">
                {section.questions.map((q) => {
                  const a = draft.checks[q.key]
                  return (
                    <div key={q.key} className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <p className="min-w-0 flex-1 text-[15px] text-[#191A2E]">…{q.label}</p>
                        <div className="flex shrink-0 gap-1.5" role="group" aria-label={q.label}>
                          <button
                            type="button"
                            aria-pressed={a === 'yes'}
                            onClick={() => answer(q.key, 'yes')}
                            className={`h-11 w-14 rounded-lg border text-sm font-bold transition ${
                              a === 'yes'
                                ? 'border-[#1F5F3F] bg-[#2C7A52] text-white'
                                : 'border-gray-200 bg-white text-[#374151]'
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            aria-pressed={a === 'no'}
                            onClick={() => answer(q.key, 'no')}
                            className={`h-11 w-14 rounded-lg border text-sm font-bold transition ${
                              a === 'no'
                                ? 'border-[#92400E] bg-[#B45309] text-white'
                                : 'border-gray-200 bg-white text-[#374151]'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                      {a === 'no' && (
                        <input
                          value={draft.notes[q.key] ?? ''}
                          onChange={(e) => update((prev) => ({ notes: { ...prev.notes, [q.key]: e.target.value } }))}
                          placeholder="What did you see? (optional)"
                          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={saveCheck}
        disabled={saving || answeredCount === 0}
        className="mt-4 w-full rounded-xl bg-[#2966E5] py-4 text-base font-bold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save my answers'}
      </button>
      <p className="mt-2 text-center text-[13px] text-[#4B5563]">
        {answeredCount} of {askedCount} answered
      </p>
      <button
        onClick={() => { setTalkFirst(true); window.scrollTo({ top: 0 }) }}
        className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-semibold text-[#2966E5]"
      >
        <NotePencil size={15} weight="bold" /> Taking notes for the group? Go to the discussion
      </button>
    </>
  )
}
