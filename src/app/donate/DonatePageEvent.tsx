'use client'

import { useEffect } from 'react'
import { gaEvent } from '@/lib/ga'

// The donate button itself lives inside Donorbox's cross-origin iframe, so
// landing on this page is the closest conversion signal the site can send.
export default function DonatePageEvent() {
  useEffect(() => {
    gaEvent('donate_page_view')
  }, [])
  return null
}
