'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TrainingPortalProps } from './page'

type ModuleWithState = TrainingPortalProps['modules'][number]
type QuestionData = ModuleWithState['questions'][number]

// ── Main Component ─────────────────────────────────────────────

export default function TrainingPortalClient(props: TrainingPortalProps) {
  const { track, modules, volunteerName, schoolName, prerequisiteMet } = props

  const [activeModuleIndex, setActiveModuleIndex] = useState<number | null>(null)
  const [completions, setCompletions] = useState<Map<string, { completedAt: string; quizPassed: boolean | null; quizScore: number | null }>>(
    () => {
      const map = new Map()
      for (const m of modules) {
        if (m.completion?.completedAt) {
          map.set(m.id, {
            completedAt: m.completion.completedAt,
            quizPassed: m.completion.quizPassed,
            quizScore: m.completion.quizScore,
          })
        }
      }
      return map
    }
  )
  const [certified, setCertified] = useState(false)

  // Determine which modules are unlocked (sequential)
  const isModuleUnlocked = useCallback((index: number) => {
    if (index === 0) return true
    const prevModule = modules[index - 1]
    return completions.has(prevModule.id)
  }, [modules, completions])

  const completedCount = completions.size
  const totalCount = modules.length
  const allComplete = completedCount === totalCount

  async function handleModuleComplete(moduleId: string, quizPassed: boolean | null, quizScore: number | null) {
    setCompletions((prev) => {
      const next = new Map(prev)
      next.set(moduleId, { completedAt: new Date().toISOString(), quizPassed, quizScore })
      return next
    })

    // Check if all modules now complete → certify
    const newCompleted = completions.size + 1
    if (newCompleted >= totalCount) {
      await certifyTrack()
    }
  }

  async function certifyTrack() {
    const expiresAt = track.recertificationMonths
      ? new Date(Date.now() + track.recertificationMonths * 30.44 * 24 * 60 * 60 * 1000).toISOString()
      : null

    // Insert track completion
    await supabase.from('volunteer_track_completions').upsert({
      volunteer_id: props.volunteerId,
      track_id: track.id,
      certified_at: new Date().toISOString(),
      certification_expires_at: expiresAt,
    })

    // Update denormalized cache on volunteer_profiles
    await supabase
      .from('volunteer_profiles')
      .update({
        training_completed: true,
        training_completed_at: new Date().toISOString(),
      })
      .eq('id', props.volunteerId)

    setCertified(true)
  }

  // ── Prerequisite not met ──
  if (!prerequisiteMet) {
    return (
      <main className="min-h-screen bg-[#F4F8EE] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold text-[#191A2E]">Prerequisite Required</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            You need to complete the Parent Volunteer Certification before starting the {track.title}.
            Please check your email for a training link, or contact your Green Streets coordinator.
          </p>
        </div>
      </main>
    )
  }

  // ── Certified ──
  if (certified) {
    return (
      <main className="min-h-screen bg-[#F4F8EE] flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <span className="text-4xl">🎉</span>
          </div>
          <h1 className="text-2xl font-bold text-[#191A2E]">Certification Complete!</h1>
          <p className="mt-3 text-[#6B7280]">
            Congratulations, {volunteerName}! You&apos;ve completed the <strong>{track.title}</strong> for {schoolName}.
          </p>
          {track.recertificationMonths && (
            <p className="mt-2 text-sm text-[#6B7280]">
              Your certification is valid for {track.recertificationMonths} months.
              You&apos;ll receive a reminder before it expires.
            </p>
          )}
          <p className="mt-4 text-sm text-[#6B7280]">
            You can close this page. Your coordinator has been notified.
          </p>
        </div>
      </main>
    )
  }

  // ── Active module view ──
  if (activeModuleIndex !== null) {
    const mod = modules[activeModuleIndex]
    return (
      <ModuleView
        module={mod}
        volunteerId={props.volunteerId}
        trackTitle={track.title}
        moduleIndex={activeModuleIndex}
        totalModules={totalCount}
        onComplete={(quizPassed, quizScore) => {
          handleModuleComplete(mod.id, quizPassed, quizScore)
          setActiveModuleIndex(null)
        }}
        onBack={() => setActiveModuleIndex(null)}
      />
    )
  }

  // ── Track overview ──
  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      {/* Header */}
      <div className="bg-[#191A2E] px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 text-sm text-[#52B788]">
            <span>Shift for Schools</span>
            <span className="text-[#52B788]/50">·</span>
            <span>Volunteer Training</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white">{track.title}</h1>
          <p className="mt-1 text-sm text-[#8A8DA8]">
            {volunteerName} · {schoolName}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-[#191A2E] px-6 pb-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between text-xs text-[#8A8DA8] mb-2">
            <span>{completedCount} of {totalCount} modules complete</span>
            <span>{Math.round((completedCount / totalCount) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#242538]">
            <div
              className="h-full rounded-full bg-[#52B788] transition-all duration-500"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Track description */}
      {track.description && (
        <div className="mx-auto max-w-2xl px-6 pt-6">
          <p className="text-sm text-[#6B7280]">{track.description}</p>
        </div>
      )}

      {/* Module list */}
      <div className="mx-auto max-w-2xl px-6 py-6 space-y-3">
        {modules.map((mod, index) => {
          const isComplete = completions.has(mod.id)
          const unlocked = isModuleUnlocked(index)

          return (
            <button
              key={mod.id}
              onClick={() => unlocked && setActiveModuleIndex(index)}
              disabled={!unlocked}
              className={`w-full rounded-xl p-5 text-left transition-all ${
                isComplete
                  ? 'bg-white shadow-sm ring-1 ring-green-200'
                  : unlocked
                  ? 'bg-white shadow-sm ring-1 ring-[#E5E7EB] hover:ring-[#2966E5] hover:shadow-md cursor-pointer'
                  : 'bg-[#F9FAFB] opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Status icon */}
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  isComplete
                    ? 'bg-green-100 text-green-700'
                    : unlocked
                    ? 'bg-[#2966E5]/10 text-[#2966E5]'
                    : 'bg-[#F3F4F6] text-[#9CA3AF]'
                }`}>
                  {isComplete ? '✓' : mod.moduleNumber}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold ${
                    isComplete ? 'text-green-800' : unlocked ? 'text-[#191A2E]' : 'text-[#9CA3AF]'
                  }`}>
                    {mod.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[#9CA3AF]">
                    {mod.videoDurationSeconds && (
                      <span>{Math.ceil(mod.videoDurationSeconds / 60)} min video</span>
                    )}
                    {!mod.videoStoragePath && (
                      <span>Video coming soon</span>
                    )}
                    <span>{mod.quizRequired ? 'Quiz' : 'Acknowledgment'}</span>
                    {isComplete && (
                      <span className="text-green-600">
                        {completions.get(mod.id)?.quizScore != null
                          ? `Score: ${completions.get(mod.id)!.quizScore}%`
                          : 'Complete'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                {unlocked && !isComplete && (
                  <span className="mt-1 text-[#2966E5] text-lg">→</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* All complete but not yet certified message */}
      {allComplete && !certified && (
        <div className="mx-auto max-w-2xl px-6 pb-8">
          <div className="rounded-xl bg-green-50 p-6 text-center ring-1 ring-green-200">
            <p className="font-semibold text-green-800">All modules complete!</p>
            <p className="mt-1 text-sm text-green-700">
              Processing your certification...
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mx-auto max-w-2xl px-6 pb-12">
        <p className="text-center text-xs text-[#9CA3AF]">
          Shift for Schools · Green Streets Initiative · gogreenstreets.org
        </p>
      </div>
    </main>
  )
}


// ── Module View ────────────────────────────────────────────────

function ModuleView({
  module: mod,
  volunteerId,
  trackTitle,
  moduleIndex,
  totalModules,
  onComplete,
  onBack,
}: {
  module: ModuleWithState
  volunteerId: string
  trackTitle: string
  moduleIndex: number
  totalModules: number
  onComplete: (quizPassed: boolean | null, quizScore: number | null) => void
  onBack: () => void
}) {
  const [phase, setPhase] = useState<'video' | 'quiz' | 'results'>('video')
  const [videoProgress, setVideoProgress] = useState(0) // 0-1
  const videoRef = useRef<HTMLVideoElement>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)

  // Quiz state
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [submitted, setSubmitted] = useState(false)
  const [quizScore, setQuizScore] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const videoReady = videoProgress >= 0.9
  const hasVideo = !!mod.videoStoragePath

  // Load signed URL for video
  async function loadVideoUrl() {
    if (!mod.videoStoragePath || signedUrl) return
    setUrlLoading(true)
    const { data } = await supabase.storage
      .from('training-videos')
      .createSignedUrl(mod.videoStoragePath, 4 * 60 * 60) // 4 hours
    if (data?.signedUrl) setSignedUrl(data.signedUrl)
    setUrlLoading(false)
  }

  // Track video progress
  function handleTimeUpdate() {
    if (!videoRef.current) return
    const { currentTime, duration } = videoRef.current
    if (duration > 0) {
      setVideoProgress(currentTime / duration)
    }
  }

  function handleAdvanceToQuiz() {
    if (mod.quizRequired && mod.questions.length > 0) {
      setPhase('quiz')
    } else {
      // Acknowledgment module — complete immediately
      handleAcknowledge()
    }
  }

  async function handleAcknowledge() {
    setSaving(true)
    await supabase.from('volunteer_module_completions').upsert({
      volunteer_id: volunteerId,
      module_id: mod.id,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      quiz_passed: null,
      quiz_attempts: 0,
      quiz_score: null,
    }, { onConflict: 'volunteer_id,module_id' })
    setSaving(false)
    onComplete(null, null)
  }

  async function handleQuizSubmit() {
    if (answers.size < mod.questions.length) return

    // Score
    let correct = 0
    for (const q of mod.questions) {
      if (answers.get(q.id) === q.correctOptionId) correct++
    }
    const score = Math.round((correct / mod.questions.length) * 100)
    setQuizScore(score)
    setSubmitted(true)

    const passed = score >= 80

    setSaving(true)

    // Get current attempt count
    const { data: existing } = await supabase
      .from('volunteer_module_completions')
      .select('quiz_attempts')
      .eq('volunteer_id', volunteerId)
      .eq('module_id', mod.id)
      .single()

    const attempts = (existing?.quiz_attempts ?? 0) + 1

    await supabase.from('volunteer_module_completions').upsert({
      volunteer_id: volunteerId,
      module_id: mod.id,
      started_at: new Date().toISOString(),
      completed_at: passed ? new Date().toISOString() : null,
      quiz_passed: passed,
      quiz_attempts: attempts,
      quiz_score: score,
    }, { onConflict: 'volunteer_id,module_id' })

    setSaving(false)

    if (passed) {
      setPhase('results')
    }
  }

  function handleRetake() {
    setAnswers(new Map())
    setSubmitted(false)
    setQuizScore(null)
    setPhase('quiz')
  }

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      {/* Header */}
      <div className="bg-[#191A2E] px-6 py-6">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-1 text-sm text-[#8A8DA8] hover:text-white transition"
          >
            ← Back to {trackTitle}
          </button>
          <div className="flex items-center gap-2 text-xs text-[#52B788]">
            <span>Module {moduleIndex + 1} of {totalModules}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-white">{mod.title}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-6">
        {/* ── Video Phase ── */}
        {phase === 'video' && (
          <div className="space-y-6">
            {hasVideo ? (
              <>
                <div className="overflow-hidden rounded-xl bg-black shadow-lg">
                  {!signedUrl && !urlLoading && (
                    <button
                      onClick={loadVideoUrl}
                      className="flex h-64 w-full items-center justify-center bg-[#242538] text-white transition hover:bg-[#2f3049]"
                    >
                      <div className="text-center">
                        <span className="text-4xl">▶</span>
                        <p className="mt-2 text-sm text-[#8A8DA8]">Click to load video</p>
                      </div>
                    </button>
                  )}
                  {urlLoading && (
                    <div className="flex h-64 w-full items-center justify-center bg-[#242538]">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#52B788] border-t-transparent" />
                    </div>
                  )}
                  {signedUrl && (
                    <video
                      ref={videoRef}
                      src={signedUrl}
                      controls
                      onTimeUpdate={handleTimeUpdate}
                      className="w-full"
                    />
                  )}
                </div>

                {/* Progress indicator */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[#6B7280]">
                    {videoReady ? (
                      <span className="text-green-600 font-medium">✓ Video complete — you can continue</span>
                    ) : (
                      <span>Watch at least 90% of the video to continue</span>
                    )}
                  </div>
                  <div className="text-xs text-[#9CA3AF]">
                    {Math.round(videoProgress * 100)}%
                  </div>
                </div>
              </>
            ) : (
              /* No video uploaded yet — allow proceeding */
              <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-[#E5E7EB]">
                <span className="text-4xl">🎬</span>
                <h2 className="mt-4 font-semibold text-[#191A2E]">Video Coming Soon</h2>
                <p className="mt-2 text-sm text-[#6B7280]">
                  The training video for this module is still being produced.
                  You can proceed to the {mod.quizRequired ? 'quiz' : 'acknowledgment'} now.
                </p>
              </div>
            )}

            {/* Continue button */}
            <button
              onClick={handleAdvanceToQuiz}
              disabled={hasVideo && !videoReady && !!signedUrl}
              className={`w-full rounded-xl py-3 text-sm font-semibold transition ${
                !hasVideo || videoReady
                  ? 'bg-[#2966E5] text-white hover:bg-[#2966E5]/90'
                  : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
              }`}
            >
              {saving
                ? 'Saving...'
                : mod.quizRequired
                ? 'Continue to Quiz'
                : 'I Acknowledge'}
            </button>
          </div>
        )}

        {/* ── Quiz Phase ── */}
        {phase === 'quiz' && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-[#E5E7EB]">
              <h2 className="font-semibold text-[#191A2E]">
                Quiz — {mod.title}
              </h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Answer all questions. You need 80% to pass. You can retake the quiz if needed.
              </p>
            </div>

            {mod.questions.map((q, qi) => (
              <QuestionCard
                key={q.id}
                question={q}
                questionNumber={qi + 1}
                selectedAnswer={answers.get(q.id) ?? null}
                onSelect={(optionId) => {
                  if (submitted) return
                  setAnswers((prev) => {
                    const next = new Map(prev)
                    next.set(q.id, optionId)
                    return next
                  })
                }}
                showResult={submitted}
              />
            ))}

            {/* Submit / Results */}
            {!submitted ? (
              <button
                onClick={handleQuizSubmit}
                disabled={answers.size < mod.questions.length || saving}
                className={`w-full rounded-xl py-3 text-sm font-semibold transition ${
                  answers.size >= mod.questions.length
                    ? 'bg-[#2966E5] text-white hover:bg-[#2966E5]/90'
                    : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                }`}
              >
                {saving ? 'Submitting...' : `Submit Answers (${answers.size}/${mod.questions.length})`}
              </button>
            ) : (
              <div className={`rounded-xl p-6 text-center ${
                quizScore !== null && quizScore >= 80
                  ? 'bg-green-50 ring-1 ring-green-200'
                  : 'bg-red-50 ring-1 ring-red-200'
              }`}>
                <p className="text-2xl font-bold">
                  {quizScore}%
                </p>
                <p className={`mt-1 font-medium ${
                  quizScore !== null && quizScore >= 80 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {quizScore !== null && quizScore >= 80
                    ? 'You passed! 🎉'
                    : 'Not quite — review the explanations and try again.'}
                </p>

                {quizScore !== null && quizScore >= 80 ? (
                  <button
                    onClick={() => onComplete(true, quizScore)}
                    className="mt-4 rounded-xl bg-[#2966E5] px-8 py-3 text-sm font-semibold text-white hover:bg-[#2966E5]/90 transition"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    onClick={handleRetake}
                    className="mt-4 rounded-xl bg-[#191A2E] px-8 py-3 text-sm font-semibold text-white hover:bg-[#191A2E]/90 transition"
                  >
                    Retake Quiz
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Results Phase (brief, then returns to overview) ── */}
        {phase === 'results' && (
          <div className="rounded-xl bg-green-50 p-8 text-center ring-1 ring-green-200">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <span className="text-2xl">✓</span>
            </div>
            <h2 className="text-lg font-bold text-green-800">Module Complete</h2>
            <p className="mt-2 text-sm text-green-700">
              You passed with {quizScore}%.
            </p>
            <button
              onClick={() => onComplete(true, quizScore)}
              className="mt-6 rounded-xl bg-[#2966E5] px-8 py-3 text-sm font-semibold text-white hover:bg-[#2966E5]/90 transition"
            >
              Back to Track Overview
            </button>
          </div>
        )}
      </div>
    </main>
  )
}


// ── Question Card ──────────────────────────────────────────────

function QuestionCard({
  question,
  questionNumber,
  selectedAnswer,
  onSelect,
  showResult,
}: {
  question: QuestionData
  questionNumber: number
  selectedAnswer: string | null
  onSelect: (optionId: string) => void
  showResult: boolean
}) {
  const isCorrect = selectedAnswer === question.correctOptionId

  return (
    <div className={`rounded-xl bg-white p-6 shadow-sm ring-1 ${
      showResult
        ? isCorrect
          ? 'ring-green-200'
          : 'ring-red-200'
        : 'ring-[#E5E7EB]'
    }`}>
      <p className="font-medium text-[#191A2E]">
        <span className="text-[#9CA3AF] mr-2">{questionNumber}.</span>
        {question.questionText}
      </p>

      <div className="mt-4 space-y-2">
        {question.options.map((option: { id: string; text: string }) => {
          const isSelected = selectedAnswer === option.id
          const isCorrectOption = option.id === question.correctOptionId

          let optionStyle = 'ring-1 ring-[#E5E7EB] hover:ring-[#2966E5] cursor-pointer'
          if (showResult) {
            if (isCorrectOption) {
              optionStyle = 'ring-2 ring-green-500 bg-green-50'
            } else if (isSelected && !isCorrectOption) {
              optionStyle = 'ring-2 ring-red-400 bg-red-50'
            } else {
              optionStyle = 'ring-1 ring-[#E5E7EB] opacity-60'
            }
          } else if (isSelected) {
            optionStyle = 'ring-2 ring-[#2966E5] bg-blue-50'
          }

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              disabled={showResult}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm transition ${optionStyle}`}
            >
              <span className={`font-medium ${
                showResult && isCorrectOption ? 'text-green-700' : 'text-[#191A2E]'
              }`}>
                {option.text}
              </span>
            </button>
          )
        })}
      </div>

      {/* Explanation on wrong answer */}
      {showResult && !isCorrect && question.explanation && (
        <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {question.explanation}
        </div>
      )}
    </div>
  )
}
