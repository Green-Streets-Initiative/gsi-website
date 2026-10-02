'use client'

import { Suspense } from 'react'
import { PortalProvider } from './_lib/portal-context'
import { ToastProvider } from '@/components/employer/Toast'
import Sidebar from './_components/Sidebar'
import Topbar from './_components/Topbar'
import AgreementGate from './_components/AgreementGate'
import SetupProgressBanner from './_components/SetupProgressBanner'
import AccessLapsedNotice from './_components/AccessLapsedNotice'
import PortalTracking from './_components/PortalTracking'
import './portal.css'

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalProvider>
      <ToastProvider>
        <PortalTracking />
        <div
          className="grid min-h-screen min-[980px]:grid-cols-[256px_1fr] bg-canvas"
          style={{ fontFamily: "'Source Sans 3', var(--font-source-sans), var(--font-sans), system-ui, sans-serif" }}
        >
          <Sidebar />
          <div className="flex min-h-screen flex-col overflow-hidden">
            <Topbar />
            <SetupProgressBanner />
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[1200px] px-6 py-6">
                <AccessLapsedNotice />
                <AgreementGate>{children}</AgreementGate>
              </div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </PortalProvider>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas">
          <div className="text-ink-muted">Loading...</div>
        </div>
      }
    >
      <PortalShell>{children}</PortalShell>
    </Suspense>
  )
}
