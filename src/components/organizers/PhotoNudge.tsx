'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * "Add your photo" (Keith 2026-11-12): an organizer with no profile photo
 * shows as initials beside "Hosted by" on every ride page. One tap here
 * picks a photo; it's shrunk in the browser and saved where the app saves
 * it (user-avatars/<id>/avatar.jpg, users.avatar_url), so it shows on the
 * ride pages and in the app at once. Gone once they have one.
 */
export default function PhotoNudge() {
  const [state, setState] = useState<'hidden' | 'ask' | 'saving' | 'done' | 'error'>('hidden')
  const [preview, setPreview] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let live = true
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id
      if (!id) return
      const { data: row } = await supabase.from('users').select('avatar_url').eq('id', id).maybeSingle()
      if (live && row && !(row as { avatar_url: string | null }).avatar_url) setState('ask')
    }).catch(() => {})
    return () => { live = false }
  }, [])

  async function pick(file: File) {
    setState('saving')
    try {
      const { data } = await supabase.auth.getUser()
      const id = data.user?.id
      if (!id) throw new Error('signed out')
      const blob = await square(file, 512)
      const path = `${id}/avatar.jpg`
      const up = await supabase.storage.from('user-avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (up.error) throw up.error
      const url = `${supabase.storage.from('user-avatars').getPublicUrl(path).data.publicUrl}?t=${Date.now()}`
      const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', id)
      if (error) throw error
      setPreview(url)
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'hidden') return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-4">
      {preview
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={preview} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-(--ev-panel) text-(--ev-ink-75)"><Camera className="h-6 w-6" aria-hidden /></span>}
      <div className="min-w-[180px] flex-1">
        <p className="text-[16px] font-bold text-(--ev-ink)">{state === 'done' ? 'Your photo is on your ride pages' : 'Add your photo'}</p>
        <p className="text-[15px] text-(--ev-ink-80)">
          {state === 'done' ? 'It’s in the Shift app too.'
            : state === 'error' ? 'That didn’t save. Try another photo.'
            : 'So people on your rides know who to look for.'}
        </p>
      </div>
      {state !== 'done' && (
        <>
          <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
          <button type="button" disabled={state === 'saving'} onClick={() => input.current?.click()}
            className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-[10px] sm:w-auto bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill) hover:opacity-90 disabled:opacity-60">
            {state === 'saving' ? 'Saving…' : 'Choose a photo'}
          </button>
        </>
      )}
    </div>
  )
}

/** The middle square of the photo, at most `size` across, as a JPEG. */
async function square(file: File, size: number): Promise<Blob> {
  const img = await createImageBitmap(file)
  const side = Math.min(img.width, img.height)
  const out = Math.min(size, side)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/jpeg', 0.86))
}
