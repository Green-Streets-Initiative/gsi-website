'use client'

import type { RecommendationPrimary, RecommendationSecondary, Mode } from '@/lib/types/commute'

function ModeIcon({ mode, className = '' }: { mode: Mode; className?: string }) {
  const base = `inline-block ${className}`
  switch (mode) {
    case 'walk':
      return (
        <svg className={base} width="28" height="28" viewBox="0 0 256 256" fill="currentColor">
          <path d="M152,80a32,32,0,1,0-32-32A32,32,0,0,0,152,80Zm-8,24a8,8,0,0,0-8,8v40H104v-8a8,8,0,0,0-16,0v8H72a8,8,0,0,0,0,16H88v48a8,8,0,0,0,16,0V168h32v48a8,8,0,0,0,16,0V168h16a8,8,0,0,0,0-16H152V112A8,8,0,0,0,144,104Z" />
        </svg>
      )
    case 'bike':
    case 'ebike':
      return (
        <svg className={base} width="28" height="28" viewBox="0 0 256 256" fill="currentColor">
          <path d="M208,112a47.81,47.81,0,0,0-16.93,3.09L165.93,72H192a8,8,0,0,1,8,8,8,8,0,0,0,16,0,24,24,0,0,0-24-24H152a8,8,0,0,0-6.91,12l11.65,20H99.26L82.91,60A8,8,0,0,0,76,56H48a8,8,0,0,0,0,16H71.41l13.71,23.51L62.87,127.9A48,48,0,1,0,79,138.63l17.41-23.11,38.68,66.31A8,8,0,0,0,142,184a7.9,7.9,0,0,0,4-1.08,8,8,0,0,0,2.88-10.94l-38.15-65.42h57.55l11.06,19A48.09,48.09,0,1,0,208,112ZM80,160a32,32,0,1,1-7.34-20.42L55.08,161.84A8,8,0,0,0,61,175.16l17.58-22.26A31.84,31.84,0,0,1,80,160Zm128,32a32,32,0,0,1-21.64-55.64l14.91,25.62a8,8,0,0,0,13.82-8l-14.91-25.62A32,32,0,1,1,208,192Z" />
        </svg>
      )
    case 'transit':
    case 'bus':
      return (
        <svg className={base} width="28" height="28" viewBox="0 0 256 256" fill="currentColor">
          <path d="M184,32H72A32,32,0,0,0,40,64V208a16,16,0,0,0,16,16H80a16,16,0,0,0,16-16V192h64v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V64A32,32,0,0,0,184,32ZM72,48H184a16,16,0,0,1,16,16v48H56V64A16,16,0,0,1,72,48ZM56,176V128H200v48Zm144,32H176V192h24Zm-120,0H56V192H80ZM92,160a12,12,0,1,1-12-12A12,12,0,0,1,92,160Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,188,160Z" />
        </svg>
      )
  }
}

interface RecommendationCardProps {
  primary: RecommendationPrimary
  secondary: RecommendationSecondary | null
  distanceMiles: number
  distanceCategory: string
  onRefresh?: () => void
  loading?: boolean
  routeTimeMinutes?: number | null
}

export default function RecommendationCard({
  primary,
  secondary,
  onRefresh,
  loading,
  routeTimeMinutes,
}: RecommendationCardProps) {
  // Override first reason bullet with Google Maps time if available
  const displayReasons = [...primary.reasons]
  if (routeTimeMinutes && displayReasons.length > 0) {
    const modeLabel = primary.modes.includes('walk') ? 'on foot'
      : primary.modes.includes('bike') || primary.modes.includes('ebike') ? 'by bike'
      : 'by transit'
    displayReasons[0] = `${primary.reasons[0]?.match(/^[\d.]+ miles/)?.[0] || ''} — about ${routeTimeMinutes} minutes ${modeLabel}`.replace(/^ — /, '')
  }
  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
          Your best option
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1 text-[11px] font-semibold text-white/70 transition-colors hover:border-white/[0.25] hover:text-white disabled:opacity-40"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-3-6.7" strokeLinecap="round" />
              <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        )}
      </div>

      {/* Mode icons + label */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center gap-1 text-[#BAF14D]">
          {primary.modes.map((mode) => (
            <ModeIcon key={mode} mode={mode} />
          ))}
        </div>
        <h3 className="font-display text-[1.375rem] font-bold leading-tight tracking-tight text-white">
          {primary.label}
        </h3>
      </div>

      {/* Reasons */}
      <ul className="mb-6 space-y-2.5">
        {displayReasons.map((reason, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-white">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#BAF14D]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{reason}</span>
          </li>
        ))}
      </ul>

      {/* Google Maps CTA */}
      {primary.google_maps_url ? (
        <a
          href={primary.google_maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-semibold text-[#191A2E] transition-opacity hover:opacity-85"
        >
          Get directions in Google Maps
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
          </svg>
        </a>
      ) : null}

      {/* Secondary */}
      {secondary && (
        <div className="mt-5 border-t border-white/[0.07] pt-4">
          <div className="flex items-center gap-2 text-[0.8125rem] text-white/50">
            <span>Also consider:</span>
            <div className="flex items-center gap-1">
              {secondary.modes.map((mode) => (
                <ModeIcon key={mode} mode={mode} className="opacity-50" />
              ))}
            </div>
            <span className="text-white/70">{secondary.label}</span>
            <span>— {secondary.time_estimate_minutes} minutes</span>
          </div>
        </div>
      )}
    </div>
  )
}
