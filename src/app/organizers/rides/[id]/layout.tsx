'use client'

import { use, type ReactNode } from 'react'
import RideFrame from '@/components/organizers/RideFrame'

export default function RideLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <RideFrame key={id} id={id}>{children}</RideFrame>
}
