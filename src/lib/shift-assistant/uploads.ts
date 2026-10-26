import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Pictures people attach in the Shift assistant (Keith 2026-10-25: a
 * screenshot of a bug, a Ride with GPS screen). They sit in a private
 * bucket (Shift 01441): the app uploads into <user>/inbox/, the server moves
 * a sent one into <user>/<thread>/, and the conversation stores only a
 * marker with its path. The model gets the picture itself (base64, so the
 * prompt cache holds across turns); the app gets a link that works for an
 * hour; staff get a 7-day link with a problem report. Files go when their
 * conversation goes (DELETE, and api/cron/assistant-uploads for 12-month
 * retention and deleted accounts).
 */
export const UPLOADS = 'member-assistant-uploads'

const MARK = '[Attached image: '
export const imageMark = (path: string) => `${MARK}${path}]`
export function markedPath(text: unknown): string | null {
  return typeof text === 'string' && text.startsWith(MARK) && text.endsWith(']') ? text.slice(MARK.length, -1) : null
}

const FILE = /^[0-9a-f-]{36}\.(jpe?g|png|webp|gif)$/i

/** An upload this person may send: one of their own, just uploaded. */
export function inboxPath(userId: string, v: unknown): string | null {
  if (typeof v !== 'string') return null
  const [owner, folder, file, ...rest] = v.split('/')
  return owner === userId && folder === 'inbox' && file && FILE.test(file) && rest.length === 0 ? v : null
}

/** Moves an upload into its conversation's folder; null when it isn't there. */
export async function claimUpload(admin: SupabaseClient, userId: string, threadId: string, path: string): Promise<string | null> {
  const to = `${userId}/${threadId}/${path.split('/').pop()}`
  const { error } = await admin.storage.from(UPLOADS).move(path, to)
  return error ? null : to
}

/** The picture's own type, from its first bytes (the upload's label can be wrong). */
function mediaType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp'
  return null
}

type Loaded = { media_type: string; data: string } | null

/**
 * The conversation as the model reads it: each marker gets its picture just
 * before it. `cache` keeps a turn's steps from fetching the same file again.
 */
export async function withImages<T extends { role: string; content: unknown }>(
  admin: SupabaseClient, history: T[], cache: Map<string, Loaded>,
): Promise<T[]> {
  const load = async (path: string): Promise<Loaded> => {
    if (cache.has(path)) return cache.get(path)!
    const { data } = await admin.storage.from(UPLOADS).download(path)
    const bytes = data ? new Uint8Array(await data.arrayBuffer()) : null
    const type = bytes ? mediaType(bytes) : null
    const v = bytes && type ? { media_type: type, data: Buffer.from(bytes).toString('base64') } : null
    cache.set(path, v)
    return v
  }
  return Promise.all(history.map(async (m) => {
    if (m.role !== 'user' || !Array.isArray(m.content)) return m
    const blocks = m.content as Record<string, unknown>[]
    if (!blocks.some((b) => b.type === 'text' && markedPath(b.text))) return m
    const out: unknown[] = []
    for (const b of blocks) {
      const path = b.type === 'text' ? markedPath(b.text) : null
      if (path) {
        const img = await load(path)
        out.push(img
          ? { type: 'image', source: { type: 'base64', ...img } }
          : { type: 'text', text: '[They attached a picture here; it is no longer available.]' })
        if (img) out.push(b)
        continue
      }
      out.push(b)
    }
    return { ...m, content: out }
  }))
}

/** The newest picture in a conversation, for a problem report. */
export function lastImage(history: { role: string; content: unknown }[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    if (m.role !== 'user' || !Array.isArray(m.content)) continue
    for (const b of [...(m.content as Record<string, unknown>[])].reverse()) {
      const p = b.type === 'text' ? markedPath(b.text) : null
      if (p) return p
    }
  }
  return null
}

export async function signedUrls(admin: SupabaseClient, paths: string[], seconds: number): Promise<Map<string, string>> {
  if (!paths.length) return new Map()
  const { data } = await admin.storage.from(UPLOADS).createSignedUrls(paths, seconds)
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]))
}

/** Every file directly under one folder (a conversation, or an inbox). */
async function filesIn(admin: SupabaseClient, folder: string): Promise<{ name: string; created_at: string | null }[]> {
  const out: { name: string; created_at: string | null }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data } = await admin.storage.from(UPLOADS).list(folder, { limit: 1000, offset })
    const rows = (data ?? []).filter((d) => d.id)
    out.push(...rows.map((d) => ({ name: `${folder}/${d.name}`, created_at: d.created_at ?? null })))
    if ((data ?? []).length < 1000) return out
  }
}

/** The sub-folders of a folder (a person's conversations, or everyone). */
export async function foldersIn(admin: SupabaseClient, folder: string): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data } = await admin.storage.from(UPLOADS).list(folder, { limit: 1000, offset })
    out.push(...(data ?? []).filter((d) => !d.id).map((d) => d.name))
    if ((data ?? []).length < 1000) return out
  }
}

/** Removes the files in these folders; older-than only removes files uploaded before it. */
export async function removeFolders(admin: SupabaseClient, folders: string[], olderThan?: Date): Promise<number> {
  let n = 0
  for (const f of folders) {
    const files = (await filesIn(admin, f)).filter((x) => !olderThan || (x.created_at && new Date(x.created_at) < olderThan))
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await admin.storage.from(UPLOADS).remove(files.slice(i, i + 100).map((x) => x.name))
      if (!error) n += Math.min(100, files.length - i)
    }
  }
  return n
}
