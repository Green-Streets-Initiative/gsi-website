'use client'

import type { RecommendationPrimary, RecommendationSecondary, Mode } from '@/lib/types/commute'
import ModeIcon from '@/components/commute/ModeIcon'

interface RecommendationCardProps {
  primary: RecommendationPrimary
  secondary: RecommendationSecondary | null
  distanceMiles: number
  distanceCategory: string
  onRefresh?: () => void
  loading?: boolean
  routeTimeMinutes?: number | null
  routeTimes?: Record<string, number> // Google Maps times keyed by mode
}

export default function RecommendationCard({
  primary,
  secondary,
  onRefresh,
  loading,
  routeTimeMinutes,
  routeTimes,
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
          {primary.modes.length === 0 && <ModeIcon mode="drive" />}
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
          <div className="flex items-center gap-2 text-[0.8125rem] text-white/70">
            <span>Also consider:</span>
            <div className="flex items-center gap-1">
              {secondary.modes.map((mode) => (
                <ModeIcon key={mode} mode={mode} className="opacity-50" />
              ))}
            </div>
            <span className="text-white/70">{secondary.label}</span>
            <span>— {(() => {
              // Use Google Routes time for secondary mode if available
              const secMode = secondary.modes[0] || 'drive'
              const modeKey = secMode === 'ebike' ? 'bike' : secMode
              const driveTime = routeTimes?.drive
              // For drive, add parking time if using route data
              if (secondary.modes.length === 0 && driveTime) return `${driveTime + 5} minutes`
              return `${routeTimes?.[modeKey] ?? secondary.time_estimate_minutes} minutes`
            })()} </span>
          </div>
        </div>
      )}
    </div>
  )
}
