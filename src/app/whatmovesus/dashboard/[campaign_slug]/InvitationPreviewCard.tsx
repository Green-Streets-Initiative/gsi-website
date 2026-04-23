'use client'

/**
 * InvitationPreviewCard — web mockup of the Shift app's WmuInvitationCard.
 *
 * Shows funders what recruits actually saw on the mobile home screen when
 * this campaign's invitation was surfaced. Visual source of truth is
 * components/WmuInvitationCard.tsx in the Shift repo. This is a non-
 * interactive preview — buttons are visual-only.
 *
 * String fallbacks mirror the en.json values the mobile app renders
 * (wmu.card_title, meta_duration, meta_prompts, meta_format, rewards_strip,
 * not_now). Keep them in sync if the mobile copy changes.
 *
 * Icons are inline SVG (Phosphor Bold shapes reproduced) to avoid adding
 * an icon dependency to gsi-website — keeping the repo's lean package.json.
 */

interface InviteCopy {
  headline: string | null
  body: string | null
  cta_label: string | null
}

interface InvitationPreviewCardProps {
  inviteCopy: InviteCopy | null
  promptCount: number
  mediaType: string
  hasIncentive: boolean
  incentivePoints: number | null
}

const CARD_TITLE = 'Share Your Story'
const META_DURATION = '~2 minutes'
const META_FORMAT_BY_TYPE: Record<string, string> = {
  video: 'Video on your phone',
  audio: 'Audio on your phone',
  text: 'Text on your phone',
}
const CTA_FALLBACK = CARD_TITLE
const NOT_NOW_LABEL = 'Not right now'

function VideoCameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      width="20"
      height="20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M240 72a16 16 0 0 0-16-16h-20.69a16 16 0 0 0-11.31 4.69L176 76.69V72a16 16 0 0 0-16-16H32a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-4.69l16 16A16 16 0 0 0 203.31 200H224a16 16 0 0 0 16-16Zm-80 112H32V72h128Zm64 0h-20.69l-27.31-27.31a8 8 0 0 0-11.31 0L176 168v-80l8.69-8.69A8 8 0 0 0 203.31 72H224Z" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      width="16"
      height="16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M239.2 97.29a16 16 0 0 0-13.81-11L166 81.17l-23.28-55.36a15.95 15.95 0 0 0-29.4 0L90.07 81.17l-59.46 5.15a16 16 0 0 0-9.11 28.06l45.1 39.75-13.49 58.36a16 16 0 0 0 23.84 17.34l51-31 51.11 31a16 16 0 0 0 23.84-17.34l-13.5-58.36 45.1-39.75a16 16 0 0 0 5.7-17.09Z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      width="16"
      height="16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z" />
    </svg>
  )
}

export default function InvitationPreviewCard({
  inviteCopy,
  promptCount,
  mediaType,
  hasIncentive,
  incentivePoints,
}: InvitationPreviewCardProps) {
  const headline = inviteCopy?.headline ?? 'What Moves Us'
  const body =
    inviteCopy?.body ??
    'A short video story about how you move around your community.'
  const ctaLabel = inviteCopy?.cta_label ?? CTA_FALLBACK
  const formatLabel =
    META_FORMAT_BY_TYPE[mediaType] ?? META_FORMAT_BY_TYPE.video

  return (
    <div className="max-w-sm rounded-2xl border-l-[3px] border-lime bg-[#1e2a2e] p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <VideoCameraIcon className="text-lime" />
        <span className="flex-1 text-base font-bold text-lime">
          {CARD_TITLE}
        </span>
        <div className="p-1 text-white/40">
          <XIcon />
        </div>
      </div>

      {/* Headline & body */}
      <h3 className="mt-2.5 text-lg font-bold text-white">{headline}</h3>
      <p className="mt-1.5 text-sm leading-5 text-white/95">{body}</p>

      {/* Meta pills */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-xl bg-white/[0.08] px-2.5 py-1 text-xs text-white">
          {META_DURATION}
        </span>
        <span className="rounded-xl bg-white/[0.08] px-2.5 py-1 text-xs text-white">
          {promptCount} {promptCount === 1 ? 'prompt' : 'prompts'}
        </span>
        <span className="rounded-xl bg-white/[0.08] px-2.5 py-1 text-xs text-white">
          {formatLabel}
        </span>
      </div>

      {/* Rewards strip — mirrors mobile: only renders when both conditions hold */}
      {hasIncentive && incentivePoints != null && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-3 py-2">
          <StarIcon className="text-[#92400E]" />
          <span className="text-sm font-semibold text-[#FBBF24]">
            Complete this and earn {incentivePoints} XP
          </span>
        </div>
      )}

      {/* Actions — visual only, disabled appearance */}
      <div className="mt-3.5 flex items-center gap-3">
        <div className="rounded-lg bg-lime px-5 py-2.5">
          <span className="text-sm font-semibold text-navy">{ctaLabel}</span>
        </div>
        <div className="px-3 py-2">
          <span className="text-sm text-white">{NOT_NOW_LABEL}</span>
        </div>
      </div>
    </div>
  )
}
