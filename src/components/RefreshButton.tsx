'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react'

export default function RefreshButton() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1500)
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-navy/25 px-5 text-sm font-semibold text-navy transition-colors hover:bg-navy/[0.05] disabled:opacity-60"
    >
      <ArrowsClockwise size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden />
      {refreshing ? 'Refreshing…' : 'Refresh standings'}
    </button>
  )
}
