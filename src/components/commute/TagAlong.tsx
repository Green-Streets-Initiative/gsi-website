'use client'

import { useState } from 'react'
import { UsersThree } from '@phosphor-icons/react'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

// Keith 2026-10-06: hidden until the program is defined. The API route
// (/api/commute/tag-along) and the held Shift migration 01134 stay as they
// are; flip this to true when the Tag Along program exists.
export const TAG_ALONG_ENABLED = false

/**
 * "Want a commute partner for this trip?" One tap records the ask (the
 * employer, the office, the way in and the distance band; never a person
 * or an address) through POST /api/commute/tag-along, so the employer
 * program can pair people up through the company. The button answers
 * plainly and promises nothing beyond that reach-out.
 */

export interface TagAlongProps {
  groupId: string | null
  locationId: string | null
  mode: string
  distanceCategory: string
  variant: 'public' | 'employer'
  companyName: string | null
  /** Draft previews and demos write nothing. */
  disabled?: boolean
  onTrack: (event: string, props?: Record<string, unknown>) => void
  locale?: SiteLocale
}

type State = 'idle' | 'sending' | 'done' | 'failed'

export default function TagAlong({ groupId, locationId, mode, distanceCategory, variant, companyName, disabled = false, onTrack, locale = 'en' }: TagAlongProps) {
  const t = translator(advisorStrings, locale)
  const [state, setState] = useState<State>('idle')
  if (!TAG_ALONG_ENABLED) return null

  const send = async () => {
    onTrack('advisor_tag_along_clicked', { mode, distance_category: distanceCategory, has_group: !!groupId })
    if (disabled) { setState('done'); return }
    setState('sending')
    try {
      const res = await fetch('/api/commute/tag-along', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, location_id: locationId, mode, distance_category: distanceCategory, variant }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean }
      setState(res.ok && data.ok ? 'done' : 'failed')
    } catch {
      setState('failed')
    }
  }

  const through = companyName ?? 'Green Streets'

  return (
    <div className="mt-2.5 border-t border-dashed border-[rgba(25,26,46,0.12)] pt-2.5">
      {state === 'done' ? (
        <p className="text-[0.9375rem] leading-snug text-[#191A2E]">
          {t('tag.done', { through })}
        </p>
      ) : (
        <>
          <p className="text-[0.9375rem] leading-snug text-[#191A2E]">{t('tag.question')}</p>
          <button
            type="button"
            onClick={send}
            disabled={state === 'sending'}
            className="mt-1.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#2D6A4F] bg-white px-3 text-[0.875rem] font-bold text-[#2D6A4F] transition-colors hover:bg-[#E7F0EA] disabled:opacity-60"
          >
            <UsersThree size={15} weight="regular" aria-hidden />
            {state === 'sending' ? t('tag.noting') : t('tag.ask')}
          </button>
          {state === 'failed' && (
            <p className="mt-1.5 text-[0.875rem] leading-snug text-[#8A5A00]">{t('tag.failed')}</p>
          )}
        </>
      )}
    </div>
  )
}
