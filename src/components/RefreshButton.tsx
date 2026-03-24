'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
      className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/20 disabled:opacity-50"
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="currentColor"
        className={refreshing ? 'animate-spin' : ''}
      >
        <path d="M13.65 2.35A7.96 7.96 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L10 6h6V0l-2.35 2.35z" />
      </svg>
      {refreshing ? 'Refreshing...' : 'Refresh standings'}
    </button>
  )
}
