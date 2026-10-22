'use client'

// The Share kit now lives on Employees, as "Invite & share" (Keith
// 2026-10-22, page charters). Old links (digest emails, bookmarks, the
// assistant) land here and forward, keeping a ?tab= or #section.

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ShareKitRedirect() {
  const router = useRouter()
  const params = useSearchParams()
  useEffect(() => {
    const tab = params.get('tab') ?? params.get('section')
    const hash = window.location.hash || (tab ? `#${tab}` : '')
    router.replace(`/shift/employers/portal/employees?view=share${hash}`)
  }, [router, params])
  return null
}
