'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  FieldRecorderCampaign,
  FieldRecorderPrompt,
  ClipEntry,
  ConsentCopy,
  ConfirmationCopy,
} from '@/lib/field-recorder-types'
import { LANGUAGE_LABELS } from '@/lib/field-recorder-types'

// ── Types ──────────────────────────────────────────────────────

type Step = 'intro' | 'consent' | 'info' | 'recording' | 'uploading' | 'confirmation'

interface Props {
  campaign: FieldRecorderCampaign
  prompts: FieldRecorderPrompt[]
}

// ── Helpers ────────────────────────────────────────────────────

function getSupportedMimeType(voiceOnly: boolean): string {
  const videoTypes = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
  const audioTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  const types = voiceOnly ? audioTypes : videoTypes
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return voiceOnly ? 'audio/webm' : 'video/webm'
}

function getFileExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4'
  return 'webm'
}

/** Strip codec params from MIME type (e.g. "video/webm;codecs=vp9,opus" -> "video/webm") */
function baseMimeType(mimeType: string): string {
  return mimeType.split(';')[0]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Component ──────────────────────────────────────────────────

export default function FieldRecorder({ campaign, prompts }: Props) {
  const [step, setStep] = useState<Step>('intro')
  const [language, setLanguage] = useState(campaign.supported_languages?.[0] ?? 'en')
  const [consentChecked, setConsentChecked] = useState(false)
  const [email, setEmail] = useState('')
  const [newsletterChecked, setNewsletterChecked] = useState(false)
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [clips, setClips] = useState<Map<string, ClipEntry>>(new Map())
  const [voiceOnly, setVoiceOnly] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordedDuration, setRecordedDuration] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // Resolve copy for the current language
  const consent: ConsentCopy = campaign.consent_copy?.[language] ?? campaign.consent_copy?.en ?? {}
  const confirmation: ConfirmationCopy =
    campaign.confirmation_copy?.[language] ?? campaign.confirmation_copy?.en ?? {}

  // ── Camera setup ─────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      setCameraReady(false)
      setPermissionDenied(false)
      const constraints: MediaStreamConstraints = voiceOnly
        ? { audio: true }
        : { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current && !voiceOnly) {
        videoRef.current.srcObject = stream
      }
      setCameraReady(true)
    } catch {
      setPermissionDenied(true)
    }
  }, [voiceOnly])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }, [])

  // Start camera when entering recording step
  useEffect(() => {
    if (step === 'recording' && !recordedBlob) {
      startCamera()
    }
    return () => {
      if (step !== 'recording') stopCamera()
    }
  }, [step, currentPromptIndex, voiceOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recording logic ──────────────────────────────────────────

  const currentPrompt = prompts[currentPromptIndex]
  const maxDuration = currentPrompt?.max_duration_seconds ?? 60

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = getSupportedMimeType(voiceOnly)
    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      // Stop the camera so playback isn't competing with the live stream
      stopCamera()
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const url = URL.createObjectURL(blob)
      // Estimate duration from elapsed timer
      const dur = Math.round((Date.now() - startTimeRef.current) / 1000)
      setRecordedBlob(blob)
      setRecordedUrl(url)
      setRecordedDuration(dur)
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }

    recorder.start(1000) // collect in 1s chunks
    startTimeRef.current = Date.now()
    setIsRecording(true)
    setElapsed(0)

    timerRef.current = setInterval(() => {
      const secs = Math.round((Date.now() - startTimeRef.current) / 1000)
      setElapsed(secs)
      if (secs >= maxDuration) {
        recorder.stop()
      }
    }, 500)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  function discardRecording() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedBlob(null)
    setRecordedUrl(null)
    setRecordedDuration(0)
    setElapsed(0)
    // Restart camera
    startCamera()
  }

  function acceptClip() {
    if (!currentPrompt || !recordedBlob) return
    const mimeType = getSupportedMimeType(voiceOnly)
    const newClips = new Map(clips)
    newClips.set(currentPrompt.id, {
      promptId: currentPrompt.id,
      blob: recordedBlob,
      mimeType,
      duration: recordedDuration,
      skipped: false,
    })
    setClips(newClips)
    advancePrompt(newClips)
  }

  function skipPrompt() {
    if (!currentPrompt) return
    const newClips = new Map(clips)
    newClips.set(currentPrompt.id, { promptId: currentPrompt.id, skipped: true })
    setClips(newClips)
    advancePrompt(newClips)
  }

  function advancePrompt(updatedClips: Map<string, ClipEntry>) {
    stopCamera()
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedBlob(null)
    setRecordedUrl(null)
    setRecordedDuration(0)
    setElapsed(0)

    if (currentPromptIndex < prompts.length - 1) {
      setCurrentPromptIndex(currentPromptIndex + 1)
    } else {
      // All prompts complete — submit
      handleSubmit(updatedClips)
    }
  }

  // ── Submit ───────────────────────────────────────────────────

  async function handleSubmit(finalClips: Map<string, ClipEntry>) {
    setStep('uploading')
    setUploadProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('campaignId', campaign.id)
      formData.append('language', language)
      if (email.trim()) {
        formData.append('email', email.trim())
        formData.append('newsletter', newsletterChecked ? 'true' : 'false')
      }

      let clipIndex = 0
      const totalClips = finalClips.size
      for (const [promptId, clip] of finalClips.entries()) {
        if (clip.skipped) {
          formData.append(`clip_${promptId}_skipped`, 'true')
        } else {
          const ext = getFileExtension(clip.mimeType)
          formData.append(`clip_${promptId}`, clip.blob, `clip.${ext}`)
          formData.append(`clip_${promptId}_mime`, baseMimeType(clip.mimeType))
          formData.append(`clip_${promptId}_duration`, String(clip.duration))
        }
        clipIndex++
        setUploadProgress(Math.round((clipIndex / totalClips) * 80))
      }

      formData.append('promptIds', JSON.stringify(Array.from(finalClips.keys())))

      const res = await fetch('/api/record/submit', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }

      setUploadProgress(100)
      setStep('confirmation')
    } catch (err) {
      setError((err as Error).message || 'Upload failed. Please try again.')
      setStep('recording')
    }
  }

  // ── Reset ────────────────────────────────────────────────────

  function resetSession() {
    // Revoke all Blob URLs
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    clips.forEach((clip) => {
      if (!clip.skipped && 'blob' in clip) {
        // Blobs don't need revoking, but any object URLs do
      }
    })

    stopCamera()

    // Clear ALL state (language persists for shared-device use)
    setStep('intro')
    setConsentChecked(false)
    setEmail('')
    setNewsletterChecked(false)
    setCurrentPromptIndex(0)
    setClips(new Map())
    setVoiceOnly(false)
    setUploadProgress(0)
    setError(null)
    setRecordedBlob(null)
    setRecordedUrl(null)
    setRecordedDuration(0)
    setElapsed(0)
    setCameraReady(false)
    setPermissionDenied(false)
  }

  // ── Render ───────────────────────────────────────────────────

  const wrapperClass = 'flex min-h-screen flex-col bg-[#191A2E] text-white'
  const cardClass = 'mx-auto w-full max-w-lg rounded-2xl bg-[#242538] p-6 shadow-xl'
  const btnPrimary =
    'w-full rounded-xl bg-[#BAF14D] py-3 text-center font-display font-bold text-[#191A2E] transition hover:bg-[#a8e03c] disabled:opacity-40 disabled:cursor-not-allowed'
  const btnSecondary =
    'w-full rounded-xl border border-[#8A8DA8]/30 py-3 text-center font-medium text-[#8A8DA8] transition hover:bg-white/5'

  // ── Header ─────────────────────────────────────────────────

  const header = (
    <header className="flex items-center justify-between border-b border-white/10 bg-[#191A2E] px-6 py-4">
      {/* GSI wordmark: Trebuchet MS, "Green Streets" bold + "Initiative" regular */}
      <span className="text-lg tracking-wide text-white" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
        <span className="font-bold">Green Streets</span>{' '}
        <span className="font-normal">Initiative</span>
      </span>
      {/* Shift wordmark: Bricolage Grotesque + chevrons */}
      <span className="flex items-center gap-1">
        <span className="font-display text-sm font-extrabold tracking-tight text-white">
          Shift
        </span>
        <svg viewBox="0 0 40 26" className="h-4 w-6" aria-hidden="true">
          <path d="M0,0 L16,13 L0,26 L0,19 L10,13 L0,7Z" fill="#BAF14D" />
          <path d="M20,0 L36,13 L20,26 L20,19 L30,13 L20,7Z" fill="#2966E5" />
        </svg>
      </span>
    </header>
  )

  // ── Screen 1: Intro ────────────────────────────────────────

  if (step === 'intro') {
    return (
      <div className={wrapperClass}>
        {header}
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className={cardClass}>
            {/* Language selector */}
            {campaign.supported_languages.length > 1 && (
              <div className="mb-6">
                <label className="mb-2 block text-xs font-medium text-[#8A8DA8]">
                  Language
                </label>
                <div className="flex flex-wrap gap-2">
                  {campaign.supported_languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                        language === lang
                          ? 'bg-[#BAF14D] text-[#191A2E]'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {LANGUAGE_LABELS[lang] ?? lang}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <h1 className="font-display text-2xl font-bold text-white mb-3">
              {campaign.name}
            </h1>

            {consent.what_this_is && (
              <p className="mb-6 text-sm leading-relaxed text-[#8A8DA8]">
                {consent.what_this_is}
              </p>
            )}

            <button onClick={() => setStep('consent')} className={btnPrimary}>
              Get started
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Screen 2: Consent ──────────────────────────────────────

  if (step === 'consent') {
    return (
      <div className={wrapperClass}>
        {header}
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className={cardClass}>
            <h2 className="font-display text-xl font-bold text-white mb-1">
              Before you record
            </h2>
            <p className="mb-4 text-sm text-[#8A8DA8]">
              Please review how your responses will be used.
            </p>

            {consent.what_this_is && (
              <div className="mb-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8A8DA8]">
                  What this is
                </h3>
                <p className="text-sm leading-relaxed text-white/80">
                  {consent.what_this_is}
                </p>
              </div>
            )}

            <ul className="mb-6 space-y-3">
              {consent.public_use_bullet && (
                <li className="flex gap-2 text-sm text-white/80">
                  <span className="mt-0.5 text-[#BAF14D]">&#9679;</span>
                  <span>{consent.public_use_bullet}</span>
                </li>
              )}
              {consent.trip_data_bullet && (
                <li className="flex gap-2 text-sm text-white/80">
                  <span className="mt-0.5">&#128274;</span>
                  <span>{consent.trip_data_bullet}</span>
                </li>
              )}
              {consent.deletion_rights_bullet && (
                <li className="flex gap-2 text-sm text-white/80">
                  <span className="mt-0.5">&#128274;</span>
                  <span>{consent.deletion_rights_bullet}</span>
                </li>
              )}
            </ul>

            {/* Checkbox */}
            <label className="mb-6 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-[#8A8DA8] accent-[#BAF14D]"
              />
              <span className="text-sm text-white/90">
                {consent.checkbox_text ??
                  "I understand how my story will be used and I'm ready to participate."}
              </span>
            </label>

            <button
              disabled={!consentChecked}
              onClick={() => {
                if (campaign.field_recorder_collect_email) {
                  setStep('info')
                } else {
                  setStep('recording')
                }
              }}
              className={btnPrimary}
            >
              Let&apos;s go
            </button>

            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block text-center text-xs text-[#8A8DA8] underline"
            >
              Read our full privacy policy
            </a>
          </div>
        </main>
      </div>
    )
  }

  // ── Screen 3: Participant Info ─────────────────────────────

  if (step === 'info') {
    return (
      <div className={wrapperClass}>
        {header}
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className={cardClass}>
            <h2 className="font-display text-xl font-bold text-white mb-1">
              A little about you
            </h2>
            <p className="mb-6 text-sm text-[#8A8DA8]">
              This is optional — you can skip ahead if you prefer.
            </p>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-[#8A8DA8]">
                Your email address (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-[#8A8DA8]/50 focus:border-[#BAF14D] focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-[#8A8DA8]">
                We&apos;ll use this to follow up and invite you to download the
                free Shift app.
              </p>
            </div>

            <label
              className={`mb-6 flex cursor-pointer items-center gap-3 ${
                !email.trim() ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={newsletterChecked}
                onChange={(e) => setNewsletterChecked(e.target.checked)}
                disabled={!email.trim()}
                className="h-4 w-4 rounded border-[#8A8DA8] accent-[#BAF14D]"
              />
              <span className="text-sm text-white/80">
                Add me to the Green Streets newsletter
              </span>
            </label>

            <button onClick={() => setStep('recording')} className={btnPrimary}>
              Continue
            </button>

            <button
              onClick={() => {
                setEmail('')
                setNewsletterChecked(false)
                setStep('recording')
              }}
              className="mt-3 w-full text-center text-xs text-[#8A8DA8] underline"
            >
              Continue without email
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Screen 4-N: Recording ─────────────────────────────────

  if (step === 'recording') {
    const totalPrompts = prompts.length
    const promptNumber = currentPromptIndex + 1

    return (
      <div className={wrapperClass}>
        {header}
        <main className="flex flex-1 items-center justify-center px-4 py-6">
          <div className="mx-auto w-full max-w-lg">
            {/* Top bar: back button + progress + voice toggle */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {!isRecording && (
                  <button
                    onClick={() => {
                      stopCamera()
                      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
                      setRecordedBlob(null)
                      setRecordedUrl(null)
                      setStep('intro')
                    }}
                    className="text-xs text-[#8A8DA8] hover:text-white"
                    title="Exit"
                  >
                    &larr; Exit
                  </button>
                )}
                <span className="text-xs font-medium text-[#8A8DA8]">
                  Prompt {promptNumber} of {totalPrompts}
                </span>
              </div>
              {/* Voice-only toggle */}
              <button
                onClick={() => {
                  if (!isRecording && !recordedBlob) {
                    stopCamera()
                    setVoiceOnly(!voiceOnly)
                  }
                }}
                disabled={isRecording || !!recordedBlob}
                className="text-xs text-[#8A8DA8] underline disabled:opacity-40"
              >
                {voiceOnly ? 'Switch to video' : 'Prefer voice only?'}
              </button>
            </div>

            {/* Prompt text */}
            <div className="mb-4 rounded-xl bg-[#242538] p-5">
              <p className="font-display text-lg font-bold text-white leading-snug">
                {currentPrompt?.prompt_text}
              </p>
              <div className="mt-2 flex items-center gap-3">
                {currentPrompt?.hint_text && (
                  <p className="text-sm text-[#8A8DA8]">
                    {currentPrompt.hint_text}
                  </p>
                )}
                <span className="flex-shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-[#8A8DA8]">
                  {maxDuration}s max
                </span>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Camera / Playback area */}
            <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-xl bg-black">
              {permissionDenied ? (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <div>
                    <p className="mb-2 text-sm text-white">
                      Camera access is required
                    </p>
                    <p className="text-xs text-[#8A8DA8]">
                      Please allow camera and microphone access in your browser
                      settings, then tap below.
                    </p>
                    <button
                      onClick={startCamera}
                      className="mt-4 rounded-lg bg-[#BAF14D] px-4 py-2 text-sm font-semibold text-[#191A2E]"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : recordedUrl ? (
                // Playback
                <video
                  ref={playbackRef}
                  src={recordedUrl}
                  controls
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : voiceOnly ? (
                // Voice-only indicator
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mb-2 text-5xl">&#127908;</div>
                    <p className="text-sm text-[#8A8DA8]">
                      {isRecording ? 'Recording audio...' : 'Voice only mode'}
                    </p>
                  </div>
                </div>
              ) : (
                // Live camera preview
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              )}

              {/* Recording timer overlay */}
              {isRecording && (
                <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  <span className="text-xs font-mono text-white">
                    {formatTime(elapsed)}
                  </span>
                </div>
              )}

              {/* Warning at 45s */}
              {isRecording && elapsed >= 45 && elapsed < maxDuration && (
                <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-amber-500/90 px-3 py-2 text-center text-xs font-medium text-white">
                  Almost at the limit
                </div>
              )}
            </div>

            {/* Controls */}
            {!recordedBlob ? (
              <div className="space-y-3">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={!cameraReady}
                    className={btnPrimary}
                  >
                    Tap to record
                  </button>
                ) : (
                  <button onClick={stopRecording} className={btnPrimary}>
                    Stop recording
                  </button>
                )}

                {currentPrompt?.is_optional && !isRecording && (
                  <button onClick={skipPrompt} className={btnSecondary}>
                    Skip this prompt
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-center text-sm text-[#8A8DA8]">
                  Happy with this? Or record again.
                </p>
                <button onClick={acceptClip} className={btnPrimary}>
                  Use this one &rarr;
                </button>
                <button onClick={discardRecording} className={btnSecondary}>
                  Record again
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ── Uploading ──────────────────────────────────────────────

  if (step === 'uploading') {
    return (
      <div className={wrapperClass}>
        {header}
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className={cardClass + ' text-center'}>
            <h2 className="font-display text-xl font-bold text-white mb-4">
              Submitting your responses...
            </h2>
            <div className="mx-auto mb-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#BAF14D] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-[#8A8DA8]">
              Please don&apos;t close this page.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ── Screen Final: Confirmation ─────────────────────────────

  const answeredCount = Array.from(clips.values()).filter((c) => !c.skipped).length
  const totalDuration = Array.from(clips.values()).reduce(
    (sum, c) => sum + (c.skipped ? 0 : c.duration),
    0,
  )

  return (
    <div className={wrapperClass}>
      {header}
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className={cardClass}>
          <h2 className="font-display text-2xl font-bold text-white mb-2">
            {confirmation.title ?? 'Thank you for sharing your story'}
          </h2>

          {confirmation.body && (
            <p className="mb-4 text-sm text-[#8A8DA8]">{confirmation.body}</p>
          )}

          {/* Summary card */}
          <div className="mb-4 rounded-lg bg-white/5 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#8A8DA8]">Prompts answered</span>
              <span className="text-white font-medium">
                {answeredCount} / {prompts.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8A8DA8]">Total recording time</span>
              <span className="text-white font-medium">
                {formatTime(totalDuration)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8A8DA8]">Campaign</span>
              <span className="text-white font-medium">{campaign.name}</span>
            </div>
          </div>

          {/* Teaser */}
          {confirmation.teaser && (
            <p className="mb-4 text-sm italic text-[#8A8DA8]">
              {confirmation.teaser}
            </p>
          )}

          {/* Download Shift */}
          <div className="mb-4 rounded-lg border border-[#BAF14D]/20 bg-[#BAF14D]/5 p-4 text-center">
            <p className="mb-2 text-sm font-medium text-white">
              Keep tracking your trips
            </p>
            <p className="text-xs text-[#8A8DA8]">
              Download Shift, the free app that rewards you for walking, biking,
              and taking transit.
            </p>
            <a
              href="/app"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-[#BAF14D] px-6 py-2 text-sm font-bold text-[#191A2E]"
            >
              Get Shift
            </a>
          </div>

          {/* Record another */}
          <button onClick={resetSession} className={btnSecondary}>
            Record another response
          </button>

          <a
            href="/privacy#deletion"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block text-center text-xs text-[#8A8DA8] underline"
          >
            Request deletion of my responses
          </a>
        </div>
      </main>
    </div>
  )
}
