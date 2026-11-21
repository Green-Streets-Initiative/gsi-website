import type { Metadata } from 'next'
import { undoInfo } from '@/lib/organizers/group-claim'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import NotUs from './NotUs'

export const metadata: Metadata = {
  title: 'Someone from your group joined Shift | Green Streets',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * Where "This isn't one of us" in the claim notice lands (lib/organizers/
 * group-claim.ts). Opening it changes nothing, so a mail scanner that follows
 * links can't undo a claim; the button does.
 */
export default async function GroupClaimPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params
  const { t = '' } = await searchParams
  const info = await undoInfo(createServerSupabaseClient(), id, t)
  return <NotUs id={id} token={t} info={info} />
}
