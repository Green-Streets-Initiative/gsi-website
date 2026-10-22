import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import ConsoleShell from '@/components/organizers/ConsoleShell'

export const metadata: Metadata = {
  title: 'Organizer tools | Shift by Green Streets',
  description: 'Plan and run your group rides: dates, routes, who is coming, updates and turnout.',
  robots: { index: false, follow: false },
}

export default function OrganizersLayout({ children }: { children: ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>
}
