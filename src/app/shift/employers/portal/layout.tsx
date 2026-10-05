'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { PortalProvider, usePortal } from './_lib/portal-context'
import { ToastProvider, useToast } from '@/components/employer/Toast'
import { ConfirmProvider } from '@/components/employer/ConfirmDialog'
import Sidebar from './_components/Sidebar'
import Topbar from './_components/Topbar'
import AgreementGate from './_components/AgreementGate'
import SetupProgressBanner from './_components/SetupProgressBanner'
import AccessLapsedNotice from './_components/AccessLapsedNotice'
import PortalTracking from './_components/PortalTracking'
import ScrollReset from './_components/ScrollReset'
import PortalLoadError from './_components/PortalLoadError'
import NoWorkplace from './_components/NoWorkplace'
import { PortalContentSkeleton, PortalShellSkeleton } from './_components/PortalSkeleton'
import './portal.css'

const FONT_STYLE = {
  fontFamily: "'Source Sans 3', var(--font-source-sans), var(--font-sans), system-ui, sans-serif",
}

/** Shows the one-time sign-in notice (a re-used magic link) as a toast. */
function AuthNoticeToast() {
  const { authNotice, clearAuthNotice } = usePortal()
  const toast = useToast()
  useEffect(() => {
    if (!authNotice) return
    toast(authNotice)
    clearAuthNotice()
  }, [authNotice, toast, clearAuthNotice])
  return null
}

function PortalFrame({ children }: { children: React.ReactNode }) {
  const { loading, loadError, noWorkplace, retry } = usePortal()
  const [navOpen, setNavOpen] = useState(false)
  const closeNav = useCallback(() => setNavOpen(false), [])
  const openNav = useCallback(() => setNavOpen(true), [])

  if (loadError) {
    return (
      <div style={FONT_STYLE}>
        <PortalLoadError message={loadError} onRetry={retry} />
      </div>
    )
  }

  if (noWorkplace) {
    return (
      <div style={FONT_STYLE}>
        <NoWorkplace />
      </div>
    )
  }

  return (
    <div
      className="grid min-h-dvh min-[980px]:grid-cols-[256px_1fr] bg-canvas"
      style={FONT_STYLE}
    >
      <Sidebar open={navOpen} onClose={closeNav} />
      {/* The right column is exactly one viewport tall so <main> is the
          scroll container: that is what lets the Topbar, the section nav
          and the advisor preview stick (Keith 2026-09-30). <main> is also
          `relative` so it is the containing block for every absolutely
          positioned descendant (sr-only labels, badges): without that,
          those boxes belong to the viewport, escape <main>'s overflow clip
          and stretch the window itself, which showed as blank canvas
          under the portal on long pages (Keith 2026-09-30). */}
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <Topbar onMenu={openNav} />
        <SetupProgressBanner />
        <main data-portal-main className="relative min-h-0 flex-1 overflow-y-auto">
          <ScrollReset />
          <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">
            {loading ? (
              <PortalContentSkeleton />
            ) : (
              <>
                <AccessLapsedNotice />
                <AgreementGate>{children}</AgreementGate>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalProvider>
      <ToastProvider>
        <ConfirmProvider>
          <PortalTracking />
          <AuthNoticeToast />
          <PortalFrame>{children}</PortalFrame>
        </ConfirmProvider>
      </ToastProvider>
    </PortalProvider>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PortalShellSkeleton />}>
      <PortalShell>{children}</PortalShell>
    </Suspense>
  )
}
