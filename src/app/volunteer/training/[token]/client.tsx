'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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

  // Scroll to top when opening/closing a module
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeModuleIndex])

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
        lifecycle_phase: 'onboarded',
      })
      .eq('id', props.volunteerId)

    // Notify GSI admin of completion (fire-and-forget)
    supabase.functions.invoke('training-complete-notify', {
      body: {
        volunteer_id: props.volunteerId,
        track_title: track.title,
        volunteer_name: volunteerName,
        school_name: schoolName,
      },
    }).catch(() => {})

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
            Congratulations, {volunteerName}! You&apos;ve completed
            <br /><strong>{track.title}</strong>
            <br />for {schoolName}.
          </p>
          {track.recertificationMonths && (
            <p className="mt-2 text-sm text-[#6B7280]">
              Your certification is valid for {track.recertificationMonths}{" "}months. You&apos;ll receive a reminder before it expires.
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

      {/* Track description + guide download */}
      <div className="mx-auto max-w-2xl px-6 pt-6">
        {track.description && (
          <p className="text-sm text-[#6B7280]">{track.description}</p>
        )}
        {track.guidePdfStoragePath && (
          <GuideDownloadButton storagePath={track.guidePdfStoragePath} />
        )}
      </div>

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
                    {mod.contentMarkdown && <span>Reading</span>}
                    {mod.screenshots.length > 0 && (
                      <span>{mod.screenshots.length} screenshot{mod.screenshots.length !== 1 ? 's' : ''}</span>
                    )}
                    {mod.videoStoragePath && <span>Video</span>}
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
  const [phase, setPhase] = useState<'learn' | 'quiz'>('learn')

  // Scroll to top on phase change (learn → quiz, retake)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [phase])

  const videoRef = useRef<HTMLVideoElement>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [videoExpanded, setVideoExpanded] = useState(false)

  // Quiz state
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [submitted, setSubmitted] = useState(false)
  const [quizScore, setQuizScore] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const hasVideo = !!mod.videoStoragePath
  const hasContent = !!mod.contentMarkdown || mod.screenshots.length > 0

  // Load signed URL for video
  async function loadVideoUrl() {
    if (!mod.videoStoragePath || signedUrl) return
    setUrlLoading(true)
    const { data } = await supabase.storage
      .from('training-videos')
      .createSignedUrl(mod.videoStoragePath, 4 * 60 * 60)
    if (data?.signedUrl) setSignedUrl(data.signedUrl)
    setUrlLoading(false)
  }

  function handleAdvanceToQuiz() {
    if (mod.quizRequired && mod.questions.length > 0) {
      setPhase('quiz')
    } else {
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
    let correct = 0
    for (const q of mod.questions) {
      if (answers.get(q.id) === q.correctOptionId) correct++
    }
    const score = Math.round((correct / mod.questions.length) * 100)
    setQuizScore(score)
    setSubmitted(true)
    const passed = score >= 80
    setSaving(true)

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
    // Stay on quiz phase so volunteer can review answers — they click Continue manually
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
        {/* ── Learn Phase ── */}
        {phase === 'learn' && (
          <div className="space-y-6">
            {/* Inline content */}
            {mod.contentMarkdown && (
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-[#E5E7EB]">
                <MarkdownContent text={mod.contentMarkdown} />
              </div>
            )}

            {/* Screenshots */}
            {mod.screenshots.length > 0 && (
              <div className="space-y-4">
                {mod.screenshots.map((s, i) => (
                  <div key={i} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#E5E7EB]">
                    <img
                      src={s.url}
                      alt={s.caption || `Screenshot ${i + 1}`}
                      className="w-full rounded-lg"
                      loading="lazy"
                    />
                    {s.caption && (
                      <p className="mt-2 text-center text-xs text-[#6B7280] italic">
                        {s.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* No content yet placeholder */}
            {!hasContent && !hasVideo && (
              <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-[#E5E7EB]">
                <span className="text-3xl">📝</span>
                <h2 className="mt-3 font-semibold text-[#191A2E]">Content Coming Soon</h2>
                <p className="mt-2 text-sm text-[#6B7280]">
                  Training material for this module is being prepared.
                  You can proceed to the {mod.quizRequired ? 'quiz' : 'acknowledgment'} now.
                </p>
              </div>
            )}

            {/* Optional video (collapsible) */}
            {hasVideo && (
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-[#E5E7EB] overflow-hidden">
                <button
                  onClick={() => {
                    setVideoExpanded(!videoExpanded)
                    if (!videoExpanded) loadVideoUrl()
                  }}
                  className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-[#F9FAFB] transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🎬</span>
                    <div>
                      <p className="text-sm font-medium text-[#191A2E]">Watch the video</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {mod.videoDurationSeconds
                          ? `${Math.ceil(mod.videoDurationSeconds / 60)} min · Optional`
                          : 'Optional'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[#9CA3AF]">{videoExpanded ? '▾' : '▸'}</span>
                </button>
                {videoExpanded && (
                  <div className="border-t border-[#E5E7EB] p-4">
                    {urlLoading && (
                      <div className="flex h-48 items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#52B788] border-t-transparent" />
                      </div>
                    )}
                    {signedUrl && (
                      <video ref={videoRef} src={signedUrl} controls className="w-full rounded-lg" />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Continue button — always enabled */}
            <button
              onClick={handleAdvanceToQuiz}
              disabled={saving}
              className="w-full rounded-xl bg-[#2966E5] py-3 text-sm font-semibold text-white transition hover:bg-[#2966E5]/90 disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : mod.quizRequired
                ? 'Continue to Quiz →'
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
                <p className="text-2xl font-bold">{quizScore}%</p>
                <p className={`mt-1 font-medium ${
                  quizScore !== null && quizScore >= 80 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {quizScore !== null && quizScore >= 80
                    ? 'You passed! 🎉'
                    : 'Not quite — review the explanations above and try again.'}
                </p>
                {quizScore !== null && quizScore >= 80 && (
                  <p className="mt-2 text-sm text-green-600">
                    Scroll up to review your answers. Correct answers are shown in green.
                  </p>
                )}
                <div className="mt-4 flex items-center justify-center gap-3">
                  {quizScore !== null && quizScore >= 80 ? (
                    <button
                      onClick={() => onComplete(true, quizScore)}
                      className="rounded-xl bg-[#2966E5] px-8 py-3 text-sm font-semibold text-white hover:bg-[#2966E5]/90 transition"
                    >
                      Continue →
                    </button>
                  ) : (
                    <button
                      onClick={handleRetake}
                      className="rounded-xl bg-[#191A2E] px-8 py-3 text-sm font-semibold text-white hover:bg-[#191A2E]/90 transition"
                    >
                      Retake Quiz
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  )
}


// ── Markdown Content Renderer ──────────────────────────────────

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let key = 0

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc pl-5 space-y-1 text-sm text-[#374151] leading-relaxed">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Heading
    if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h3 key={key++} className="text-base font-bold text-[#191A2E] mt-4 first:mt-0">
          {renderInline(trimmed.slice(3))}
        </h3>
      )
    } else if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h4 key={key++} className="text-sm font-bold text-[#191A2E] mt-3">
          {renderInline(trimmed.slice(4))}
        </h4>
      )
    }
    // List item
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2))
    }
    // Numbered list
    else if (/^\d+\.\s/.test(trimmed)) {
      listItems.push(trimmed.replace(/^\d+\.\s/, ''))
    }
    // Empty line
    else if (trimmed === '') {
      flushList()
    }
    // Paragraph
    else {
      flushList()
      elements.push(
        <p key={key++} className="text-sm text-[#374151] leading-relaxed">
          {renderInline(trimmed)}
        </p>
      )
    }
  }
  flushList()

  return <div className="space-y-3">{elements}</div>
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[#191A2E]">{part.slice(2, -2)}</strong>
    }
    // Link: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    const segments: React.ReactNode[] = []
    let lastIndex = 0
    let match
    while ((match = linkRegex.exec(part)) !== null) {
      if (match.index > lastIndex) segments.push(part.slice(lastIndex, match.index))
      segments.push(
        <a key={`${i}-${match.index}`} href={match[2]} className="text-[#2966E5] underline" target="_blank" rel="noopener noreferrer">
          {match[1]}
        </a>
      )
      lastIndex = match.index + match[0].length
    }
    if (segments.length > 0) {
      if (lastIndex < part.length) segments.push(part.slice(lastIndex))
      return <span key={i}>{segments}</span>
    }
    return part
  })
}


// ── Guide Download Button ──────────────────────────────────────

function GuideDownloadButton({ storagePath }: { storagePath: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    const { data } = await supabase.storage
      .from('training-videos') // PDFs stored alongside videos
      .createSignedUrl(storagePath, 60 * 60) // 1 hour
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#2966E5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2966E5]/90 disabled:opacity-50"
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : (
        <span>📄</span>
      )}
      Download Reference Guide
    </button>
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
