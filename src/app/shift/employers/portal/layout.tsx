'use client'

import { Suspense } from 'react'
import { Source_Sans_3, DM_Mono } from 'next/font/google'
import { PortalProvider } from './_lib/portal-context'
import { ToastProvider } from '@/components/employer/Toast'
import Sidebar from './_components/Sidebar'
import Topbar from './_components/Topbar'
import './portal.css'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalProvider>
      <ToastProvider>
        <div
          className={`${sourceSans.variable} ${dmMono.variable} grid min-h-screen min-[980px]:grid-cols-[256px_1fr] bg-canvas`}
          style={{ fontFamily: "'Source Sans 3', var(--font-source-sans), var(--font-sans), system-ui, sans-serif" }}
        >
          <Sidebar />
          <div className="flex min-h-screen flex-col overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[1200px] px-6 py-6">
                {children}
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
