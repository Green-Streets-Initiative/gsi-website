'use client'

import { useCallback, useState } from 'react'
import { ArrowLeftRight, ShieldCheck } from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import StaffWorkplacePicker from './StaffWorkplacePicker'

/**
 * Shown to Green Streets staff on every portal page: which workplace they
 * are looking at, that they see it as staff, and a Switch control (Keith
 * 2026-10-29). Navy so it never reads as part of the customer's own portal.
 */
export default function StaffBar() {
  const { isGsiAdmin, group, onTeam, loading } = usePortal()
  const [picking, setPicking] = useState(false)
  const close = useCallback(() => setPicking(false), [])

  if (!isGsiAdmin || loading || !group) return null

  return (
    <>
      <div className="flex items-center gap-3 bg-ink px-4 py-1 text-white sm:px-6 sm:py-2">
        <ShieldCheck size={18} strokeWidth={2} className="shrink-0 text-[#BAF14D]" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[14px] text-white/80">
          Viewing as staff: <strong className="font-semibold text-white">{group.name}</strong>
          {!onTeam && <span className="hidden sm:inline"> · not on their team</span>}
        </p>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[8px] border border-white/30 px-3 py-1.5 sm:min-h-0 text-[14px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ArrowLeftRight size={16} strokeWidth={2} aria-hidden />
          Switch
        </button>
      </div>
      {picking && <StaffWorkplacePicker onClose={close} />}
    </>
  )
}
