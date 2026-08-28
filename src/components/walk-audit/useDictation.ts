'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number }
  resultIndex: number
}

export function useDictation(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<unknown>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const stop = useCallback(() => {
    const r = recognitionRef.current as { stop?: () => void } | null
    if (r?.stop) r.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    if (!supported) return
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new (SpeechRecognition as new () => {
      lang: string
      interimResults: boolean
      continuous: boolean
      onresult: ((e: SpeechRecognitionEvent) => void) | null
      onend: (() => void) | null
      onerror: (() => void) | null
      start: () => void
      stop: () => void
    })()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[e.results.length - 1]?.[0]?.transcript
      if (transcript) onTranscriptRef.current(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [supported])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => {
    return () => { stop() }
  }, [stop])

  return { listening, supported, toggle }
}
