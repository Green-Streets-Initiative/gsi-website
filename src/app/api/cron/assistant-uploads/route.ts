import { createServerSupabaseClient } from '@/lib/supabase-server'
import { foldersIn, removeFolders } from '@/lib/shift-assistant/uploads'

/**
 * Daily: pictures from the Shift assistant go when their conversation goes.
 * A conversation's files sit in <user>/<thread>/; the thread row is removed
 * by the person (the app's delete also removes the files), by the 12-month
 * retention job, or with their account, so any folder whose thread no longer
 * exists is cleared here. Uploads never sent (<user>/inbox/) go after a day.
 *
 * Auth: Bearer token from CRON_SECRET (Vercel Cron's standard pattern).
 */
export const runtime = 'nodejs'
export const maxDuration = 120

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return new Response('CRON_SECRET not set', { status: 500 })
  if (auth !== `Bearer ${expected}`) return new Response('unauthorized', { status: 401 })

  const admin = createServerSupabaseClient()
  const dayAgo = new Date(Date.now() - 86_400_000)
  let removed = 0
  for (const person of await foldersIn(admin, '')) {
    const folders = await foldersIn(admin, person)
    removed += await removeFolders(admin, folders.filter((f) => f === 'inbox').map((f) => `${person}/${f}`), dayAgo)
    const threads = folders.filter((f) => UUID.test(f))
    if (!threads.length) continue
    const { data, error } = await admin.from('member_assistant_threads').select('id').in('id', threads)
    if (error) continue
    const live = new Set(((data ?? []) as { id: string }[]).map((t) => t.id))
    removed += await removeFolders(admin, threads.filter((t) => !live.has(t)).map((t) => `${person}/${t}`))
  }
  return Response.json({ ok: true, removed })
}
