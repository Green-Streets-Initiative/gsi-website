import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import TogetherShell from '@/components/together/TogetherShell'

export const metadata: Metadata = {
  title: 'Shift Together | Green Streets',
  description: 'Try a new way to get there with a neighbor who knows it, show someone the way, or share a drive. Free, no app needed.',
  // Not listed until Keith launches it (held 2026-10-27).
  robots: { index: false, follow: false },
}

export default function TogetherLayout({ children }: { children: ReactNode }) {
  return <TogetherShell>{children}</TogetherShell>
}
